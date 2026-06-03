#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const OUTPUT_DIR = path.resolve(__dirname, 'hadith');
const BASE_API_URL = 'https://hadislam.org';
const PAGE_SIZE = 50;

const MAX_PER_MIN = 5;
const WINDOW_MS = 60000;

const progressPath = path.join(OUTPUT_DIR, 'progress.json');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* -------------------- TERMINAL UI -------------------- */

const ESC = '\x1b';
const CLEAR = `${ESC}[2J${ESC}[0f`;
const HIDE = `${ESC}[?25l`;
const SHOW = `${ESC}[?25h`;

function clear() {
  process.stdout.write(CLEAR);
}

function log(msg) {
  process.stdout.write(msg + '\n');
}

/* -------------------- KEYBOARD INPUT -------------------- */

function keypress() {
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
}

/* -------------------- PROGRESS -------------------- */

function loadProgress() {
  if (!fs.existsSync(progressPath)) return { editions: {} };
  return JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
}

function saveProgress(p) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(progressPath, JSON.stringify(p, null, 2));
}

/* -------------------- RATE LIMIT -------------------- */

const requestLog = [];

async function rateLimit(label) {
  const now = Date.now();

  while (requestLog.length && requestLog[0] <= now - WINDOW_MS) {
    requestLog.shift();
  }

  if (requestLog.length >= MAX_PER_MIN) {
    const wait = requestLog[0] + WINDOW_MS - now + 200;
    await sleep(wait);
  }

  requestLog.push(Date.now());
}

/* -------------------- FETCH -------------------- */

async function fetchJSON(url, label) {
  await rateLimit(label);

  const res = await fetch(url);

  if (!res.ok) throw new Error(`${res.status} ${url}`);

  return res.json();
}

/* -------------------- UTIL -------------------- */

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, ans => {
      rl.close();
      resolve(ans);
    });
  });
}

/* -------------------- MENU -------------------- */

async function menu(title, items, multi = false) {
  let index = 0;
  const selected = new Set();

  keypress();

  return new Promise(resolve => {
    function render() {
      clear();
      log(`== ${title} ==`);
      log('');

      items.forEach((item, i) => {
        const cursor = i === index ? '>' : ' ';
        const checked = selected.has(i) ? '[x]' : '[ ]';
        log(
          multi
            ? `${cursor} ${checked} ${item}`
            : `${cursor} ${item}`
        );
      });

      log('');
      log(multi
        ? '↑↓ move | space select | enter confirm'
        : '↑↓ move | enter confirm'
      );
    }

    function onKey(_, key) {
      if (key.name === 'up') {
        index = (index - 1 + items.length) % items.length;
      }

      if (key.name === 'down') {
        index = (index + 1) % items.length;
      }

      if (multi && key.name === 'space') {
        selected.has(index)
          ? selected.delete(index)
          : selected.add(index);
      }

      if (key.name === 'return') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('keypress', onKey);
        process.stdout.write(SHOW);

        if (multi) {
          resolve([...selected].map(i => items[i]));
        } else {
          resolve(items[index]);
        }
      }

      render();
    }

    process.stdin.on('keypress', onKey);
    process.stdout.write(HIDE);
    render();
  });
}

/* -------------------- API -------------------- */

async function getEditions() {
  return fetchJSON(`${BASE_API_URL}/editions/`, 'editions');
}

async function getBooks(slug) {
  return fetchJSON(`${BASE_API_URL}/editions/${slug}/books`, 'books');
}

async function getHadith(slug, book, page) {
  return fetchJSON(
    `${BASE_API_URL}/editions/${slug}/books/${book}/hadiths?lang=*&page=${page}`,
    'hadith'
  );
}

/* -------------------- CORE -------------------- */

function processItem(item) {
  return {
    id: item._id,
    text: item.text || {},
    grades: item.grades || []
  };
}

async function buildBook(progress, edition, book) {
  const slug = edition.slug;
  const bookIndex = book.bookIndex;

  const dir = path.join(OUTPUT_DIR, slug, `${slug}-${bookIndex}`);

  const totalPages = Math.ceil(book.hadithCount / PAGE_SIZE);

  const bookProg =
    progress.editions?.[slug]?.books?.[bookIndex] ||
    { completedPages: [] };

  for (let page = 1; page <= totalPages; page++) {
    if (bookProg.completedPages.includes(page)) continue;

    process.stdout.write(`Fetching ${slug} book ${bookIndex} page ${page}/${totalPages}\r`);

    const res = await getHadith(slug, bookIndex, page);

    const items = (res.items || []).map(processItem);

    // split by language
    const langs = edition.availableLanguages;

    for (const lang of langs) {
      const langItems = items.map(i => ({
        ...i,
        text: i.text?.[lang] || ''
      }));

      const file = path.join(dir, lang, `${page}.json`);
      fs.mkdirSync(path.dirname(file), { recursive: true });

      fs.writeFileSync(file, JSON.stringify({
        page,
        total: res.total,
        items: langItems
      }, null, 2));
    }

    // update progress
    if (!progress.editions) progress.editions = {};
    if (!progress.editions[slug]) progress.editions[slug] = { books: {} };
    if (!progress.editions[slug].books[bookIndex]) {
      progress.editions[slug].books[bookIndex] = { completedPages: [] };
    }

    progress.editions[slug]
      .books[bookIndex]
      .completedPages
      .push(page);

    saveProgress(progress);
  }

  log(`\n✔ Book ${bookIndex} done`);
}

/* -------------------- MAIN -------------------- */

async function main() {
  const progress = loadProgress();

  const editions = await getEditions();

  const editionList = editions.map(e => e.slug);

  const selectedEdition = await menu(
    'Select Edition',
    ['FULL', ...editionList]
  );

  const targetEditions =
    selectedEdition === 'FULL'
      ? editions
      : editions.filter(e => e.slug === selectedEdition);

  for (const edition of targetEditions) {
    const books = await getBooks(edition.slug);

    const bookLabels = books.map(
      b => `${b.bookIndex} - ${b.name.en}`
    );

    const selectedBooks = await menu(
      `Select Books (${edition.slug})`,
      bookLabels,
      true
    );

    const selectedIndexes = new Set(
      selectedBooks.map(b =>
        parseInt(b.split(' - ')[0])
      )
    );

    for (const book of books) {
      if (!selectedIndexes.has(book.bookIndex)) continue;

      await buildBook(progress, edition, book);
    }
  }

  console.log('\n✔ Done');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});