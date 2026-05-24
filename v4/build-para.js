#!/usr/bin/env node

/**
 * v4/build-para.js
 *
 * Builds v4 juz API dataset by grouping existing v4/surah/ data by juz.
 *
 * Each juz can span multiple surahs, so each output file is a JSON object
 * with metadata (juzNumber, verseMapping, totalVerse) and a surah array
 * (same structure as in v4/surah/) filtered to only include verses
 * belonging to that juz.
 *
 * Categories built:
 *   juz/verse/{juz}.json
 *   juz/image/{juz}.json
 *   juz/audio/{reciter}/{juz}.json
 *   juz/tafsir/{lang}/{id}/{juz}.json
 *
 * Usage:
 *   node build-para.js                         Build all juz endpoints
 *   node build-para.js -s 1-5                  Build juz containing surahs 1-5 only
 *   node build-para.js -m min                  Write minified JSON only
 *   node build-para.js -m with-min             Write both pretty + minified
 *   node build-para.js -c verse                Build only verse category
 *   node build-para.js -c image                Build only image category
 *   node build-para.js -c audio                Build only audio category
 *   node build-para.js -c tafsir               Build only tafsir category
 *   node build-para.js -h                      Show help
 */

'use strict';

const fs = require('fs');
const path = require('path');

const V4_DIR        = path.resolve(__dirname);
const SURAH_DIR     = path.join(V4_DIR, 'surah');
const OUTPUT_DIR    = path.join(V4_DIR, 'juz');
const TOTAL_SURAHS  = 114;
const TOTAL_JUZ     = 30;

function now() {
  const d = new Date();
  return d.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function elapsed(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
}

function writeJSON(filePath, data, minify) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const json = minify ? JSON.stringify(data) : JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, json, 'utf-8');
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
${B('v4/build-para.js')} — Juz/Para dataset builder

${B('SYNOPSIS')}
  ${G('node build-para.js')} [${C('-s')} ${Y('<surah>')}] [${C('-m')} ${Y('<mode>')}] [${C('-c')} ${Y('<cat>')}] [${C('-h')}]

${B('FLAGS')}
  ${C('-h')}          Show help
  ${C('-s')} ${Y('<surah>')}  Only process para files that contain these surah(s)
  ${C('-m')} ${Y('<mode>')}   JSON format: ${Y('min')} | ${Y('with-min')}
  ${C('-c')} ${Y('<cat>')}   Category: ${Y('verse')} | ${Y('image')} | ${Y('audio')} | ${Y('tafsir')}

${B('EXAMPLES')}
  ${G('node build-para.js')}                    Build all 30 juz (all categories)
  ${G('node build-para.js')} ${C('-c')} ${Y('verse')}             Build verse category only
  ${G('node build-para.js')} ${C('-m')} ${Y('min')}               Build minified only
`);
  process.exit(0);
}

function parseArgs() {
  const raw = process.argv.slice(2);
  if (raw.includes('-h')) showHelp();

  let surahArg = null;
  let minifyMode = null;
  let category = null;

  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a === '-s') {
      surahArg = raw[++i];
      if (!surahArg) { console.error('-s requires a value'); process.exit(1); }
    } else if (a === '-m') {
      minifyMode = raw[++i];
      if (!['min', 'with-min'].includes(minifyMode)) {
        console.error("-m must be 'min' or 'with-min'"); process.exit(1);
      }
    } else if (a === '-c') {
      category = raw[++i];
      if (!['verse', 'image', 'audio', 'tafsir'].includes(category)) {
        console.error("-c must be 'verse', 'image', 'audio', or 'tafsir'"); process.exit(1);
      }
    }
  }

  return { surahArg, minifyMode, category };
}

// =========================================================================
// Discover input structure
// =========================================================================

function discoverReciters() {
  const audioDir = path.join(SURAH_DIR, 'audio');
  if (!fs.existsSync(audioDir)) return [];
  return fs.readdirSync(audioDir).filter(e => {
    const p = path.join(audioDir, e);
    return fs.statSync(p).isDirectory();
  }).sort();
}

function discoverTafsirs() {
  const tafsirDir = path.join(SURAH_DIR, 'tafsir');
  if (!fs.existsSync(tafsirDir)) return [];
  const result = [];
  const langs = fs.readdirSync(tafsirDir).filter(e => {
    const p = path.join(tafsirDir, e);
    return fs.statSync(p).isDirectory();
  }).sort();
  for (const lang of langs) {
    const langDir = path.join(tafsirDir, lang);
    const ids = fs.readdirSync(langDir).filter(e => {
      const p = path.join(langDir, e);
      return fs.statSync(p).isDirectory();
    }).sort();
    for (const id of ids) {
      result.push({ lang, id });
    }
  }
  return result;
}

// =========================================================================
// Read a surah JSON file (prefer .json, fallback .min.json)
// =========================================================================

function readSurahFile(baseDir, surahNumber) {
  const pretty = path.join(baseDir, `${surahNumber}.json`);
  const min = path.join(baseDir, `${surahNumber}.min.json`);
  const found = fs.existsSync(pretty) ? pretty : fs.existsSync(min) ? min : null;
  if (!found) return null;
  return JSON.parse(fs.readFileSync(found, 'utf-8'));
}

// =========================================================================
// Build juz-grouped data for a single category
// =========================================================================

/**
 * For a given input directory (containing {n}.json per surah),
 * read all surah files, group verses by juz,
 * and return an array of length 31 (index 0 unused, 1–30 used).
 *
 * Each entry is an array of surah objects with only the verses in that juz.
 */
function buildParaData(inputDir, surahNumbers) {
  const juzBuckets = Array.from({ length: TOTAL_JUZ + 1 }, () => ({}));

  for (const sn of surahNumbers) {
    const data = readSurahFile(inputDir, sn);
    if (!data) {
      console.warn(`[${now()}]   ⚠ No data for surah ${sn} in ${inputDir}`);
      continue;
    }

    const verses = data.verses || [];
    // Group verses by juz
    const versesByJuz = {};
    for (const v of verses) {
      const j = v.juz;
      if (!versesByJuz[j]) versesByJuz[j] = [];
      versesByJuz[j].push(v);
    }

    // For each juz this surah contributes to, create a surah header + filtered verses
    for (const [juz, juzVerses] of Object.entries(versesByJuz)) {
      const j = Number(juz);
      juzBuckets[j][sn] = {
        no: data.no,
        name: data.name,
        enName: data.enName,
        enNameTranslation: data.enNameTranslation,
        bnNameTranslation: data.bnNameTranslation,
        revelationType: data.revelationType,
        revelationOrder: data.revelationOrder,
        numberOfAyahs: data.numberOfAyahs,
        verses: juzVerses,
      };
    }
  }

  // Convert buckets to sorted arrays
  const result = [];
  for (let j = 1; j <= TOTAL_JUZ; j++) {
    const bucket = juzBuckets[j];
    const surahNums = Object.keys(bucket).map(Number).sort((a, b) => a - b);
    result[j] = surahNums.map(sn => bucket[sn]);
  }
  return result;
}

// =========================================================================
// Write outputs for one category
// =========================================================================

function wrapParaData(juzNumber, surahArray) {
  const verseMapping = {};
  let totalVerse = 0;
  for (const s of surahArray) {
    const verses = s.verses || [];
    if (verses.length === 0) continue;
    const first = verses[0].numberInSurah;
    const last = verses[verses.length - 1].numberInSurah;
    verseMapping[s.no] = first === last ? `${first}` : `${first}-${last}`;
    totalVerse += verses.length;
  }
  return {
    juzNumber,
    verseMapping,
    totalVerse,
    surah: surahArray,
  };
}

function writeParaOutputs(category, paraData, minifyMode, subPath) {
  const baseDir = subPath
    ? path.join(OUTPUT_DIR, category, subPath)
    : path.join(OUTPUT_DIR, category);

  let count = 0;
  for (let j = 1; j <= TOTAL_JUZ; j++) {
    const data = paraData[j];
    if (!data || data.length === 0) continue;

    const wrapped = wrapParaData(j, data);

    if (minifyMode !== 'min') {
      writeJSON(path.join(baseDir, `${j}.json`), wrapped, false);
      count++;
    }
    if (minifyMode !== null) {
      writeJSON(path.join(baseDir, `${j}.min.json`), wrapped, true);
    }
  }
  return count;
}

// =========================================================================
// Per-category builder
// =========================================================================

function buildVerse(surahNumbers, minifyMode) {
  const t0 = Date.now();
  console.log(`[${now()}]   Reading verse files...`);
  const paraData = buildParaData(path.join(SURAH_DIR, 'verse'), surahNumbers);
  const total = writeParaOutputs('verse', paraData, minifyMode, null);
  console.log(`[${now()}]   → ${total} juz files written (${elapsed(Date.now() - t0)})`);
  return total;
}

function buildImage(surahNumbers, minifyMode) {
  const t0 = Date.now();
  console.log(`[${now()}]   Reading image files...`);
  const paraData = buildParaData(path.join(SURAH_DIR, 'image'), surahNumbers);
  const total = writeParaOutputs('image', paraData, minifyMode, null);
  console.log(`[${now()}]   → ${total} juz files written (${elapsed(Date.now() - t0)})`);
  return total;
}

function buildAudio(surahNumbers, minifyMode) {
  const t0 = Date.now();
  const reciters = discoverReciters();
  if (reciters.length === 0) {
    console.warn(`[${now()}]   ⚠ No reciter dirs found in surah/audio/`);
    return 0;
  }
  console.log(`[${now()}]   Building audio for ${reciters.length} reciters...`);
  let total = 0;
  for (const reciter of reciters) {
    const inputDir = path.join(SURAH_DIR, 'audio', reciter);
    const paraData = buildParaData(inputDir, surahNumbers);
    total += writeParaOutputs('audio', paraData, minifyMode, reciter);
  }
  console.log(`[${now()}]   → ${total} juz files across ${reciters.length} reciters (${elapsed(Date.now() - t0)})`);
  return total;
}

function buildTafsir(surahNumbers, minifyMode) {
  const t0 = Date.now();
  const tafsirs = discoverTafsirs();
  if (tafsirs.length === 0) {
    console.warn(`[${now()}]   ⚠ No tafsir dirs found in surah/tafsir/`);
    return 0;
  }
  console.log(`[${now()}]   Building tafsir for ${tafsirs.length} tafsirs...`);
  let total = 0;
  for (const t of tafsirs) {
    const inputDir = path.join(SURAH_DIR, 'tafsir', t.lang, t.id);
    const paraData = buildParaData(inputDir, surahNumbers);
    total += writeParaOutputs('tafsir', paraData, minifyMode, path.join(t.lang, t.id));
  }
  console.log(`[${now()}]   → ${total} juz files across ${tafsirs.length} tafsirs (${elapsed(Date.now() - t0)})`);
  return total;
}

// =========================================================================
// Main
// =========================================================================

function main() {
  const scriptStart = Date.now();
  const { surahArg, minifyMode, category } = parseArgs();

  const minLabel = minifyMode === null ? 'Pretty JSON' :
    minifyMode === 'min' ? 'Minified JSON only' :
    'Pretty + minified JSON';

  const surahNumbers = surahArg
    ? parseSurahSpec(surahArg)
    : Array.from({ length: TOTAL_SURAHS }, (_, i) => i + 1);

  if (!surahNumbers || surahNumbers.length === 0) {
    console.error('Invalid surah specification. Use numbers 1-114, ranges (1-10), or comma-separated.');
    process.exit(1);
  }

  console.log(`\n  ╔══════════════════════════════════════════╗`);
  console.log(`  ║      v4 Quran API — Para Build Script    ║`);
  console.log(`  ╚══════════════════════════════════════════╝\n`);
  console.log(`  Source surahs: ${surahNumbers.length}`);
  console.log(`  Format:        ${minLabel}`);
  if (category) console.log(`  Category:      ${category}`);
  console.log('');

  const categories = category ? [category] : ['verse', 'image', 'audio', 'tafsir'];

  for (const cat of categories) {
    console.log(`  ── [${cat}] ──`);
    try {
      switch (cat) {
        case 'verse':  buildVerse(surahNumbers, minifyMode);  break;
        case 'image':  buildImage(surahNumbers, minifyMode);  break;
        case 'audio':  buildAudio(surahNumbers, minifyMode);  break;
        case 'tafsir': buildTafsir(surahNumbers, minifyMode); break;
      }
    } catch (e) {
      console.error(`[${now()}]   ✗ ${e.message}`);
    }
    console.log('');
  }

  console.log(`  ╔══════════════════════════════════════════╗`);
  console.log(`  ║  Done! ${elapsed(Date.now() - scriptStart).padEnd(37)}║`);
  console.log(`  ╚══════════════════════════════════════════╝\n`);
}

// =========================================================================
// Surah spec parser (reused from build-fetch.js)
// =========================================================================

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

main();
