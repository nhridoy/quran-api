#!/usr/bin/env node

/**
 * v4/build.js
 *
 * Builds the v4 Quran API dataset by enhancing source/surah data with:
 *   - revelation_order (from islamic.app)
 *   - tafsir (from islamic.app, English + Bengali)
 *   - Multi-reciter audio URLs (islamic.network + islamic.app)
 *   - Verse image URLs (islamic.network)
 *
 * Usage:
 *   node v4/build.js                  Build all 114 surahs
 *   node v4/build.js 1                Build only surah 1 (testing)
 *   node v4/build.js 1,2,3            Build surahs 1, 2, and 3
 *   node v4/build.js 1-10             Build surahs 1 through 10 (range)
 *
 * Output: v4/surah/{id}.json with 2-space indentation.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// =========================================================================
// Configuration
// =========================================================================

const SOURCE_DIR = path.resolve(__dirname, '..', 'source', 'surah');
const OUTPUT_DIR = path.resolve(__dirname, 'surah');

const ISLAMIC_APP_BASE = 'https://api.islamic.app/v1';
const ISLAMIC_NETWORK_AUDIO = 'https://cdn.islamic.network/quran/audio';
const ISLAMIC_APP_AUDIO = 'https://cdn.islamic.app/quran/audio';
const ISLAMIC_NETWORK_IMAGE = 'http://cdn.islamic.network/quran/images';

const TOTAL_SURAHS = 114;
const REQUEST_DELAY_MS = 150;
const DOWNLOAD_TIMEOUT_MS = 8000;

const ALQURAN_CLOUD_EDITIONS = 'https://api.alquran.cloud/v1/edition?format=audio&language=ar&type=versebyverse';

// =========================================================================
// Helpers
// =========================================================================

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function now() {
  const d = new Date();
  return d.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function elapsedStr(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = (ms % 60000) / 1000;
  return `${m}m ${s.toFixed(0)}s`;
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJSON(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
      }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

function safeUnlink(p) {
  try { fs.unlinkSync(p); } catch (_) {}
}

function downloadFile(url, destPath) {
  return new Promise((resolve) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = destPath + '.tmp';
    safeUnlink(tmpPath);
    const file = fs.createWriteStream(tmpPath);
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: DOWNLOAD_TIMEOUT_MS }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        safeUnlink(tmpPath);
        return resolve(false);
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        file.close();
        safeUnlink(tmpPath);
        return resolve(false);
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        try {
          fs.renameSync(tmpPath, destPath);
          resolve(true);
        } catch {
          safeUnlink(tmpPath);
          resolve(false);
        }
      });
    });
    req.on('error', () => {
      file.close();
      safeUnlink(tmpPath);
      resolve(false);
    });
    req.on('timeout', () => {
      req.destroy();
      file.close();
      safeUnlink(tmpPath);
      resolve(false);
    });
  });
}

function parseTargetSurahs() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const arg = args[0];
  if (!arg) {
    return Array.from({ length: TOTAL_SURAHS }, (_, i) => i + 1);
  }
  if (arg.includes('-')) {
    const [start, end] = arg.split('-').map(Number);
    if (isNaN(start) || isNaN(end) || start < 1 || end > TOTAL_SURAHS || start > end) {
      console.error('Invalid range. Use e.g. node build.js 1-10');
      process.exit(1);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }
  if (arg.includes(',')) {
    return arg.split(',').map(Number).filter(n => !isNaN(n) && n >= 1 && n <= TOTAL_SURAHS);
  }
  const num = parseInt(arg, 10);
  if (isNaN(num) || num < 1 || num > TOTAL_SURAHS) {
    console.error(`Invalid surah number. Use 1-${TOTAL_SURAHS}.`);
    process.exit(1);
  }
  return [num];
}

// =========================================================================
// Fetch: reciter list from alquran.cloud
// =========================================================================

async function getReciters() {
  const t0 = Date.now();
  console.log(`[${now()}] Fetching reciter list from alquran.cloud...`);
  const data = await fetchJSON(ALQURAN_CLOUD_EDITIONS);
  const editions = data.data || [];
  const seen = new Set();
  const reciters = [];
  for (const ed of editions) {
    if (ed.identifier.endsWith('-2')) continue;
    if (seen.has(ed.identifier)) continue;
    seen.add(ed.identifier);
    reciters.push(ed.identifier);
  }
  console.log(`[${now()}]   Found ${reciters.length} reciters (${elapsedStr(Date.now() - t0)})`);
  return reciters;
}

// =========================================================================
// Pre-fetch: surah-level metadata (revelation_order)
// =========================================================================

let chaptersCache = null;

async function getChapters() {
  if (chaptersCache) return chaptersCache;
  const t0 = Date.now();
  console.log(`[${now()}] Fetching surah metadata from islamic.app...`);
  const data = await fetchJSON(`${ISLAMIC_APP_BASE}/chapters`);
  const chapters = data.data.chapters;
  chaptersCache = {};
  for (const ch of chapters) {
    chaptersCache[ch.id] = ch;
  }
  console.log(`[${now()}]   Cached ${Object.keys(chaptersCache).length} surahs (${elapsedStr(Date.now() - t0)})`);
  return chaptersCache;
}

function buildRevelationOrderMap(chapters) {
  const map = {};
  for (const id of Object.keys(chapters)) {
    map[id] = chapters[id].revelation_order;
  }
  return map;
}

// =========================================================================
// Fetch: tafsir for a single surah
// =========================================================================

async function fetchTafsir(surahNumber) {
  const json = await fetchJSON(
    `${ISLAMIC_APP_BASE}/verses/by_chapter/${surahNumber}?tafsirs=en-tafsir-maarif-ul-quran,bn-tafsir-abu-bakr-zakaria`
  );
  const tafsirMap = {};
  for (const v of json.data.verses) {
    const vn = v.verse_number;
    let en = '', bn = '';
    for (const t of (v.tafsirs || [])) {
      if (t.slug === 'en-tafsir-maarif-ul-quran') en = t.text;
      else if (t.slug === 'bn-tafsir-abu-bakr-zakaria') bn = t.text;
    }
    tafsirMap[vn] = { en, bn };
  }
  return tafsirMap;
}

// =========================================================================
// Build: single surah
// =========================================================================

async function buildSurah(surahNumber, revelationOrder, reciters, downloadMedia) {
  const tStart = Date.now();

  const srcPath = path.join(SOURCE_DIR, `${surahNumber}.min.json`);
  if (!fs.existsSync(srcPath)) {
    console.error(`[${now()}]   Source file not found: ${srcPath}`);
    return false;
  }

  const srcData = JSON.parse(fs.readFileSync(srcPath, 'utf-8'));
  const verses = srcData.verses || [];

  console.log(`[${now()}]   Fetching tafsir...`);
  const tTaf = Date.now();
  let tafsirMap = {};
  try {
    tafsirMap = await fetchTafsir(surahNumber);
    console.log(`[${now()}]   Got tafsir for ${Object.keys(tafsirMap).length} verses (${elapsedStr(Date.now() - tTaf)})`);
  } catch (e) {
    console.warn(`[${now()}]   Tafsir fetch failed: ${e.message}. Proceeding without tafsir.`);
  }
  await sleep(REQUEST_DELAY_MS);

  const enhancedVerses = [];
  for (const v of verses) {
    const vNum = v.numberInSurah;
    const t = tafsirMap[vNum] || { en: '', bn: '' };

    const audio = {};
    for (const reciter of reciters) {
      audio[reciter] = {
        primary: `${ISLAMIC_NETWORK_AUDIO}/128/${reciter}/${vNum}.mp3`,
        secondary: `${ISLAMIC_NETWORK_AUDIO}/64/${reciter}/${vNum}.mp3`,
        tertiary: `${ISLAMIC_APP_AUDIO}/${reciter}/${vNum}.mp3`,
        local: `data/audio/${surahNumber}/${reciter}/${vNum}.mp3`,
      };
    }

    const image = {
      primary: `${ISLAMIC_NETWORK_IMAGE}/${surahNumber}_${vNum}.png`,
      secondary: `${ISLAMIC_NETWORK_IMAGE}/high-resolution/${surahNumber}_${vNum}.png`,
      local: `data/images/${surahNumber}/${vNum}.png`,
    };

    enhancedVerses.push({
      totalNumber: v.totalNumber,
      numberInSurah: vNum,
      juz: v.juz,
      sajda: {
        recommended: v.sajda.recommended,
        obligatory: v.sajda.obligatory,
      },
      text: {
        arText: v.text,
        enText: v.enText,
        enTextTransliteration: v.enTextTransliteration,
        bnText: v.bnText,
        bntextLatin: v.bntextLatin,
      },
      tafsir: {
        en: t.en,
        bn: t.bn,
      },
      audio,
      image,
    });
  }

  const surahOutput = {
    no: srcData.no,
    name: srcData.name,
    enName: srcData.enName,
    enNameTranslation: srcData.enNameTranslation,
    bnNameTranslation: srcData.bnNameTranslation,
    revelationType: srcData.revelationType,
    revelationOrder: revelationOrder,
    numberOfAyahs: srcData.numberOfAyahs,
    verses: enhancedVerses,
  };

  const outDir = path.join(OUTPUT_DIR);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, `${surahNumber}.json`);
  fs.writeFileSync(outPath, JSON.stringify(surahOutput, null, 2), 'utf-8');
  console.log(`[${now()}]   Written: ${path.basename(outPath)}`);

  // Download audio + images for local caching (best-effort).
  // Files land at project-root/{local-path} so the `local` field in JSON
  // matches the actual on-disk location relative to the project root.
  if (downloadMedia) {
    const tDl = Date.now();
    const totalAudio = verses.length * reciters.length;
    let dlAudio = 0;
    let dlImg = 0;
    console.log(`[${now()}]   Downloading media (${reciters.length} reciters × ${verses.length} verses = ${totalAudio} audio files + ${verses.length} images)...`);
    const projectRoot = path.resolve(__dirname, '..');

    for (const v of enhancedVerses) {
      const vNum = v.numberInSurah;

      for (const reciter of reciters) {
        const dest = path.join(projectRoot, v.audio[reciter].local);
        const sources = [v.audio[reciter].primary, v.audio[reciter].secondary, v.audio[reciter].tertiary];
        let downloaded = false;
        for (const src of sources) {
          if (downloaded) break;
          try {
            downloaded = await downloadFile(src, dest);
          } catch (_) {}
        }
        if (downloaded) dlAudio++;
      }

      const destImg = path.join(projectRoot, v.image.local);
      try {
        const ok = await downloadFile(v.image.primary.replace('http://', 'https://'), destImg);
        if (ok) dlImg++;
      } catch (_) {}
    }

    console.log(`[${now()}]   Download done: ${dlAudio}/${totalAudio} audio, ${dlImg}/${verses.length} images (${elapsedStr(Date.now() - tDl)})`);
  }

  console.log(`[${now()}]   Done (${elapsedStr(Date.now() - tStart)})`);
  return true;
}

// =========================================================================
// Main
// =========================================================================

async function main() {
  const scriptStart = Date.now();
  console.log(`[${now()}] === v4 Quran API Build Script ===\n`);

  const targetSurahs = parseTargetSurahs();
  const summary = targetSurahs.length === 114 ? 'all 114 surahs' :
    targetSurahs.length === 1 ? `surah ${targetSurahs[0]}` :
    `${targetSurahs.length} surahs (${targetSurahs[0]}-${targetSurahs[targetSurahs.length - 1]})`;
  console.log(`[${now()}] Target: ${summary}\n`);

  const downloadMedia = process.argv.includes('--download');
  if (downloadMedia) console.log(`[${now()}] Media download enabled (--download)\n`);

  const chapters = await getChapters();
  const revelationOrderMap = buildRevelationOrderMap(chapters);

  const reciters = await getReciters();
  console.log('');

  let success = 0;
  let failed = 0;

  for (let i = 0; i < targetSurahs.length; i++) {
    const surahNum = targetSurahs[i];
    const revelationOrder = revelationOrderMap[surahNum];
    if (revelationOrder === undefined) {
      console.warn(`[${now()}] Surah ${surahNum}: no revelation_order data, skipping`);
      failed++;
      continue;
    }

    const pct = targetSurahs.length > 1 ? ` (${((i + 1) / targetSurahs.length * 100).toFixed(0)}%)` : '';
    console.log(`[${now()}] [${i + 1}/${targetSurahs.length}]${pct} Building surah ${surahNum}...`);
    try {
      const ok = await buildSurah(surahNum, revelationOrder, reciters, downloadMedia);
      if (ok) success++; else failed++;
    } catch (e) {
      console.error(`[${now()}]   Failed: ${e.message}`);
      failed++;
    }

    if (i < targetSurahs.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  const totalTime = elapsedStr(Date.now() - scriptStart);
  const status = failed === 0 ? 'All succeeded' : `${success} succeeded, ${failed} failed`;
  console.log(`\n[${now()}] === Done! ${status} (${totalTime}) ===`);
}

main().catch(e => {
  console.error(`[${now()}] Fatal error:`, e);
  process.exit(1);
});
