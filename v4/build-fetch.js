#!/usr/bin/env node

/**
 * v4/build-fetch.js
 *
 * Builds the v4 Quran API dataset by enhancing source/surah data with:
 *   - revelation_order (from islamic.app)
 *   - tafsir (from islamic.app, English + Bengali)
 *   - Multi-reciter audio URLs (islamic.network + islamic.app)
 *   - Verse image URLs (islamic.network)
 *
 * Usage:
 *   node build-fetch.js
 *   node build-fetch.js -s 1
 *   node build-fetch.js -s 1-10
 *   node build-fetch.js -s 1,3-5,10
 *   node build-fetch.js -d download
 *   node build-fetch.js -d only-download -s 1
 *   node build-fetch.js -m min
 *   node build-fetch.js -m with-min -d download
 *   node build-fetch.js -h
 */

'use strict';

const fs = require('fs');
const path = require('path');

// =========================================================================
// Configuration
// =========================================================================

const SOURCE_DIR     = path.resolve(__dirname, '..', 'source', 'surah');
const OUTPUT_DIR     = path.resolve(__dirname, 'surah');

const ISLAMIC_APP_BASE       = 'https://api.islamic.app/v1';
const ISLAMIC_NETWORK_AUDIO  = 'https://cdn.islamic.network/quran/audio';
const ISLAMIC_APP_AUDIO      = 'https://cdn.islamic.app/quran/audio';
const ISLAMIC_NETWORK_IMAGE  = 'http://cdn.islamic.network/quran/images';

const TOTAL_SURAHS   = 114;
const REQUEST_DELAY  = 150;
const DOWNLOAD_TIMEOUT = 30000;

const ALQURAN_CLOUD_EDITIONS =
  'https://api.alquran.cloud/v1/edition?format=audio&language=ar&type=versebyverse';

// =========================================================================
// Helpers
// =========================================================================

const sleep   = ms => new Promise(r => setTimeout(r, ms));
const now     = () => { const d = new Date(); return d.toLocaleTimeString('en-US',{hour12:false})+'.'+String(d.getMilliseconds()).padStart(3,'0'); };
const elapsed = ms => ms < 1000 ? `${ms}ms` : ms < 60000 ? `${(ms/1000).toFixed(1)}s` : `${Math.floor(ms/60000)}m ${((ms%60000)/1000).toFixed(0)}s`;

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

async function downloadFile(url, destPath) {
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmpPath = destPath + '.tmp';
  safeUnlink(tmpPath);
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT) });
  } catch { safeUnlink(tmpPath); return false; }
  if (!res.ok) { safeUnlink(tmpPath); return false; }
  try {
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(tmpPath, buf);
    fs.renameSync(tmpPath, destPath);
    return true;
  } catch { safeUnlink(tmpPath); return false; }
}

function safeUnlink(p) { try { fs.unlinkSync(p); } catch {} }

function writeJSON(filePath, data, minify) {
  const json = minify ? JSON.stringify(data) : JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, json, 'utf-8');
}

// =========================================================================
// CLI argument parser
// =========================================================================

function showHelp() {
  const B = s => `\x1b[1m${s}\x1b[22m`;
  const C = s => `\x1b[36m${s}\x1b[39m`;
  const G = s => `\x1b[32m${s}\x1b[39m`;
  const Y = s => `\x1b[33m${s}\x1b[39m`;

  console.log(`
${B('v4/build-fetch.js')} — Quran API dataset builder

${B('SYNOPSIS')}
  ${G('node build-fetch.js')} [${C('-s')} ${Y('<surah>')}] [${C('-d')} ${Y('<mode>')}] [${C('-m')} ${Y('<mode>')}] [${C('-h')}]

${B('FLAGS')}

  ${C('-h')}
      Show this help message and exit.

  ${C('-s')} ${Y('<surah>')}
      Which surah(s) to build. Can be:
        ${Y('1')}            Single surah
        ${Y('1-10')}         Range of surahs
        ${Y('1,3,5')}        Comma-separated list
        ${Y('1-5,10-15')}    Mixed ranges and singles
        ${Y('(empty)')}       All 114 surahs
      Each number must be between 1–114.

  ${C('-d')} ${Y('<mode>')}
      Media download mode:
        ${Y('download')}        Build JSON + download audio + images
        ${Y('only-download')}   Download audio + images only (JSON must exist)
        ${Y('only-audio')}      Download audio only (JSON must exist)
        ${Y('only-image')}      Download images only (JSON must exist)
        ${Y('(flag absent)')}   Build JSON only, no downloads

  ${C('-m')} ${Y('<mode>')}
      Output JSON format:
        ${Y('min')}             Write minified JSON (${B('1.min.json')})
        ${Y('with-min')}        Write both pretty and minified JSON
        ${Y('(flag absent)')}   Write pretty JSON only (${B('1.json')})

${B('EXAMPLES')}
  ${G('node build-fetch.js')}                              Build all 114 surahs (pretty JSON)
  ${G('node build-fetch.js')} ${C('-s')} ${Y('1')}                         Build surah 1 only
  ${G('node build-fetch.js')} ${C('-s')} ${Y('1-10')}                      Build surahs 1 through 10
  ${G('node build-fetch.js')} ${C('-s')} ${Y('1,3-5,10')} ${C('-d')} ${Y('download')}      Build + download for selected surahs
  ${G('node build-fetch.js')} ${C('-m')} ${Y('with-min')} ${C('-d')} ${Y('download')}       Build all with both formats + media
  ${G('node build-fetch.js')} ${C('-d')} ${Y('only-download')} ${C('-s')} ${Y('1-5')}        Download media for surahs 1–5 only
`);
  process.exit(0);
}

function parseSurahSpec(spec) {
  const nums = new Set();
  const parts = spec.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [rawStart, rawEnd] = trimmed.split('-').map(s => parseInt(s, 10));
      if (Number.isNaN(rawStart) || Number.isNaN(rawEnd)) return null;
      if (rawStart < 1 || rawEnd > TOTAL_SURAHS || rawStart > rawEnd) return null;
      for (let i = rawStart; i <= rawEnd; i++) nums.add(i);
    } else {
      const n = Number.parseInt(trimmed, 10);
      if (Number.isNaN(n) || n < 1 || n > TOTAL_SURAHS) return null;
      nums.add(n);
    }
  }
  return [...nums].sort((a, b) => a - b);
}

function parseArgs() {
  const raw = process.argv.slice(2);

  if (raw.includes('-h')) showHelp();

  let surahArg = null;
  let downloadMode = null;
  let minifyMode = null;

  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a.startsWith('--')) continue;
    if (a === '-s') {
      surahArg = raw[++i];
      if (!surahArg) { console.error('-s requires a value'); process.exit(1); }
    } else if (a === '-d') {
      downloadMode = raw[++i];
      if (!downloadMode) { console.error('-d requires a value'); process.exit(1); }
      if (!['download', 'only-download', 'only-audio', 'only-image'].includes(downloadMode)) {
        console.error("-d must be 'download', 'only-download', 'only-audio', or 'only-image'"); process.exit(1);
      }
    } else if (a === '-m') {
      minifyMode = raw[++i];
      if (!minifyMode) { console.error('-m requires a value'); process.exit(1); }
      if (!['min', 'with-min'].includes(minifyMode)) {
        console.error("-m must be 'min' or 'with-min'"); process.exit(1);
      }
    }
  }

  // Parse surahs
  let surahs;
  if (surahArg) {
    surahs = parseSurahSpec(surahArg);
    if (!surahs || surahs.length === 0) {
      console.error('Invalid -s value. Use numbers 1-114, ranges (1-10), or comma-separated.');
      process.exit(1);
    }
  } else {
    surahs = Array.from({ length: TOTAL_SURAHS }, (_, i) => i + 1);
  }

  return { surahs, downloadMode, minifyMode };
}

// =========================================================================
// Pre-fetch: reciters
// =========================================================================

async function getReciters() {
  const t0 = Date.now();
  console.log(`[${now()}] Fetching reciter list...`);
  const json = await fetchJSON(ALQURAN_CLOUD_EDITIONS);
  const editions = json.data || [];
  const seen = new Set();
  const reciters = [];
  for (const ed of editions) {
    if (ed.identifier.endsWith('-2')) continue;
    if (seen.has(ed.identifier)) continue;
    seen.add(ed.identifier);
    reciters.push(ed.identifier);
  }
  console.log(`[${now()}]   → ${reciters.length} unique reciters (${elapsed(Date.now()-t0)})`);
  return reciters;
}

// =========================================================================
// Pre-fetch: chapters
// =========================================================================

let chaptersCache = null;

async function getChapters() {
  if (chaptersCache) return chaptersCache;
  const t0 = Date.now();
  console.log(`[${now()}] Fetching surah metadata from islamic.app...`);
  const json = await fetchJSON(`${ISLAMIC_APP_BASE}/chapters`);
  chaptersCache = {};
  for (const ch of json.data.chapters) chaptersCache[ch.id] = ch;
  console.log(`[${now()}]   → ${Object.keys(chaptersCache).length} surahs cached (${elapsed(Date.now()-t0)})`);
  return chaptersCache;
}

function buildRevelationOrderMap(chapters) {
  const m = {};
  for (const id of Object.keys(chapters)) m[id] = chapters[id].revelation_order;
  return m;
}

// =========================================================================
// Fetch: tafsir for a single surah
// =========================================================================

async function fetchTafsir(surahNumber) {
  const t0 = Date.now();
  const json = await fetchJSON(
    `${ISLAMIC_APP_BASE}/verses/by_chapter/${surahNumber}?tafsirs=en-tafsir-maarif-ul-quran,bn-tafsir-abu-bakr-zakaria`
  );
  const map = {};
  for (const v of json.data.verses) {
    const vk = v.verse_key; // "114:1" (surah_number:verse_number)
    const vn = Number.parseInt(vk.split(':')[1], 10); // verse_number
    let en = '', bn = '';
    for (const t of (v.tafsirs||[])) {
      if (t.slug === 'en-tafsir-maarif-ul-quran') en = t.text ?? "";
      else if (t.slug === 'bn-tafsir-abu-bakr-zakaria') bn = t.text ?? "";
    }
    map[vn] = { en, bn };
  }
  console.log(`[${now()}]     → ${Object.keys(map).length} verses tafsir fetched (${elapsed(Date.now()-t0)})`);
  return map;
}

// =========================================================================
// Build enhanced verse data (shared between build & download-only)
// =========================================================================

function buildEnhancedVerses(srcData, surahNumber, reciters, tafsirMap) {
  const verses = srcData.verses || [];
  const enhanced = [];
  for (const v of verses) {
    const vn = v.numberInSurah;
    const t = (tafsirMap?.[vn]) || { en: '', bn: '' };

    const audio = {};
    for (const r of reciters) {
      audio[r] = {
        primary:   `${ISLAMIC_NETWORK_AUDIO}/128/${r}/${vn}.mp3`,
        secondary: `${ISLAMIC_NETWORK_AUDIO}/64/${r}/${vn}.mp3`,
        tertiary:  `${ISLAMIC_APP_AUDIO}/${r}/${vn}.mp3`,
        local:     `data/audio/${surahNumber}/${r}/${vn}.mp3`,
      };
    }

    enhanced.push({
      totalNumber: v.totalNumber,
      numberInSurah: vn,
      juz: v.juz,
      sajda: { recommended: v.sajda.recommended, obligatory: v.sajda.obligatory },
      text: {
        arText: v.text,
        enText: v.enText,
        enTextTransliteration: v.enTextTransliteration,
        bnText: v.bnText,
        bntextLatin: v.bntextLatin,
      },
      tafsir: { en: t.en, bn: t.bn },
      audio,
      image: {
        primary:   `${ISLAMIC_NETWORK_IMAGE}/${surahNumber}_${vn}.png`,
        secondary: `${ISLAMIC_NETWORK_IMAGE}/high-resolution/${surahNumber}_${vn}.png`,
        local:     `data/images/${surahNumber}/${vn}.png`,
      },
    });
  }
  return { enhanced, verses };
}

// =========================================================================
// Download media for a surah
// =========================================================================

async function downloadSurahMedia(enhancedVerses, surahNumber, reciters, mediaFilter) {
  const tDl = Date.now();
  const totalAudio = mediaFilter === 'only-image' ? 0 : enhancedVerses.length * reciters.length;
  const totalImages = mediaFilter === 'only-audio' ? 0 : enhancedVerses.length;
  let dlA = 0, dlI = 0;
  const root = path.resolve(__dirname, '..');

  for (const v of enhancedVerses) {
    if (mediaFilter !== 'only-image') {
      for (const r of reciters) {
        const dest = path.join(root, v.audio[r].local);
        const srcs = [v.audio[r].primary, v.audio[r].secondary, v.audio[r].tertiary];
        for (const s of srcs) { if (await downloadFile(s, dest)) { dlA++; break; } }
      }
    }
    if (mediaFilter !== 'only-audio') {
      const destImg = path.join(root, v.image.local);
      if (await downloadFile(v.image.primary.replace('http://','https://'), destImg)) dlI++;
    }
  }

  const audioPct = totalAudio > 0 ? ` (${(dlA/totalAudio*100).toFixed(0)}%)` : '';
  const imgPct = totalImages > 0 ? ` (${(dlI/totalImages*100).toFixed(0)}%)` : '';
  console.log(`[${now()}]     → Audio: ${dlA}/${totalAudio}${audioPct} | Images: ${dlI}/${totalImages}${imgPct} (${elapsed(Date.now()-tDl)})`);
}

// =========================================================================
// Build: single surah (JSON only)
// =========================================================================

async function buildSurahJSON(surahNumber, revelationOrder, reciters, minifyMode) {
  const srcPath = path.join(SOURCE_DIR, `${surahNumber}.min.json`);
  if (!fs.existsSync(srcPath)) { console.error(`[${now()}]     ✗ Source not found`); return false; }
  const srcData = JSON.parse(fs.readFileSync(srcPath, 'utf-8'));
  const label = srcData.enName;

  console.log(`[${now()}]     Fetching tafsir...`);
  let tafsirMap = {};
  try {
    tafsirMap = await fetchTafsir(surahNumber);
  } catch (e) {
    console.warn(`[${now()}]     ⚠ Tafsir failed: ${e.message}`);
  }
  await sleep(REQUEST_DELAY);

  const { enhanced } = buildEnhancedVerses(srcData, surahNumber, reciters, tafsirMap);

  const surahOutput = {
    no: srcData.no,
    name: srcData.name,
    enName: srcData.enName,
    enNameTranslation: srcData.enNameTranslation,
    bnNameTranslation: srcData.bnNameTranslation,
    revelationType: srcData.revelationType,
    revelationOrder,
    numberOfAyahs: srcData.numberOfAyahs,
    verses: enhanced,
  };

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  if (minifyMode !== 'min') {
    writeJSON(path.join(OUTPUT_DIR, `${surahNumber}.json`), surahOutput, false);
    console.log(`[${now()}]     → Wrote ${surahNumber}.json`);
  }
  if (minifyMode !== null) {
    writeJSON(path.join(OUTPUT_DIR, `${surahNumber}.min.json`), surahOutput, true);
    console.log(`[${now()}]     → Wrote ${surahNumber}.min.json`);
  }

  console.log(`[${now()}]     ✓ ${label} complete`);
  return { enhanced, versesCount: enhanced.length };
}

// =========================================================================
// Build: single surah (download only)
// =========================================================================

async function downloadOnlySurahMedia(surahNumber, reciters, mediaFilter) {
  const jsonPath = path.join(OUTPUT_DIR, `${surahNumber}.json`);
  const minJsonPath = path.join(OUTPUT_DIR, `${surahNumber}.min.json`);
  const foundPath = fs.existsSync(jsonPath) ? jsonPath : fs.existsSync(minJsonPath) ? minJsonPath : null;
  if (!foundPath) {
    console.log(`[${now()}]     ⚠ v4/surah/${surahNumber}.json not found — build it first with -d download`);
    return false;
  }
  const data = JSON.parse(fs.readFileSync(foundPath, 'utf-8'));
  const verses = data.verses || [];
  const enName = data.enName || '';
  console.log(`[${now()}]     Downloading media for ${verses.length} verses (from ${path.basename(foundPath)})...`);
  await downloadSurahMedia(verses, surahNumber, reciters, mediaFilter);
  console.log(`[${now()}]     ✓ ${enName} media complete`);
  return true;
}

// =========================================================================
// Build: single surah (JSON + download)
// =========================================================================

async function buildAndDownloadSurah(surahNumber, revelationOrder, reciters, minifyMode) {
  const result = await buildSurahJSON(surahNumber, revelationOrder, reciters, minifyMode);
  if (result) await downloadSurahMedia(result.enhanced, surahNumber, reciters, null);
  return !!result;
}

// =========================================================================
// Main
// =========================================================================

async function main() {
  const scriptStart = Date.now();
  const { surahs, downloadMode, minifyMode } = parseArgs();

  const modeLabel = downloadMode === 'only-download' ? 'Download audio + images (JSON must exist)' :
    downloadMode === 'only-audio' ? 'Download audio only (JSON must exist)' :
    downloadMode === 'only-image' ? 'Download images only (JSON must exist)' :
    downloadMode === 'download' ? 'Build JSON + download media' :
    'Build JSON only';
  const minLabel = minifyMode === null ? 'Pretty JSON' :
    minifyMode === 'min' ? 'Minified JSON only' :
    'Pretty + minified JSON';

  const total = `${surahs.length} surah${surahs.length > 1 ? 's' : ''}`;
  const range = surahs.length === 114 ? 'all' :
    surahs.length === 1 ? `${surahs[0]}` :
    `${surahs[0]}–${surahs.at(-1)} (${surahs.length})`;

  console.log(`\n  ╔══════════════════════════════════════════╗`);
  console.log(`  ║        v4 Quran API — Build Script       ║`);
  console.log(`  ╚══════════════════════════════════════════╝\n`);
  console.log(`  Surahs:  ${total} (${range})`);
  console.log(`  Mode:    ${modeLabel}`);
  console.log(`  Format:  ${minLabel}\n`);

  // Pre-fetch phase
  const chapters = await getChapters();
  const orderMap = buildRevelationOrderMap(chapters);
  const reciters = await getReciters();
  console.log('');

  let ok = 0, fail = 0;

  for (let i = 0; i < surahs.length; i++) {
    const sn = surahs[i];
    const ro = orderMap[sn];
    if (ro === undefined) { console.warn(`  ✗ Surah ${sn}: no revelation order data, skip`); fail++; continue; }

    const pct = surahs.length > 1 ? ` (${((i+1)/surahs.length*100).toFixed(0)}%)` : '';
    console.log(`  ── [${i+1}/${surahs.length}]${pct} Surah ${sn} ──`);

    try {
      let result = false;
      const tSurah = Date.now();

      if (downloadMode === 'only-download' || downloadMode === 'only-audio' || downloadMode === 'only-image') {
        result = await downloadOnlySurahMedia(sn, reciters, downloadMode);
      } else if (downloadMode === 'download') {
        result = await buildAndDownloadSurah(sn, ro, reciters, minifyMode);
      } else {
        result = await buildSurahJSON(sn, ro, reciters, minifyMode);
      }

      if (result) ok++; else fail++;
      console.log(`[${now()}]   ⏱ ${elapsed(Date.now()-tSurah)}\n`);
    } catch (e) { console.error(`  ✗ ${e.message}`); fail++; }

    if (i < surahs.length - 1) await sleep(REQUEST_DELAY);
  }

  const totalTime = elapsed(Date.now()-scriptStart);
  const status = fail === 0 ? '✓ All succeeded' : `${ok} OK, ${fail} failed`;
  console.log(`  ╔══════════════════════════════════════════╗`);
  console.log(`  ║  Done! ${status.padEnd(31)}║`);
  console.log(`  ║  ${totalTime.padEnd(41)}║`);
  console.log(`  ╚══════════════════════════════════════════╝\n`);
}

main().catch(e => { console.error(`Fatal:`, e); process.exit(1); });
