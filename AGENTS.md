# AGENTS.md

## What this is

Static Quran JSON dataset (Arabic, English, Bangla, audio URLs) served via **jsDelivr CDN** from the `main` branch. No servers, no runtime, no package manager.

## Directory layout

| Path | Purpose |
|---|---|
| `v1/` | Published API v1 endpoints (allSurahList, singleSurah, surah/{id}) |
| `v2/` | Published API v2 endpoints (+ `juz`/`sajda` fields per verse, `para/{id}`) |
| `v4/` | Published API v4 endpoints (split into verse, image, audio by reciter, tafsir by language) |
| `src/` | **v1 build script** (`script.js` + `index.html`) — browser-based scraper |
| `src-v2/` | **v2 build script** (`script.js` + `index.html`) — browser-based scraper |
| `Compressor/` | `json-minify.py` — Python 3 JSON minifier |
| `quran.min.json` | root-level minified full Quran (API output) |

## How to regenerate data (v1 or v2)

1. Open `src/index.html` (v1) or `src-v2/index.html` (v2) in a browser
2. Press **"Click One"** then **"Click Two"** (buttons on the page)
3. Press **"Click"** — outputs assembled JSON in the console
4. Copy the `api` object from browser console, save as JSON files in `v1/` or `v2/`

## How to minify

```bash
cd Compressor
python json-minify.py
```

Output goes to `Compressor/compressed/`. Copy `.min.json` files to the corresponding version directory.

## v1 → v2 differences

- v2 verse objects add `juz` (int) and `sajda` (`{recommended, obligatory}`) fields
- v2 adds `para/{id}.json` endpoints
- v2 `singleSurahAudioList` and `allSurahAudioList` include the same additional fields

## v2 → v4 differences

- v4 splits data into 4 independent categories: `verse/`, `image/`, `audio/{reciter}/`, `tafsir/{lang}/{id}/`
- v4 surah header adds `revelationOrder` (int)
- v4 text fields are grouped under `text` object (not flat)
- v4 adds 18 tafsir works across 6 languages (ar, bn, en, ku, ru, ur)
- v4 adds 17 reciters with 4 audio sources each (primary, secondary, tertiary, alternative)
- v4 adds verse images with 4 quality tiers
- v4 adds `juz/` endpoints (same 4 categories: verse, image, audio, tafsir)
- v4 ships its own TypeScript types in `v4/quran.d.ts`

## Delivery

All endpoints served via:
```
https://cdn.jsdelivr.net/gh/nhridoy/quran-api@main/{v1|v2|v4}/{endpoint}
```
Every endpoint has `.json` (pretty) and `.min.json` (minified) variants.

## Conventions

- **Single branch** (`main`) — no PR flow, no releases
- **No package.json**, no dependencies, no build tools
- **No tests**, no linter, no formatter, no CI
- JSON files are committed directly (not gitignored)
- Arabic text uses `ensure_ascii=False` in Python minifier (critical to preserve Arabic characters)
- `.gitignore` does not exist
