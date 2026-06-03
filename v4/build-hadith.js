#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR     = path.resolve(__dirname, 'hadith');
const BASE_API_URL   = 'https://hadislam.org';
const PAGE_SIZE      = 50;

const MAX_RETRIES   = 3;
const BASE_BACKOFF  = 10000;
const COOLDOWN_MS   = 90000;
const MAX_PER_MIN   = 6;
const WINDOW_MS     = 60000;

const sleep      = ms => new Promise(r => setTimeout(r, ms));
const now        = () => { const d = new Date(); return d.toLocaleTimeString('en-US',{hour12:false})+'.'+String(d.getMilliseconds()).padStart(3,'0'); };
const elapsed    = ms => ms < 1000 ? `${ms}ms` : ms < 60000 ? `${(ms/1000).toFixed(1)}s` : `${Math.floor(ms/60000)}m ${((ms%60000)/1000).toFixed(0)}s`;

const requestLog = [];
let   cooldownUntil = 0;

async function rateLimit(label) {
  const nowMs = Date.now();
  // global cooldown
  if (nowMs < cooldownUntil) {
    const w = cooldownUntil - nowMs;
    console.warn(`[${now()}]     ⏸️ cooldown ${(w/1000).toFixed(0)}s — ${label}`);
    await sleep(w);
  }
  // sliding window: remove entries older than 1 minute
  while (requestLog.length && requestLog[0] <= nowMs - WINDOW_MS) requestLog.shift();
  // if at capacity, wait until oldest entry expires
  if (requestLog.length >= MAX_PER_MIN) {
    const wait = requestLog[0] + WINDOW_MS - nowMs + 500;
    console.log(`[${now()}]     ⏳ waiting for rate-limit slot (${requestLog.length}/${MAX_PER_MIN} used) — ${(wait/1000).toFixed(0)}s until next — ${label}`);
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
    console.warn(`[${now()}]     ⚠ 429 — ${label} — retry ${attempt}/${MAX_RETRIES} in ${(backoff/1000).toFixed(0)}s`);
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

function writeJSON(filePath, data, minify) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const json = minify ? JSON.stringify(data) : JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, json, 'utf-8');
}

function fillName(srcName, langs) {
  const out = {};
  for (const l of langs) out[l] = srcName.en || '';
  return out;
}

function genGradeId(eId, bIdx, hIdx, gName) {
  const hash = gName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 32);
  return `${eId}-${bIdx}-${hIdx}-${hash}`;
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
  ${G('node build-hadith.js')} [${C('-e')} ${Y('<edition>')}] [${C('-m')} ${Y('<mode>')}] [${C('-h')}]

${B('FLAGS')}
  ${C('-h')}          Show this help
  ${C('-e')} ${Y('<edition>')}  Edition slug(s), comma-separated (default: all)
  ${C('-m')} ${Y('<mode>')}   JSON format: ${Y('min')} | ${Y('with-min')}

${B('EXAMPLES')}
  ${G('node build-hadith.js')}
  ${G('node build-hadith.js')} ${C('-e')} ${Y('sahih-al-bukhari')}
  ${G('node build-hadith.js')} ${C('-e')} ${Y('sahih-al-bukhari,sunan-ibn-majah')} ${C('-m')} ${Y('with-min')}
`);
  process.exit(0);
}

function parseArgs() {
  const raw = process.argv.slice(2);
  if (raw.includes('-h')) showHelp();

  let editionArg = null;
  let minifyMode = null;

  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a === '-e') {
      editionArg = raw[++i];
      if (!editionArg) { console.error('-e requires a value'); process.exit(1); }
    } else if (a === '-m') {
      minifyMode = raw[++i];
      if (!['min', 'with-min'].includes(minifyMode)) {
        console.error("-m must be 'min' or 'with-min'"); process.exit(1);
      }
    }
  }

  return { editionArg, minifyMode };
}

// =========================================================================
// Fetch and write editions
// =========================================================================

async function fetchEditions() {
  const t0 = Date.now();
  console.log(`[${now()}]   Fetching editions list...`);
  const data = await fetchJSON(`${BASE_API_URL}/editions/`, 'editions');
  console.log(`[${now()}]   → ${data.length} editions (${elapsed(Date.now() - t0)})`);
  return data;
}

function buildEdition(e) {
  return {
    id: e._id,
    slug: e.slug,
    bookCount: e.bookCount,
    hadithCount: e.hadithCount,
    availableLanguages: e.availableLanguages,
    name: fillName(e.name, e.availableLanguages),
  };
}

function writeEditions(editions, minifyMode) {
  const items = editions.map(buildEdition);
  if (minifyMode !== 'min') writeJSON(path.join(OUTPUT_DIR, 'editions.json'), items, false);
  if (minifyMode !== null)  writeJSON(path.join(OUTPUT_DIR, 'editions.min.json'), items, true);
}

// =========================================================================
// Fetch and write books for a single edition
// =========================================================================

async function fetchBooks(slug) {
  const data = await fetchJSON(`${BASE_API_URL}/editions/${slug}/books`, `books/${slug}`);
  return data;
}

function buildBook(b, langs) {
  return {
    id: b._id,
    editionId: b.editionId,
    bookIndex: b.bookIndex,
    hadithCount: b.hadithCount,
    hadithIndexStart: b.hadithIndexStart,
    name: fillName(b.name, langs),
  };
}

function writeBooks(books, editionSlug, langs, minifyMode) {
  const dir = path.join(OUTPUT_DIR, editionSlug);
  const items = books.map(b => buildBook(b, langs));
  if (minifyMode !== 'min') writeJSON(path.join(dir, 'books.json'), items, false);
  if (minifyMode !== null)  writeJSON(path.join(dir, 'books.min.json'), items, true);
}

// =========================================================================
// Process a single hadith item
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

// =========================================================================
// Fetch all pages for one book+lang, write hadith.json + per-page .json
// =========================================================================

async function buildBookLang(editionSlug, bookIndex, lang, minifyMode) {
  const t0 = Date.now();
  const bookDir = path.join(OUTPUT_DIR, editionSlug, `${editionSlug}-${bookIndex}`, lang);

  let allItems = [];
  let total = 0;
  let totalPages = 1;
  let pageSize = PAGE_SIZE;

  // --- page 1 ---
  console.log(`[${now()}]     fetching ${lang} page 1...`);
  const p1 = await fetchJSON(
    `${BASE_API_URL}/editions/${editionSlug}/books/${bookIndex}/hadiths?lang=${lang}&page=1`,
    `${editionSlug}/${bookIndex}/${lang}/p1`
  );
  total = p1.total;
  pageSize = p1.page_size;
  totalPages = Math.ceil(total / pageSize);
  const p1Items = (p1.items || []).map(i => processItem(i, lang));
  allItems.push(...p1Items);

  // page 1 output
  const pageOut = (page, items) => ({
    total, totalPage: totalPages, page, pageSize, items,
  });
  if (minifyMode !== 'min') writeJSON(path.join(bookDir, '1.json'), pageOut(1, p1Items), false);
  if (minifyMode !== null)  writeJSON(path.join(bookDir, '1.min.json'), pageOut(1, p1Items), true);

  // --- pages 2..N ---
  for (let p = 2; p <= totalPages; p++) {
    try {
      console.log(`[${now()}]     fetching ${lang} page ${p}/${totalPages}...`);
      const pd = await fetchJSON(
        `${BASE_API_URL}/editions/${editionSlug}/books/${bookIndex}/hadiths?lang=${lang}&page=${p}`,
        `${editionSlug}/${bookIndex}/${lang}/p${p}`
      );
      const pItems = (pd.items || []).map(i => processItem(i, lang));
      allItems.push(...pItems);

      if (minifyMode !== 'min') writeJSON(path.join(bookDir, `${p}.json`), pageOut(p, pItems), false);
      if (minifyMode !== null)  writeJSON(path.join(bookDir, `${p}.min.json`), pageOut(p, pItems), true);
    } catch (e) {
      console.warn(`[${now()}]       ⚠ page ${p} failed: ${e.message}`);
    }
  }

  // --- full hadith.json ---
  const full = { total, items: allItems };
  if (minifyMode !== 'min') writeJSON(path.join(bookDir, 'hadith.json'), full, false);
  if (minifyMode !== null)  writeJSON(path.join(bookDir, 'hadith.min.json'), full, true);

  console.log(`[${now()}]       → ${allItems.length}/${total} hadith (${totalPages}p, ${lang}) ${elapsed(Date.now() - t0)}`);
}

// =========================================================================
// Process one edition (books + all book/langs)
// =========================================================================

async function buildEditionData(edition, minifyMode) {
  const { slug, availableLanguages } = edition;
  const tEdition = Date.now();

  // books
  console.log(`[${now()}]   Fetching books...`);
  const books = await fetchBooks(slug);
  writeBooks(books, slug, availableLanguages, minifyMode);
  console.log(`[${now()}]     → ${books.length} books`);

  // hadith per book per language
  for (let bi = 0; bi < books.length; bi++) {
    const book = books[bi];
    const bIdx = book.bookIndex;
    const tBook = Date.now();
    const label = book.name.en || `Book ${bIdx}`;
    const pages = Math.ceil(book.hadithCount / PAGE_SIZE);
    const totalReqs = pages * availableLanguages.length;
    console.log(`[${now()}]   Book ${bIdx}/${books.length}: ${label} (${book.hadithCount} hadith, ${pages} pages × ${availableLanguages.length} langs = ~${totalReqs} requests)`);

    for (const lang of availableLanguages) {
      try {
        await buildBookLang(slug, bIdx, lang, minifyMode);
      } catch (e) {
        console.warn(`[${now()}]     ⚠ ${slug}/${bIdx}/${lang} failed: ${e.message}`);
      }
    }

    console.log(`[${now()}]     ⏱ ${elapsed(Date.now() - tBook)}`);
  }

  console.log(`[${now()}]   ⏱ ${elapsed(Date.now() - tEdition)}`);
}

// =========================================================================
// Main
// =========================================================================

async function main() {
  const scriptStart = Date.now();
  const { editionArg, minifyMode } = parseArgs();

  const minLabel = minifyMode === null ? 'Pretty JSON' :
    minifyMode === 'min' ? 'Minified JSON only' : 'Pretty + minified JSON';

  console.log(`\n  ╔══════════════════════════════════════════╗`);
  console.log(`  ║      v4 Hadith API — Build Script       ║`);
  console.log(`  ╚══════════════════════════════════════════╝\n`);
  console.log(`  Format:   ${minLabel}\n`);

  // fetch editions
  console.log(`[${now()}] Fetching editions...`);
  const allEditions = await fetchEditions();
  writeEditions(allEditions, minifyMode);

  let editions = allEditions;
  if (editionArg) {
    const slugs = editionArg.split(',').map(s => s.trim());
    editions = allEditions.filter(e => slugs.includes(e.slug));
    if (editions.length === 0) {
      console.error(`No matching editions for: ${editionArg}`);
      process.exit(1);
    }
    console.log(`[${now()}] Filtered to ${editions.length} edition(s)\n`);
  }

  for (let i = 0; i < editions.length; i++) {
    const e = editions[i];
    const pct = editions.length > 1 ? ` (${((i + 1) / editions.length * 100).toFixed(0)}%)` : '';
    console.log(`\n  ── [${i + 1}/${editions.length}]${pct} ${e.slug} ──`);

    try {
      await buildEditionData(e, minifyMode);
    } catch (err) {
      console.error(`[${now()}]   ✗ ${e.slug} failed: ${err.message}`);
    }
  }

  console.log(`\n  ╔══════════════════════════════════════════╗`);
  console.log(`  ║  Done! ${elapsed(Date.now() - scriptStart).padEnd(37)}║`);
  console.log(`  ╚══════════════════════════════════════════╝\n`);
}

main().catch(e => { console.error(`Fatal:`, e); process.exit(1); });
