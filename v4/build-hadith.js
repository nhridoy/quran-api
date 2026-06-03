#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

// =========================================================================
// Config
// =========================================================================

const OUTPUT_DIR     = path.resolve(__dirname, 'hadith');
const PROGRESS_PATH  = path.join(OUTPUT_DIR, 'progress.json');
const BASE_API_URL   = 'https://hadislam.org';
const PAGE_SIZE      = 50;
const MAX_RETRIES    = 3;
const BASE_BACKOFF   = 10000;
const COOLDOWN_MS    = 90000;
const MAX_PER_MIN    = 6;
const WINDOW_MS      = 60000;

const sleep   = ms => new Promise(r => setTimeout(r, ms));
const now     = () => { const d = new Date(); return d.toLocaleTimeString('en-US',{hour12:false})+'.'+String(d.getMilliseconds()).padStart(3,'0'); };
const elapsed = ms => ms < 1000 ? `${ms}ms` : ms < 60000 ? `${(ms/1000).toFixed(1)}s` : `${Math.floor(ms/60000)}m ${((ms%60000)/1000).toFixed(0)}s`;

// =========================================================================
// Environment (.env loader)
// =========================================================================

(function loadEnv() {
  const candidates = [
    path.resolve(__dirname, '..', '.env'),
    path.resolve(__dirname, '.env'),
  ];
  for (const envPath of candidates) {
    try {
      const text = fs.readFileSync(envPath, 'utf-8');
      for (const line of text.split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq === -1) continue;
        const k = t.slice(0, eq).trim();
        const v = t.slice(eq + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    } catch {}
  }
})();

// =========================================================================
// OpenRouter AI translation
// =========================================================================

const OR_API_KEY    = process.env.OPENROUTER_API_KEY || '';
const OR_MODEL      = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const OR_REFERER    = process.env.OPENROUTER_REFERER || 'https://github.com/nhridoy/quran-api';
const OR_APP_TITLE  = process.env.OPENROUTER_APP_TITLE || 'Quran-Hadith API';

const TRANS_CACHE_PATH = path.join(OUTPUT_DIR, 'translations.json');

function loadTransCache() {
  try { if (fs.existsSync(TRANS_CACHE_PATH)) return JSON.parse(fs.readFileSync(TRANS_CACHE_PATH, 'utf-8')); } catch {}
  return {};
}

function saveTransCache(cache) {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(TRANS_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
}

/**
 * Translate a batch of English names to a target language via OpenRouter.
 * Checks the persistent translation cache first.
 * Returns array of translated strings (empty string on failure).
 */
async function translateBatch(names, targetLang, context, cache) {
  if (!OR_API_KEY || names.length === 0) return names.map(() => '');

  const results = [];
  const todo = [];
  const todoIdx = [];

  for (let i = 0; i < names.length; i++) {
    const key = `${targetLang}:${names[i]}`;
    if (cache[key]) { results[i] = cache[key]; }
    else { results[i] = null; todo.push(names[i]); todoIdx.push(i); }
  }

  if (todo.length === 0) return results;

  const numberedList = todo.map((t, i) => `${i + 1}. ${t}`).join('\n');
  const langName = new Intl.DisplayNames(['en'], { type: 'language' }).of(targetLang) || targetLang;

  const systemMsg = `You are a translator specializing in Islamic hadith terminology. Translate the following ${context} from English to ${langName} (language code: ${targetLang}). Use accurate Islamic/religious terminology. Return ONLY a valid JSON array of strings in the same order as the input — no markdown, no commentary.`;
  const userMsg = numberedList;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OR_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': OR_REFERER,
        'X-OpenRouter-Title': OR_APP_TITLE,
      },
      body: JSON.stringify({
        model: OR_MODEL,
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    let parsed;
    try { parsed = JSON.parse(content); } catch { throw new Error('Could not parse response as JSON'); }

    if (!Array.isArray(parsed) || parsed.length !== todo.length) {
      throw new Error(`Expected array of ${todo.length}, got ${Array.isArray(parsed) ? parsed.length : typeof parsed}`);
    }

    for (let i = 0; i < todo.length; i++) {
      const val = (parsed[i] || '').trim();
      const key = `${targetLang}:${todo[i]}`;
      cache[key] = val;
      results[todoIdx[i]] = val;
    }
    saveTransCache(cache);
    console.log(`  ✎ translated ${todo.length} names → ${targetLang}`);
  } catch (e) {
    console.warn(`  ⚠ translation (${targetLang}) failed: ${e.message}`);
    for (const i of todoIdx) results[i] = '';
  }

  return results;
}

/**
 * Fill missing language entries in name objects using AI translation.
 * Each nameObj has shape { en: "English Name" }.
 * langsPerObj[i] = array of language codes allowed for nameObjs[i].
 * After this call, nameObj[lang] will contain the translated name (or English fallback)
 * for every language in its allowed list.
 */
async function enrichNames(nameObjs, langsPerObj, context, cache) {
  const allLangs = new Set();
  for (const langs of langsPerObj) for (const l of langs) if (l !== 'en') allLangs.add(l);

  for (const lang of allLangs) {
    const todo = [];
    const todoIdx = [];
    for (let i = 0; i < nameObjs.length; i++) {
      if (langsPerObj[i].includes(lang) && !nameObjs[i][lang]) {
        todo.push(nameObjs[i].en);
        todoIdx.push(i);
      }
    }
    if (todo.length === 0) continue;
    const translations = await translateBatch(todo, lang, context, cache);
    for (let j = 0; j < todo.length; j++) {
      nameObjs[todoIdx[j]][lang] = translations[j] || nameObjs[todoIdx[j]].en || '';
    }
  }
}

// =========================================================================
// Rate-limiter (sliding window, 6 req/min)
// =========================================================================

const requestLog = [];
let cooldownUntil = 0;

async function rateLimit(label) {
  const nowMs = Date.now();
  if (nowMs < cooldownUntil) {
    const w = cooldownUntil - nowMs;
    await sleep(w);
  }
  while (requestLog.length && requestLog[0] <= nowMs - WINDOW_MS) requestLog.shift();
  if (requestLog.length >= MAX_PER_MIN) {
    const wait = requestLog[0] + WINDOW_MS - nowMs + 500;
    console.log(`  ⏳ rate-limit: ${(wait/1000).toFixed(0)}s until next slot (${requestLog.length}/${MAX_PER_MIN}) — ${label}`);
    await sleep(wait);
  }
  requestLog.push(Date.now());
}

function triggerCooldown() {
  cooldownUntil = Date.now() + COOLDOWN_MS;
  requestLog.length = 0;
}

const FETCH_OPTS = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://hadislam.org/',
  },
};

async function fetchJSON(url, label, attempt = 1) {
  await rateLimit(label);
  const res = await fetch(url, FETCH_OPTS);
  if (res.status === 429 && attempt <= MAX_RETRIES) {
    const backoff = BASE_BACKOFF * Math.pow(2, attempt - 1);
    console.warn(`  ⚠ 429 — ${label} — retry ${attempt}/${MAX_RETRIES} in ${(backoff/1000).toFixed(0)}s`);
    await sleep(backoff);
    return fetchJSON(url, label, attempt + 1);
  }
  if (res.status === 429) {
    triggerCooldown();
    throw new Error(`HTTP 429: ${url}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

// =========================================================================
// JSON helpers
// =========================================================================

function writeJSON(filePath, data, minify) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const json = minify ? JSON.stringify(data) : JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, json, 'utf-8');
}

function fillName(srcName, langs) {
  const out = {};
  for (const l of langs) out[l] = l === 'en' ? (srcName.en || '') : '';
  return out;
}

function genGradeId(eId, bIdx, hIdx, gName) {
  const hash = gName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 32);
  return `${eId}-${bIdx}-${hIdx}-${hash}`;
}

// =========================================================================
// Interactive pickers (buffered stdin parser)
// =========================================================================

let rawActive = false;

function initRaw() {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    rawActive = true;
  }
  process.stdin.resume();
}

function exitRaw() {
  try { process.stdin.setRawMode(false); } catch {}
  rawActive = false;
  process.stdin.pause();
}

function eraseBlock(n) {
  if (n < 1) return;
  process.stdout.write(`\x1b[${n}A\x1b[J`);
}

/**
 * Wait for key input using a buffered parser.
 * Calls handler(seq) where seq is one of:
 *   'up', 'down', 'enter', 'space', 'q', 'esc'
 */
function waitKey(handler) {
  let buf = '';
  let stopped = false;
  const onData = (chunk) => {
    if (stopped) return;
    buf += chunk.toString();
    while (buf.length > 0 && !stopped) {
      const c = buf[0];
      if (c === '\x1b') {
        if (buf.length >= 3 && buf[1] === '[') {
          const dir = buf[2];
          buf = buf.slice(3);
          if (dir === 'A') { handler('up'); continue; }
          if (dir === 'B') { handler('down'); continue; }
          handler('esc'); continue;
        }
        return;
      }
      buf = buf.slice(1);
      if (c === '\r' || c === '\n') { handler('enter'); continue; }
      if (c === ' ') { handler('space'); continue; }
      if (c === 'a' || c === 'A') { handler('all'); continue; }
      if (c === 'q' || c === 'Q' || c === '\x03') { stopped = true; handler('q'); continue; }
    }
  };
  process.stdin.on('data', onData);
  return () => { stopped = true; process.stdin.removeListener('data', onData); };
}

/**
 * Single-select list. Returns chosen index or -1 if cancelled.
 */
async function pickSingle(title, items) {
  return new Promise((resolve) => {
    let sel = 0;
    const n = items.length;

    const render = () => {
      const lines = [`\n  ${title}\n`];
      for (let i = 0; i < n; i++) {
        const pfx = i === sel ? '\x1b[36m › \x1b[0m' : '   ';
        const dis = items[i].disabled ? ' \x1b[2m(completed)\x1b[0m' : '';
        lines.push(`  ${pfx}${items[i].label}${dis}`);
      }
      lines.push('');
      return lines.join('\n');
    };

    const draw = () => process.stdout.write(render());
    const clear = () => eraseBlock(n + 3);

    initRaw();
    draw();

    const remove = waitKey((key) => {
      clear();
      if (key === 'up') { sel = sel > 0 ? sel - 1 : n - 1; draw(); }
      else if (key === 'down') { sel = sel < n - 1 ? sel + 1 : 0; draw(); }
      else if (key === 'enter') { remove(); exitRaw(); clear(); resolve(sel); }
      else if (key === 'q') { remove(); exitRaw(); clear(); resolve(-1); }
      else draw();
    });
  });
}

/**
 * Multi-select list. Returns array of selected indices.
 */
async function pickMulti(title, items) {
  return new Promise((resolve) => {
    let sel = 0;
    const n = items.length;
    const checked = items.map(i => !!i.checked);

    const render = () => {
      const selCount = checked.filter(Boolean).length;
      const lines = [
        `\n  ${title}`,
        `  (\x1b[36m${selCount}\x1b[0m/${n} selected, \x1b[36mSpace\x1b[0m toggle, \x1b[36ma\x1b[0m all, \x1b[36mEnter\x1b[0m confirm, \x1b[36mq\x1b[0m skip)\n`,
      ];
      for (let i = 0; i < n; i++) {
        const check = checked[i] ? '\x1b[32m✓\x1b[0m' : ' ';
        const pointer = i === sel ? '\x1b[36m›\x1b[0m' : ' ';
        lines.push(`  ${pointer} [${check}] ${items[i].label}`);
      }
      lines.push('');
      return lines.join('\n');
    };

    const draw = () => process.stdout.write(render());
    const clear = () => eraseBlock(n + 3);

    initRaw();
    draw();

    const remove = waitKey((key) => {
      clear();
      if (key === 'up') { sel = sel > 0 ? sel - 1 : n - 1; draw(); }
      else if (key === 'down') { sel = sel < n - 1 ? sel + 1 : 0; draw(); }
      else if (key === 'space') { checked[sel] = !checked[sel]; draw(); }
      else if (key === 'all') { for (let i = 0; i < n; i++) checked[i] = true; draw(); }
      else if (key === 'enter') { remove(); exitRaw(); clear(); resolve(checked.map((v, i) => v ? i : -1).filter(i => i !== -1)); }
      else if (key === 'q') { remove(); exitRaw(); clear(); resolve([]); }
      else draw();
    });
  });
}

// =========================================================================
// Progress tracking
// =========================================================================

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_PATH)) {
      return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf-8'));
    }
  } catch {}
  return { editions: {} };
}

function saveProgress(prog) {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  writeJSON(PROGRESS_PATH, prog, false);
}

function markEditionStarted(prog, slug) {
  if (!prog.editions[slug]) prog.editions[slug] = { books: {} };
}

function markBookStarted(prog, slug, bookIndex) {
  markEditionStarted(prog, slug);
  if (!prog.editions[slug].books[bookIndex]) {
    prog.editions[slug].books[bookIndex] = { langs: {} };
  }
}

function markLangComplete(prog, slug, bookIndex, lang, pages) {
  markBookStarted(prog, slug, bookIndex);
  prog.editions[slug].books[bookIndex].langs[lang] = { complete: true, pages, updated: new Date().toISOString() };
  saveProgress(prog);
}

function isLangComplete(prog, slug, bookIndex, lang) {
  return !!(prog.editions[slug]?.books[bookIndex]?.langs[lang]?.complete);
}

// =========================================================================
// Build functions
// =========================================================================

function processItem(item, lang) {
  const grades = (item.grades || []).map(g => ({
    id: genGradeId(item.editionId, item.bookIndex, item.hadithIndex, g.name),
    name: g.name,
    grade: g.grade,
  }));
  return {
    id: item._id,
    editionId: item.editionId,
    bookIndex: item.bookIndex,
    hadithIndex: item.hadithIndex,
    bookHadithIndex: item.bookHadithIndex,
    text: item.text[lang] || '',
    grades,
  };
}

async function buildBookLang(editionSlug, bookIndex, availableLanguages, minifyMode, progress) {
  const t0 = Date.now();

  const p1 = await fetchJSON(
    `${BASE_API_URL}/editions/${editionSlug}/books/${bookIndex}/hadiths?lang=*&page=1`,
    `${editionSlug}/${bookIndex}/*/p1`
  );
  const total = p1.total;
  const pageSize = p1.page_size;
  const totalPages = Math.ceil(total / pageSize);

  const allItems = {};
  for (const lang of availableLanguages) allItems[lang] = [];

  const langDir = l => path.join(OUTPUT_DIR, editionSlug, `${editionSlug}-${bookIndex}`, l);
  const pageOut = (page, items) => ({ total, totalPage: totalPages, page, pageSize, items });

  function writePage(page, itemsByLang) {
    for (const lang of availableLanguages) {
      const dir = langDir(lang);
      if (minifyMode !== 'min') writeJSON(path.join(dir, `${page}.json`), pageOut(page, itemsByLang[lang]), false);
      if (minifyMode !== null)  writeJSON(path.join(dir, `${page}.min.json`), pageOut(page, itemsByLang[lang]), true);
    }
  }

  // page 1
  let langItems = {};
  for (const lang of availableLanguages) {
    langItems[lang] = (p1.items || []).map(i => processItem(i, lang));
    allItems[lang].push(...langItems[lang]);
  }
  writePage(1, langItems);

  // remaining pages
  for (let p = 2; p <= totalPages; p++) {
    console.log(`  fetching * page ${p}/${totalPages}...`);
    try {
      const pd = await fetchJSON(
        `${BASE_API_URL}/editions/${editionSlug}/books/${bookIndex}/hadiths?lang=*&page=${p}`,
        `${editionSlug}/${bookIndex}/*/p${p}`
      );
      langItems = {};
      for (const lang of availableLanguages) {
        langItems[lang] = (pd.items || []).map(i => processItem(i, lang));
        allItems[lang].push(...langItems[lang]);
      }
      writePage(p, langItems);
    } catch (e) {
      console.warn(`  ⚠ page ${p} failed: ${e.message}`);
    }
  }

  // write full hadith files per language
  for (const lang of availableLanguages) {
    const full = { total, items: allItems[lang] };
    const dir = langDir(lang);
    if (minifyMode !== 'min') writeJSON(path.join(dir, 'hadith.json'), full, false);
    if (minifyMode !== null)  writeJSON(path.join(dir, 'hadith.min.json'), full, true);

    markLangComplete(progress, editionSlug, bookIndex, lang, totalPages);
    console.log(`  ✓ ${lang}: ${allItems[lang].length}/${total} hadith (${totalPages}p)`);
  }

  console.log(`  ✓ all langs done ${elapsed(Date.now() - t0)}`);
}

async function buildEditionBooks(editionSlug, availableLanguages, bookIndices, minifyMode, progress, transCache) {
  // fetch and write books.json
  if (!fs.existsSync(path.join(OUTPUT_DIR, editionSlug, 'books.json'))) {
    console.log(`\n  Fetching books for ${editionSlug}...`);
    const books = await fetchJSON(`${BASE_API_URL}/editions/${editionSlug}/books`, `books/${editionSlug}`);
    const items = books.map(b => ({
      id: b._id, editionId: b.editionId, bookIndex: b.bookIndex,
      hadithCount: b.hadithCount, hadithIndexStart: b.hadithIndexStart,
      name: fillName(b.name, availableLanguages),
    }));
    const cache = transCache || loadTransCache();
    const langsPer = items.map(() => availableLanguages);
    await enrichNames(items.map(b => b.name), langsPer, `book names for ${editionSlug}`, cache);
    if (!transCache) saveTransCache(cache);
    if (minifyMode !== 'min') writeJSON(path.join(OUTPUT_DIR, editionSlug, 'books.json'), items, false);
    if (minifyMode !== null)  writeJSON(path.join(OUTPUT_DIR, editionSlug, 'books.min.json'), items, true);
    console.log(`  → ${books.length} books`);
    return books;
  }
  // reuse cached books.json
  return JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, editionSlug, 'books.json'), 'utf-8'));
}

async function buildEdition(edition, bookIndices, minifyMode, progress, transCache) {
  const { slug, availableLanguages } = edition;
  markEditionStarted(progress, slug);
  saveProgress(progress);

  const books = await buildEditionBooks(slug, availableLanguages, bookIndices, minifyMode, progress, transCache);
  const filtered = books.filter(b => bookIndices.includes(b.bookIndex));

  console.log(`\n  Fetching ${filtered.length} selected books for ${slug}:\n`);

  for (let i = 0; i < filtered.length; i++) {
    const book = filtered[i];
    const bIdx = book.bookIndex;
    const tBook = Date.now();
    const label = book.name.en || `Book ${bIdx}`;
    const pages = Math.ceil(book.hadithCount / PAGE_SIZE);
    const allDone = availableLanguages.every(l => isLangComplete(progress, slug, bIdx, l));

    if (allDone) {
      console.log(`  [${i + 1}/${filtered.length}] Book ${bIdx}: ${label} — already complete`);
      continue;
    }

    console.log(`  [${i + 1}/${filtered.length}] Book ${bIdx}: ${label} (${book.hadithCount} hadith, ${pages} pages, ${availableLanguages.length} langs via lang=*)`);

    try {
      await buildBookLang(slug, bIdx, availableLanguages, minifyMode, progress);
    } catch (e) {
      console.warn(`  ⚠ ${slug}/${bIdx} failed: ${e.message}`);
    }

    console.log(`  ✓ book ${bIdx} done ${elapsed(Date.now() - tBook)}\n`);
    saveProgress(progress);
  }

  console.log(`  ✓ ${slug} complete`);
}

// =========================================================================
// Editions list (cached)
// =========================================================================

const CACHE_PATH = path.join(OUTPUT_DIR, 'editions.json');

async function getEditions() {
  if (fs.existsSync(CACHE_PATH)) {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
  }
  console.log('  Fetching editions list...');
  const raw = await fetchJSON(`${BASE_API_URL}/editions/`, 'editions');
  const items = raw.map(e => ({
    id: e._id, slug: e.slug, bookCount: e.bookCount,
    hadithCount: e.hadithCount, availableLanguages: e.availableLanguages,
    name: fillName(e.name, e.availableLanguages),
  }));
  const cache = loadTransCache();
  await enrichNames(items.map(e => e.name), items.map(e => e.availableLanguages), 'edition names', cache);
  saveTransCache(cache);
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  writeJSON(CACHE_PATH, items, false);
  writeJSON(CACHE_PATH.replace('.json', '.min.json'), items, true);
  console.log(`  → ${items.length} editions`);
  return items;
}

// =========================================================================
// Interactive menu flow
// =========================================================================

async function runInteractive(minifyMode) {
  const progress = loadProgress();
  const editions = await getEditions();
  const transCache = loadTransCache();

  while (true) {
    // --- Edition picker ---
    const edItems = [
      { label: `\x1b[1mFull\x1b[0m (all ${editions.length} editions)` },
      ...editions.map(e => {
        const prog = progress.editions[e.slug];
        const done = prog && Object.keys(prog.books).length > 0;
        return { label: `${e.slug}  \x1b[2m(${e.bookCount} books, ${e.hadithCount} hadith)${done ? ' — completed' : ''}\x1b[0m`, disabled: false };
      }),
    ];

    const edChoice = await pickSingle('Select edition (\x1b[36m↑↓\x1b[0m move, \x1b[36mEnter\x1b[0m confirm, \x1b[36mq\x1b[0m quit):', edItems);
    if (edChoice < 0) { console.log('  Quit.'); break; }

    const isFull = edChoice === 0;
    const selectedEditions = isFull ? editions : [editions[edChoice - 1]];

    // --- Book picker for each selected edition ---
    for (const ed of selectedEditions) {
      const { slug, availableLanguages } = ed;
      const prog = progress.editions[slug];

      // fetch books if needed
      const booksPath = path.join(OUTPUT_DIR, slug, 'books.json');
      let books;
      if (fs.existsSync(booksPath)) {
        books = JSON.parse(fs.readFileSync(booksPath, 'utf-8'));
      } else {
        console.log(`\n  Fetching books for ${slug}...`);
        const raw = await fetchJSON(`${BASE_API_URL}/editions/${slug}/books`, `books/${slug}`);
        books = raw.map(b => ({
          id: b._id, editionId: b.editionId, bookIndex: b.bookIndex,
          hadithCount: b.hadithCount, hadithIndexStart: b.hadithIndexStart,
          name: fillName(b.name, availableLanguages),
        }));
        const langsPer = books.map(() => availableLanguages);
        await enrichNames(books.map(b => b.name), langsPer, `book names for ${slug}`, transCache);
        saveTransCache(transCache);
        const dir = path.join(OUTPUT_DIR, slug);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (minifyMode !== 'min') writeJSON(path.join(dir, 'books.json'), books, false);
        if (minifyMode !== null) writeJSON(path.join(dir, 'books.min.json'), books, true);
      }

      const bookItems = books.map((b, i) => {
        const done = !!(prog?.books[b.bookIndex]?.langs && 
          availableLanguages.every(l => isLangComplete(progress, slug, b.bookIndex, l)));
        const pages = Math.ceil(b.hadithCount / PAGE_SIZE);
        return {
          label: `${b.bookIndex}. ${b.name.en || `Book ${b.bookIndex}`} \x1b[2m(${b.hadithCount} hadith, ${pages}p)${done ? ' ✓' : ''}\x1b[0m`,
          checked: done,
          bookIndex: b.bookIndex,
        };
      });

      const selectedIndices = await pickMulti(
        `Select books for \x1b[1m${slug}\x1b[0m (\x1b[36m↑↓\x1b[0m move, \x1b[36mSpace\x1b[0m toggle, \x1b[36mEnter\x1b[0m confirm):`,
        bookItems
      );

      if (selectedIndices.length === 0) {
        console.log(`  No books selected for ${slug}, skipping.\n`);
        continue;
      }

      const selectedBooks = selectedIndices.map(i => bookItems[i].bookIndex);
      await buildEdition(ed, selectedBooks, minifyMode, progress, transCache);

      console.log(`\n  ─────────────────────────────────`);
    }
  }

  console.log(`\n  Progress saved to ${PROGRESS_PATH}`);
}

// =========================================================================
// CLI
// =========================================================================

function showHelp() {
  const B = s => `\x1b[1m${s}\x1b[22m`;
  const C = s => `\x1b[36m${s}\x1b[39m`;
  const G = s => `\x1b[32m${s}\x1b[39m`;
  const Y = s => `\x1b[33m${s}\x1b[39m`;

  console.log(`
${B('v4/build-hadith.js')} — Hadith API dataset builder (hadislam.org)

${B('SYNOPSIS')}
  ${G('node build-hadith.js')} [${C('-m')} ${Y('<mode>')}] [${C('-h')}]

${B('FLAGS')}
  ${C('-h')}          Show this help
  ${C('-m')} ${Y('<mode>')}   JSON format: ${Y('min')} | ${Y('with-min')}

${B('INTERACTIVE MODE')}
  Launches an interactive picker:
    1. Choose an edition (or "Full" for all)
    2. Select specific books with Space (or Enter for none)
    3. Script fetches only selected books, tracking progress
    4. Resume later — already-fetched items are pre-checked

${B('EXAMPLES')}
  ${G('node build-hadith.js')}
  ${G('node build-hadith.js')} ${C('-m')} ${Y('with-min')}
`);
  process.exit(0);
}

function parseArgs() {
  const raw = process.argv.slice(2);
  if (raw.includes('-h')) showHelp();
  let minifyMode = null;
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a === '-m') {
      minifyMode = raw[++i];
      if (!['min', 'with-min'].includes(minifyMode)) {
        console.error("-m must be 'min' or 'with-min'"); process.exit(1);
      }
    }
  }
  return { minifyMode };
}

// =========================================================================
// Main
// =========================================================================

async function main() {
  const { minifyMode } = parseArgs();

  const minLabel = minifyMode === null ? 'Pretty JSON' :
    minifyMode === 'min' ? 'Minified JSON only' : 'Pretty + minified JSON';

  console.log(`\n  ╔══════════════════════════════════════════╗`);
  console.log(`  ║      v4 Hadith API — Build Script       ║`);
  console.log(`  ╚══════════════════════════════════════════╝\n`);
  console.log(`  Format:   ${minLabel}\n`);

  try {
    await runInteractive(minifyMode);
  } catch (e) {
    console.error(`\n  Fatal: ${e.message}`);
    process.exit(1);
  }
}

main();
