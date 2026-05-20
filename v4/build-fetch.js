#!/usr/bin/env node

/**
 * v4/build-fetch.js
 *
 * Builds v4 Quran API dataset split into 4 categories:
 *   verse/ — text + metadata per surah
 *   image/ — image URLs per surah
 *   audio/{reciter}/ — audio URLs per reciter per surah
 *   tafsir/{lang}/{tafsir}/ — tafsir text per language/tafsir per surah
 *
 * Usage:
 *   node build-fetch.js
 *   node build-fetch.js -s 1
 *   node build-fetch.js -s 1-10
 *   node build-fetch.js -s 1,3-5,10
 *   node build-fetch.js -m min
 *   node build-fetch.js -m with-min
 *   node build-fetch.js -h
 */

'use strict';

const fs = require('fs');
const path = require('path');

// =========================================================================
// Configuration
// =========================================================================

const SOURCE_DIR             = path.resolve(__dirname, '..', 'source', 'surah');
const OUTPUT_DIR             = path.resolve(__dirname, 'surah');

const ISLAMIC_APP_BASE       = 'https://api.islamic.app/v1';
const ISLAMIC_NETWORK_AUDIO  = 'https://cdn.islamic.network/quran/audio';
const ISLAMIC_APP_AUDIO      = 'https://cdn.islamic.app/quran/audio';
const ISLAMIC_NETWORK_IMAGE  = 'http://cdn.islamic.network/quran/images';
const NHRIDOY_IMAGES         = 'https://cdn.jsdelivr.net/gh/nhridoy/quran-images@latest/by-verses';
const NHRIDOY_AUDIO_BASE     = 'https://cdn.jsdelivr.net/gh/nhridoy';

const TOTAL_SURAHS   = 114;
const REQUEST_DELAY  = 150;
const DOWNLOAD_TIMEOUT = 30000;

const ALQURAN_CLOUD_EDITIONS =
  'https://api.alquran.cloud/v1/edition?format=audio&language=ar&type=versebyverse';

// =========================================================================
// Tafsir configuration
// =========================================================================

const LANG_NAMES = {
  ar: 'Arabic',
  en: 'English',
  ur: 'Urdu',
  bn: 'Bengali',
  ru: 'Russian',
  ku: 'Kurdish',
};

const TAFSIRS = [
  { id: 'ar-tafsir-ibn-kathir',        lang: 'ar', authorName: 'Hafiz Ibn Kathir',           tafsirName: 'Tafsir Ibn Kathir (full Arabic)' },
  { id: 'ar-tafsir-al-tabari',          lang: 'ar', authorName: 'Al-Tabari',                  tafsirName: 'Jāmiʿ al-Bayān (Tafsir al-Tabari)' },
  { id: 'ar-tafseer-al-qurtubi',        lang: 'ar', authorName: 'Al-Qurtubi',                 tafsirName: 'Al-Jāmiʿ li-Aḥkām al-Qur\'ān' },
  { id: 'ar-tafseer-al-saddi',          lang: 'ar', authorName: 'As-Sa\'di',                  tafsirName: 'Taysīr al-Karīm al-Raḥmān' },
  { id: 'ar-tafsir-al-baghawi',         lang: 'ar', authorName: 'Al-Baghawi',                 tafsirName: 'Maʿālim al-Tanzīl' },
  { id: 'ar-tafsir-al-wasit',           lang: 'ar', authorName: 'M. S. Tantawi',              tafsirName: 'Al-Tafsir al-Wasit' },
  { id: 'ar-tafsir-muyassar',           lang: 'ar', authorName: 'Group of scholars',          tafsirName: 'Al-Tafsir al-Muyassar' },
  { id: 'en-tafisr-ibn-kathir',         lang: 'en', authorName: 'Hafiz Ibn Kathir',           tafsirName: 'Ibn Kathir (abridged English)' },
  { id: 'en-tafsir-maarif-ul-quran',    lang: 'en', authorName: 'Mufti Muhammad Shafi',       tafsirName: 'Ma\'arif al-Qur\'an' },
  { id: 'tafseer-ibn-e-kaseer-urdu',    lang: 'ur', authorName: 'Hafiz Ibn Kathir',           tafsirName: 'تفسیر ابن کثیر (Urdu)' },
  { id: 'tafsir-bayan-ul-quran',        lang: 'ur', authorName: 'Dr. Israr Ahmad',            tafsirName: 'Bayan ul Quran' },
  { id: 'tafsir-fe-zalul-quran-syed-qatab', lang: 'ur', authorName: 'Sayyid Qutb',            tafsirName: 'Fi Zilal al-Quran (Urdu)' },
  { id: 'bn-tafsir-ahsanul-bayaan',     lang: 'bn', authorName: 'Bayaan Foundation',          tafsirName: 'Tafsir Ahsanul Bayaan' },
  { id: 'bn-tafsir-abu-bakr-zakaria',   lang: 'bn', authorName: 'Dr. Abu Bakr Zakaria',       tafsirName: 'Tafsir (KFQPC)' },
  { id: 'bn-tafseer-ibn-e-kaseer',      lang: 'bn', authorName: 'Tawheed Publication',        tafsirName: 'Ibn Kathir (Bengali)' },
  { id: 'tafisr-fathul-majid-bn',       lang: 'bn', authorName: 'AbdulRahman Al-Alshaikh',    tafsirName: 'Tafsir Fathul Majid' },
  { id: 'ru-tafseer-al-saddi',          lang: 'ru', authorName: 'As-Sa\'di',                  tafsirName: 'As-Sa\'di' },
  { id: 'kurd-tafsir-rebar',            lang: 'ku', authorName: 'As-Sa\'di',                  tafsirName: 'Rebar Kurdish Tafsir' },
];

// =========================================================================
// Surah → range mapping for alternative audio URLs
// =========================================================================

const SURAH_RANGES = [
  [1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12], [13, 16], [17, 19],
  [20, 22], [23, 25], [26, 27], [28, 33], [34, 37], [38, 42], [43, 50],
  [51, 55], [56, 70], [71, 80], [81, 114],
];

function getAudioRange(surahNo) {
  for (const [start, end] of SURAH_RANGES) {
    if (surahNo >= start && surahNo <= end) return `${start}-${end}`;
  }
  return null;
}

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
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

${B('OUTPUT STRUCTURE')}
  ${Y('v4/surah/verse/{n}.json')}        — verse text + metadata
  ${Y('v4/surah/image/{n}.json')}        — verse image URLs
  ${Y('v4/surah/audio/{reciter}/{n}.json')}  — verse audio URLs per reciter
  ${Y('v4/surah/tafsir/{lang}/{id}/{n}.json')} — tafsir text per tafsir

${B('DOWNLOAD PATHS')}
  Audio files are saved to: ${Y('v4/data/audio/{surah}/{reciter}/{verseNumber}.mp3')}
  Image files are saved to: ${Y('v4/data/images/{surah}/{verseNumber}.png')}
  Verse number in download paths is the number-in-surah.

${B('EXAMPLES')}
  ${G('node build-fetch.js')}                              Build all 114 surahs (pretty JSON)
  ${G('node build-fetch.js')} ${C('-s')} ${Y('1')}                         Build surah 1 only
  ${G('node build-fetch.js')} ${C('-s')} ${Y('1-10')}                      Build surahs 1 through 10
  ${G('node build-fetch.js')} ${C('-d')} ${Y('download')}                 Build all + download media
  ${G('node build-fetch.js')} ${C('-m')} ${Y('with-min')} ${C('-d')} ${Y('download')}  All, both formats + media
  ${G('node build-fetch.js')} ${C('-d')} ${Y('only-download')} ${C('-s')} ${Y('1-5')}     Download media for 1–5 only
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
// Fetch: tafsirs one by one for a single surah
// =========================================================================

async function fetchAllTafsirs(surahNumber) {
  const t0 = Date.now();
  const slugMap = {};
  for (const t of TAFSIRS) slugMap[t.id] = {};

  for (let ti = 0; ti < TAFSIRS.length; ti++) {
    const t = TAFSIRS[ti];
    try {
      const json = await fetchJSON(
        `${ISLAMIC_APP_BASE}/verses/by_chapter/${surahNumber}?tafsirs=${t.id}`
      );
      for (const v of json.data.verses) {
        const vn = Number.parseInt(v.verse_key.split(':')[1], 10);
        for (const tv of (v.tafsirs || [])) {
          if (tv.slug === t.id) {
            slugMap[t.id][vn] = tv.text ?? '';
          }
        }
      }
      if (ti < TAFSIRS.length - 1) await sleep(REQUEST_DELAY);
    } catch (e) {
      console.warn(`[${now()}]     ⚠ Tafsir ${t.id} failed: ${e.message}`);
    }
  }

  let totalVerses = 0;
  for (const sid of Object.keys(slugMap)) {
    totalVerses = Math.max(totalVerses, Object.keys(slugMap[sid]).length);
  }
  console.log(`[${now()}]     → ~${totalVerses} verses across ${TAFSIRS.length} tafsirs fetched (${elapsed(Date.now()-t0)})`);
  return slugMap;
}

// =========================================================================
// Download media for a surah (uses numberInSurah for local file names)
// =========================================================================

async function downloadSurahMedia(verses, surahNumber, reciters, mediaFilter) {
  const tDl = Date.now();
  const totalAudio = mediaFilter === 'only-image' ? 0 : verses.length * reciters.length;
  const totalImages = mediaFilter === 'only-audio' ? 0 : verses.length;
  let dlA = 0, dlI = 0;

  for (const v of verses) {
    if (mediaFilter !== 'only-image') {
      for (const r of reciters) {
        const dest = path.join(OUTPUT_DIR, '..', 'data', 'audio', `${surahNumber}`, r, `${v.numberInSurah}.mp3`);
        const srcs = [
          `${ISLAMIC_NETWORK_AUDIO}/128/${r}/${v.totalNumber}.mp3`,
          `${ISLAMIC_NETWORK_AUDIO}/64/${r}/${v.totalNumber}.mp3`,
          `${ISLAMIC_APP_AUDIO}/${r}/${v.totalNumber}.mp3`,
        ];
        for (const s of srcs) { if (await downloadFile(s, dest)) { dlA++; break; } }
      }
    }
    if (mediaFilter !== 'only-audio') {
      const dest = path.join(OUTPUT_DIR, '..', 'data', 'images', `${surahNumber}`, `${v.numberInSurah}.png`);
      if (await downloadFile(
        `${ISLAMIC_NETWORK_IMAGE}/${surahNumber}_${v.numberInSurah}.png`.replace('http://', 'https://'),
        dest
      )) dlI++;
    }
  }

  const audioPct = totalAudio > 0 ? ` (${(dlA/totalAudio*100).toFixed(0)}%)` : '';
  const imgPct = totalImages > 0 ? ` (${(dlI/totalImages*100).toFixed(0)}%)` : '';
  console.log(`[${now()}]     → Audio: ${dlA}/${totalAudio}${audioPct} | Images: ${dlI}/${totalImages}${imgPct} (${elapsed(Date.now()-tDl)})`);
}

// =========================================================================
// Build surah header (shared across all 4 output types)
// =========================================================================

function surahHeader(srcData, revelationOrder) {
  return {
    no: srcData.no,
    name: srcData.name,
    enName: srcData.enName,
    enNameTranslation: srcData.enNameTranslation,
    bnNameTranslation: srcData.bnNameTranslation,
    revelationType: srcData.revelationType,
    revelationOrder,
    numberOfAyahs: srcData.numberOfAyahs,
  };
}

// =========================================================================
// Build & write: verse file
// =========================================================================

function buildVerseData(srcData, revelationOrder) {
  const header = surahHeader(srcData, revelationOrder);
  header.verses = (srcData.verses || []).map(v => ({
    totalNumber: v.totalNumber,
    numberInSurah: v.numberInSurah,
    juz: v.juz,
    sajda: { recommended: v.sajda.recommended, obligatory: v.sajda.obligatory },
    text: {
      arText: v.text,
      enText: v.enText,
      enTextTransliteration: v.enTextTransliteration,
      bnText: v.bnText,
      bntextLatin: v.bntextLatin,
    },
  }));
  return header;
}

// =========================================================================
// Build & write: image file
// =========================================================================

function buildImageData(srcData, revelationOrder, surahNumber) {
  const header = surahHeader(srcData, revelationOrder);
  header.verses = (srcData.verses || []).map(v => ({
    totalNumber: v.totalNumber,
    numberInSurah: v.numberInSurah,
    juz: v.juz,
    image: {
      primary:          `${ISLAMIC_NETWORK_IMAGE}/${surahNumber}_${v.numberInSurah}.png`,
      secondary:        `${ISLAMIC_NETWORK_IMAGE}/high-resolution/${surahNumber}_${v.numberInSurah}.png`,
      alternative:      `${NHRIDOY_IMAGES}/low-resolution/${surahNumber}/${v.numberInSurah}.png`,
      'alternative-high': `${NHRIDOY_IMAGES}/high-resolution/${surahNumber}/${v.numberInSurah}.png`,
    },
  }));
  return header;
}

// =========================================================================
// Build & write: audio file (single reciter)
// =========================================================================

function buildAudioData(srcData, revelationOrder, surahNumber, reciter) {
  const range = getAudioRange(surahNumber);
  const header = surahHeader(srcData, revelationOrder);
  header.verses = (srcData.verses || []).map(v => {
    const audio = {
      primary:   `${ISLAMIC_NETWORK_AUDIO}/128/${reciter}/${v.totalNumber}.mp3`,
      secondary: `${ISLAMIC_NETWORK_AUDIO}/64/${reciter}/${v.totalNumber}.mp3`,
      tertiary:  `${ISLAMIC_APP_AUDIO}/${reciter}/${v.totalNumber}.mp3`,
    };
    if (range) {
      audio.alternative = `${NHRIDOY_AUDIO_BASE}/${range}@main/${surahNumber}/${reciter}/${v.numberInSurah}.mp3`;
    }
    return {
      totalNumber: v.totalNumber,
      numberInSurah: v.numberInSurah,
      juz: v.juz,
      audio,
    };
  });
  return header;
}

// =========================================================================
// Build & write: tafsir file (single tafsir)
// =========================================================================

function buildTafsirData(srcData, revelationOrder, tafsirConfig, verseTafsirMap) {
  const header = surahHeader(srcData, revelationOrder);
  const langName = LANG_NAMES[tafsirConfig.lang] || tafsirConfig.lang;
  header.verses = (srcData.verses || []).map(v => ({
    totalNumber: v.totalNumber,
    numberInSurah: v.numberInSurah,
    juz: v.juz,
    lang: langName,
    authorName: tafsirConfig.authorName,
    tafsirName: tafsirConfig.tafsirName,
    tafsir: verseTafsirMap[v.numberInSurah] || '',
  }));
  return header;
}

// =========================================================================
// Write output files for all 4 categories
// =========================================================================

function writeSurahOutputs(surahNumber, verseData, imageData, audioDataList, tafsirDataList, minifyMode) {
  const baseDir = OUTPUT_DIR;

  // verse
  const verseDir = path.join(baseDir, 'verse');
  if (minifyMode !== 'min') {
    writeJSON(path.join(verseDir, `${surahNumber}.json`), verseData, false);
  }
  if (minifyMode !== null) {
    writeJSON(path.join(verseDir, `${surahNumber}.min.json`), verseData, true);
  }

  // image
  const imageDir = path.join(baseDir, 'image');
  if (minifyMode !== 'min') {
    writeJSON(path.join(imageDir, `${surahNumber}.json`), imageData, false);
  }
  if (minifyMode !== null) {
    writeJSON(path.join(imageDir, `${surahNumber}.min.json`), imageData, true);
  }

  // audio (one dir per reciter)
  let audioCount = 0;
  for (const [reciter, data] of audioDataList) {
    const audioDir = path.join(baseDir, 'audio', reciter);
    if (minifyMode !== 'min') {
      writeJSON(path.join(audioDir, `${surahNumber}.json`), data, false);
      audioCount++;
    }
    if (minifyMode !== null) {
      writeJSON(path.join(audioDir, `${surahNumber}.min.json`), data, true);
    }
  }

  // tafsir (one dir per lang/tafsir)
  let tafsirCount = 0;
  for (const [tafsirId, data] of tafsirDataList) {
    const tc = TAFSIRS.find(t => t.id === tafsirId);
    const tafsirDir = path.join(baseDir, 'tafsir', tc.lang, tafsirId);
    if (minifyMode !== 'min') {
      writeJSON(path.join(tafsirDir, `${surahNumber}.json`), data, false);
      tafsirCount++;
    }
    if (minifyMode !== null) {
      writeJSON(path.join(tafsirDir, `${surahNumber}.min.json`), data, true);
    }
  }

  console.log(`[${now()}]     → verse, image, ${audioCount} audio, ${tafsirCount} tafsir files written`);
}

// =========================================================================
// Download-only: read existing JSON and download media
// =========================================================================

async function downloadOnlySurah(surahNumber, reciters, mediaFilter) {
  const verseDir = path.join(OUTPUT_DIR, 'verse');
  const jsonPath = path.join(verseDir, `${surahNumber}.json`);
  const minPath = path.join(verseDir, `${surahNumber}.min.json`);
  const foundPath = fs.existsSync(jsonPath) ? jsonPath : fs.existsSync(minPath) ? minPath : null;
  if (!foundPath) {
    console.log(`[${now()}]     ⚠ verse/${surahNumber}.json not found — build it first`);
    return false;
  }
  const data = JSON.parse(fs.readFileSync(foundPath, 'utf-8'));
  const verses = data.verses || [];
  const enName = data.enName || '';
  console.log(`[${now()}]     Downloading media for ${verses.length} verses...`);
  await downloadSurahMedia(verses, surahNumber, reciters, mediaFilter);
  console.log(`[${now()}]     ✓ ${enName} media complete`);
  return true;
}

// =========================================================================
// Build: single surah (all categories)
// =========================================================================

async function buildSurah(surahNumber, revelationOrder, reciters, minifyMode, downloadMode) {
  const srcPath = path.join(SOURCE_DIR, `${surahNumber}.min.json`);
  if (!fs.existsSync(srcPath)) { console.error(`[${now()}]     ✗ Source not found`); return false; }
  const srcData = JSON.parse(fs.readFileSync(srcPath, 'utf-8'));
  const label = srcData.enName;

  // Fetch all tafsirs one by one
  console.log(`[${now()}]     Fetching tafsirs (${TAFSIRS.length} total)...`);
  let tafsirSlugMap = {};
  try {
    tafsirSlugMap = await fetchAllTafsirs(surahNumber);
  } catch (e) {
    console.warn(`[${now()}]     ⚠ Tafsir fetch failed: ${e.message}`);
  }

  // Build verse data
  const verseData = buildVerseData(srcData, revelationOrder);

  // Build image data
  const imageData = buildImageData(srcData, revelationOrder, surahNumber);

  // Build audio data (one per reciter)
  const audioDataList = reciters.map(r => [r, buildAudioData(srcData, revelationOrder, surahNumber, r)]);

  // Build tafsir data (one per tafsir)
  const tafsirDataList = TAFSIRS.map(tc => {
    const verseMap = tafsirSlugMap[tc.id] || {};
    return [tc.id, buildTafsirData(srcData, revelationOrder, tc, verseMap)];
  });

  // Write all outputs
  writeSurahOutputs(surahNumber, verseData, imageData, audioDataList, tafsirDataList, minifyMode);

  // Download media if requested
  if (downloadMode === 'download') {
    console.log(`[${now()}]     Downloading media...`);
    await downloadSurahMedia(verseData.verses, surahNumber, reciters, null);
  }

  console.log(`[${now()}]     ✓ ${label} complete`);
  return true;
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
  console.log(`  Output categories:`);
  console.log(`    verse/     – text + metadata`);
  console.log(`    image/     – image URLs`);
  console.log(`    audio/     – audio URLs per reciter (${TAFSIRS.length} tafsirs × reciters)`);
  console.log(`    tafsir/    – tafsir text (${TAFSIRS.length} tafsirs across 6 languages)\n`);

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
        result = await downloadOnlySurah(sn, reciters, downloadMode);
      } else {
        result = await buildSurah(sn, ro, reciters, minifyMode, downloadMode);
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
