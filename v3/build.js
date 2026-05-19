const fs = require('fs');
const path = require('path');

const API = 'https://api.islamic.app/v1';
const UMMAH_API = 'https://ummahapi.com/api';
const UMMAH_KEY = 'umh_3e5af9c544dfcf970f24d6ed97800ed29bb6ff54';
const OUTPUT = path.resolve(__dirname, '..', 'v3');

const SAJDA_VERSES = new Set([
  '7:206', '13:15', '16:50', '17:109', '19:58',
  '22:18', '22:77', '25:60', '27:26', '32:15',
  '38:24', '41:38', '53:62', '84:21', '96:19'
]);

const FAWAZ_EDITIONS = [
  { slug: 'ben-muhiuddinkhan', iso_code: 'bn', name: 'Muhiuddin Khan' },
  { slug: 'ben-muhiuddinkhan-la', iso_code: 'bn', name: 'Muhiuddin Khan (Latin)' }
];
const FAWAZ_CDN = 'https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions';

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const body = await res.json();
  if (body.data) return body.data;
  return body;
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getCumulativeVersesBefore(chapterId, chapters) {
  let count = 0;
  for (const ch of chapters) {
    if (ch.id >= chapterId) break;
    count += ch.verses_count;
  }
  return count;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function fetchReciterPatterns() {
  try {
    const data = await fetchJSON(`${UMMAH_API}/quran/audio/1/1?key=${UMMAH_KEY}`);
    return data.reciters.map(r => ({
      id: r.id,
      name: r.name,
      style: r.style || 'Murattal',
      baseUrl: r.audio_url.slice(0, -10)
    }));
  } catch (e) {
    console.warn(`  Could not fetch reciter patterns: ${e.message}`);
    return [];
  }
}

function buildAudioUrls(reciters, surahNum, ayahNum) {
  const surahStr = String(surahNum).padStart(3, '0');
  const ayahStr = String(ayahNum).padStart(3, '0');
  return reciters.map(r => ({
    reciter_id: r.id,
    reciter_name: r.name,
    style: r.style,
    url: `${r.baseUrl}${surahStr}${ayahStr}.mp3`
  }));
}

async function main() {
  const targetSurah = process.argv[2] ? parseInt(process.argv[2]) : null;

  console.log('Fetching surah metadata...');
  const chaptersUnsorted = await fetchJSON(`${API}/chapters`).then(d => d.chapters);
  const chapters = [...chaptersUnsorted].sort((a, b) => a.id - b.id);
  const chapterMap = {};
  for (const ch of chapters) {
    chapterMap[ch.id] = ch;
  }

  console.log('Fetching translations list...');
  const allTranslations = await fetchJSON(`${API}/resources/translations`).then(d => d.translations);
  const outputTranslations = allTranslations.filter(t => t.slug !== 'transliteration');

  console.log(`Found ${outputTranslations.length} output translations (excluding transliteration)`);

  const fawazSlugs = new Set(FAWAZ_EDITIONS.map(e => e.slug));
  const islamicTranslations = outputTranslations.filter(t => !fawazSlugs.has(t.slug));

  console.log('Adding fawazahmed0 editions...');
  for (const ed of FAWAZ_EDITIONS) {
    if (!outputTranslations.find(t => t.slug === ed.slug)) {
      outputTranslations.push(ed);
    }
  }
  console.log(`  Total: ${outputTranslations.length} translations`);

  console.log('Fetching languages...');
  const languages = await fetchJSON(`${API}/resources/languages`).then(d => d.languages);

  console.log('Fetching translated names per language...');
  const uniqueLangs = [...new Set(outputTranslations.map(t => t.iso_code))];
  const translatedNames = {};
  const langResults = await Promise.allSettled(
    uniqueLangs.map(async (lang) => {
      try {
        const chapters = await fetchJSON(`${API}/chapters?language=${lang}`).then(d => d.chapters);
        const names = {};
        for (const ch of chapters) {
          if (ch.translated_name) {
            names[ch.id] = ch.translated_name.name;
          }
        }
        return { lang, names };
      } catch (e) {
        throw { lang, error: e.message };
      }
    })
  );
  for (const result of langResults) {
    if (result.status === 'fulfilled') {
      translatedNames[result.value.lang] = result.value.names;
      console.log(`  ${result.value.lang}: ${Object.keys(result.value.names).length} surahs`);
    } else {
      console.warn(`  ${result.reason.lang}: failed (${result.reason.error}), using fallback`);
    }
  }

  console.log('Fetching reciter audio patterns...');
  const reciters = await fetchReciterPatterns();
  console.log(`  Found ${reciters.length} reciters`);

  const targetIds = targetSurah ? [targetSurah] : chapters.map(c => c.id);

  for (const chId of targetIds) {
    console.log(`\nBuilding surah ${chId}...`);
    const chapter = chapterMap[chId];
    if (!chapter) {
      console.warn(`  Unknown surah ${chId}, skipping`);
      continue;
    }

    console.log('  Fetching base verse data + transliteration...');
    let baseVerses;
    try {
      const url = `${API}/verses/by_chapter/${chId}?fields=text_uthmani,text_imlaei,text_indopak,text_uthmani_simple,text_imlaei_simple,text_uthmani_tajweed&translations=transliteration&per_page=500`;
      baseVerses = (await fetchJSON(url)).verses;
    } catch (e) {
      console.error(`  Failed to fetch base verses: ${e.message}`);
      continue;
    }
    console.log(`  Got ${baseVerses.length} verses`);

    const versesByKey = {};
    for (const v of baseVerses) {
      const transliterationEntry = v.translations?.find(t => t.slug === 'transliteration');
      const ayah = parseInt(v.verse_key.split(':')[1], 10);
      versesByKey[v.verse_key] = {
        id: v.id,
        verse_number: v.verse_number,
        verse_key: v.verse_key,
        chapter_id: v.chapter_id,
        juz: v.juz,
        hizb: v.hizb,
        rub: v.rub,
        ruku: v.ruku,
        manzil: v.manzil,
        page: v.page,
        sajda: {
          recommended: false,
          obligatory: SAJDA_VERSES.has(v.verse_key)
        },
        text_uthmani: v.text_uthmani,
        text_uthmani_simple: v.text_uthmani_simple || '',
        text_imlaei: v.text_imlaei || '',
        text_imlaei_simple: v.text_imlaei_simple || '',
        text_indopak: v.text_indopak || '',
        text_uthmani_tajweed: v.text_uthmani_tajweed || '',
        text_literation: transliterationEntry?.text || '',
        translated_text: '',
        audio: buildAudioUrls(reciters, chId, ayah)
      };
    }

    console.log('  Fetching translations in batches...');
    const translationBatches = chunkArray(islamicTranslations, 25);
    const translatedTexts = {};

    const batchResults = await Promise.allSettled(
      translationBatches.map(async (batch) => {
        const tIds = batch.map(t => t.id);
        const ids = tIds.join(',');
        const url = `${API}/verses/by_chapter/${chId}?fields=text_uthmani&translations=${ids}&per_page=500`;
        const batchVerses = (await fetchJSON(url)).verses;
        const texts = {};
        for (const v of batchVerses) {
          if (!v.translations) continue;
          for (const t of v.translations) {
            if (!texts[t.slug]) texts[t.slug] = {};
            texts[t.slug][v.verse_key] = t.text;
          }
        }
        return texts;
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        const texts = result.value;
        for (const slug of Object.keys(texts)) {
          if (!translatedTexts[slug]) translatedTexts[slug] = {};
          Object.assign(translatedTexts[slug], texts[slug]);
        }
      }
    }
    console.log(`  Fetched ${translationBatches.length} batches`);

    console.log('  Fetching additional editions (fawazahmed0)...');
    for (const ed of FAWAZ_EDITIONS) {
      try {
        const url = `${FAWAZ_CDN}/${ed.slug}/${chId}.min.json`;
        const data = await fetchJSON(url);
        const verses = data.chapter;
        if (!translatedTexts[ed.slug]) translatedTexts[ed.slug] = {};
        for (const v of verses) {
          const vk = `${chId}:${v.verse}`;
          translatedTexts[ed.slug][vk] = v.text;
        }
        console.log(`    ${ed.slug}: ${verses.length} verses`);
        await delay(200);
      } catch (e) {
        console.warn(`    ${ed.slug}: failed (${e.message})`);
      }
    }

    console.log('  Writing output files...');
    let written = 0;
    const vk = getCumulativeVersesBefore(chId, chapters);

    for (const t of outputTranslations) {
      const verses = [];
      for (const v of baseVerses) {
        const entry = {
          ...versesByKey[v.verse_key],
          number_in_surah: v.verse_number - vk,
          translated_text: translatedTexts[t.slug]?.[v.verse_key] || ''
        };
        verses.push(entry);
      }

      const translatedName = translatedNames[t.iso_code]?.[chId] || chapter.name_simple;
      const translatedNameLiteration = chapter.name_simple;

      const surahJson = {
        no: chId,
        name_arabic: chapter.name_arabic,
        translated_name: translatedName,
        translated_name_literation: translatedNameLiteration,
        en_name: chapter.name_simple,
        revelation_place: chapter.revelation_place,
        revelation_order: chapter.revelation_order,
        number_of_verses: chapter.verses_count,
        verses
      };

      const dir = path.join(OUTPUT, 'surah', String(chId), t.iso_code, t.slug);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'surah.json'), JSON.stringify(surahJson, null, 2));
      written++;
    }

    console.log(`  Wrote ${written} translation files`);
    await delay(100);
  }

  console.log('\nDone!');
}

function getCumulativeVersesBefore(chapterId, chapters) {
  let count = 0;
  for (const ch of chapters) {
    if (ch.id >= chapterId) break;
    count += ch.verses_count;
  }
  return count;
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
