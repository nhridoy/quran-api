# v3 Build — Plan

## 1. Goal

Create `v3/` with a Node.js build script that generates a multi-translation, multi-script Quran dataset from multiple APIs.

## 2. Folder structure

```
v3/
  surah/{chapter_id}/{language_code}/{translation_slug}/surah.json
```

No `para/` folder for now.

## 3. Output format (`surah.json`)

```json
{
  "no": 1,
  "name_arabic": "الفاتحة",
  "translated_name": "The Opener",
  "translated_name_literation": "Al-Fatihah",
  "en_name": "Al-Fatihah",
  "revelation_place": "makkah",
  "revelation_order": 5,
  "number_of_verses": 7,
  "verses": [
    {
      "id": 1,
      "number_in_surah": 1,
      "verse_number": 1, // number in the entire Quran
      "verse_key": "1:1",
      "chapter_id": 1,
      "juz": 1,
      "hizb": 1,
      "rub": 1,
      "ruku": 1,
      "manzil": 1,
      "page": 1,
      "sajda": { "recommended": false, "obligatory": false },
      "text_uthmani": "...",
      "text_uthmani_simple": "...",
      "text_imlaei": "...",
      "text_imlaei_simple": "...",
      "text_indopak": "...",
      "text_uthmani_tajweed": "...",
      "number_in_surah": 1,
      "text_literation": "Bismi Allahi arrahmani arraheem",
      "translated_text": "In the name of Allah...",
      "audio": []
    }
  ]
}
```

`verse_number` = position in the entire Quran (1–6236).

## 4. Data sources

| Source | Purpose | Auth |
|---|---|---|
| `api.islamic.app/v1` | Chapters, 6 Arabic scripts, 130+ translations, transliteration, verse metadata | None |
| `https://api.quran.sutanlab.id/surah/{id}` | Arabic text, transliteration, English translation, audio URLs | None |
| `https://cdn.jsdelivr.net/gh/nhridoy/quran-api@main/v2/surah/{id}.min.json` | v2 existing data (reference/fallback) | None |
| `https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ben-muhiuddinkhan/{id}.min.json` | Bengali translation text | None |
| `https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ben-muhiuddinkhan-la/{id}.min.json` | Bengali Latin transliteration | None |
| `https://ummahapi.com/api` | 3 Arabic scripts, 8 reciter audio (per verse + per surah), transliteration, 8 translations, surah metadata | `?key=umh_3e5af9c544dfcf970f24d6ed97800ed29bb6ff54` |
| `https://cdn.jsdelivr.net/npm/quran-json@3.1.2/dist/chapters/{lang}/{id}.json` | Arabic text, transliteration, translations in 10 languages | None (CDN) |

### What each source contributes to the final output

| Field | Primary source | Fallback |
|---|---|---|
| `name_arabic`, `en_name`, `revelation_place`, `revelation_order` | islamic.app `/chapters` | ummahapi `/surahs` |
| `translated_name` | islamic.app `/chapters?language={code}` | — |
| `translated_name_literation` | islamic.app `name_simple` for non-Latin; `translated_name` for Latin | ummahapi `name_complex` |
| `text_uthmani`, `text_imlaei`, `text_indopak` | islamic.app verse fields | ummahapi `?script=uthmani\|indopak` |
| `text_uthmani_simple`, `text_imlaei_simple` | islamic.app verse fields only | — |
| `text_uthmani_tajweed` | islamic.app verse fields only | ummahapi `?script=tajweed` |
| `juz`, `hizb`, `rub`, `ruku`, `manzil`, `page`, `sajda` | islamic.app verse metadata | — |
| `text_literation` | islamic.app `transliteration` translation (id=57) | ummahapi `transliteration` field, quran-json |
| `translated_text` | islamic.app translations | ummahapi `translations` object, fawazahmed0 for bn |
| `audio` | ummahapi per-ayah `ayah_audio` URLs (8 reciters) | sutanlab audio |

## 5. `text_literation` — per-language feasibility

The requirement: every translation file gets a `text_literation` field (not just English).

**Finding**: No free Quran API provides per-language transliteration of Arabic text. All APIs investigated (islamic.app, ummahapi, quran-json, sutanlab, fawazahmed0, alquran-api) provide only the Latin/English transliteration of the Arabic text — e.g. `"Bismi Allahi alrrahmani alrraheemi"`.

- islamic.app `transliteration` translation (id=57): Arabic→Latin per-verse transliteration
- quran-json package: same Arabic→Latin transliteration in every language file (confirmed: `en/1.json` and `bn/1.json` both have identical `transliteration` values)
- fawazahmed0 `-la` editions (`ben-muhiuddinkhan-la`): these are romanized **translations** of the verse meaning (Bengali meaning written in Latin script), NOT Arabic transliteration

**Decision**: `text_literation` will contain the Arabic→Latin transliteration (same value across all translation files for a given verse). This is sourced from islamic.app's `transliteration` translation (id=57), with quran-json as fallback.

## 6. Script design

**Runtime**: Node.js 18+ (built-in `fetch`)

**Algorithm**:

```
1. Pre-fetch surah metadata:
   a. GET /v1/chapters (islamic.app, English) → cache id, name_arabic, name_simple, revelation_place, revelation_order
   b. GET /api/quran/surahs (ummahapi, with key) → cache name_complex, extra metadata

2. Pre-fetch all translations:
   a. GET /v1/resources/translations (islamic.app) → group by iso_code, batch into groups of 25
   b. GET /v1/resources/languages (islamic.app) → iso_code → name mapping

3. Pre-fetch translated names per language:
   For each unique iso_code among translations:
     GET /v1/chapters?language={code} → cache translated_name per chapter

4. For each target surah (or 1-114 if none specified via CLI arg):
   a. Fetch base verse data + transliteration:
      GET /v1/verses/by_chapter/{id}?fields=all&translations=transliteration
      → Store: all 6 scripts, verse metadata, transliteration text

   b. Fetch audio data:
      GET /api/quran/surah/{id}?key=... (ummahapi)
      → Store: per-ayah audio URLs from all 8 reciters

   c. For each batch of 25 translation slugs from islamic.app:
      GET /v1/verses/by_chapter/{id}?fields=text_uthmani&translations=slug1,...,slug25
      → Store: translated_text per verse per translation slug

   d. For each translation slug:
      - Look up iso_code and translated_name
      - Build surah.json from merged data
      - Write to surah/{id}/{language_code}/{slug}/surah.json
```

**Batching**: islamic.app limits to 25 translations per request. ~130 translations → ~6 calls per surah × 114 = ~684 calls. Each call hits CDN-cached endpoints so latency is low.

**Concurrency**:
- Per-surah: `Promise.allSettled` for all translation batches (6 parallel calls)
- Across surahs: sequential (to avoid rate limits) or configurable concurrency pool

**CLI arg**: `node build.js [surah_number]` — optional surah number to build one surah (testing). Without it, builds all 114.

## 7. Merging data from multiple sources

The core challenge is stitching verses from different APIs that may have slightly different verse counts or text. Strategy:
1. **islamic.app is the source of truth** for verse metadata (6236 verses, all metadata fields)
2. **Audio from ummahapi** is merged by matching `verse_key` (e.g. `1:1`)
3. **External translations** (fawazahmed0 bn, bn-la) are merged by verse index position
4. **v2 data** is used as a reference for spot-checking consistency, not merged into output

## 8. Handling `translated_name_literation`

Always uses `name_simple` from islamic.app (the English romanized name, e.g. "Al-Fatihah") regardless of the output language. This is the Latin-script representation of the Arabic surah name, not a translation.

## 9. Audio data

UmmahAPI provides 8 reciters with per-ayah audio. Each verse entry will have:
```json
"audio": [
  {
    "reciter_id": 1,
    "reciter_name": "Mishary Rashid Alafasy",
    "style": "Murattal",
    "url": "https://everyayah.com/data/Alafasy_128kbps/001001.mp3"
  },
  {
    "reciter_id": 2,
    "reciter_name": "Abdul Rahman Al-Sudais",
    "url": "..."
  }
]
```

Per-surah audio URLs from ummahapi can also be included at the surah level.

## 10. Error handling

- Network failures: retry once with exponential backoff (1s, 3s, 7s)
- Missing translation for a specific verse: skip gracefully (omit `translated_text`)
- islamic.app rate limit (1000 req/hr/IP): add small delay between surahs if >50 surahs
- UmmahAPI: 5000 req/15min without key, unlimited with key — use key for large builds
- Write failures: log and continue

## 11. Implementation order

1. Create `v3/build.js` with core algorithm (islamic.app only)
2. Add ummahapi integration for audio + scripts
3. Add fawazahmed0 integration for Bengali
4. Test single surah: `node build.js 1`
5. Run full build for all 114 surahs
6. Update `AGENTS.md` with v3 instructions
