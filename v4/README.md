# v4 Quran API

Enhanced Quran API with verse text, verse images, multi-reciter audio, and multi-language tafsir (exegesis). Served via **jsDelivr CDN**.

## Base URL

```
https://cdn.jsdelivr.net/gh/nhridoy/quran-api@latest/v4
```

Every endpoint has two variants: `{file}.json` (pretty-printed, 2-space indent) and `{file}.min.json` (minified).

---

## Endpoints

| Category | Path | Example |
|----------|------|---------|
| Verse text | `/v4/surah/verse/{id}.json` | [verse/1.json](https://cdn.jsdelivr.net/gh/nhridoy/quran-api@latest/v4/surah/verse/1.json) |
| Verse images | `/v4/surah/image/{id}.json` | [image/1.json](https://cdn.jsdelivr.net/gh/nhridoy/quran-api@latest/v4/surah/image/1.json) |
| Audio by reciter | `/v4/surah/audio/{reciter}/{id}.json` | [audio/ar.alafasy/1.json](https://cdn.jsdelivr.net/gh/nhridoy/quran-api@latest/v4/surah/audio/ar.alafasy/1.json) |
| Tafsir | `/v4/surah/tafsir/{lang}/{tafsir-id}/{id}.json` | [tafsir/en/en-tafsir-maarif-ul-quran/1.json](https://cdn.jsdelivr.net/gh/nhridoy/quran-api@latest/v4/surah/tafsir/en/en-tafsir-maarif-ul-quran/1.json) |
| Juz/para (verse) | `/v4/juz/verse/{id}.json` | [juz/verse/1.json](https://cdn.jsdelivr.net/gh/nhridoy/quran-api@latest/v4/juz/verse/1.json) |
| Juz/para (image) | `/v4/juz/image/{id}.json` | [juz/image/1.json](https://cdn.jsdelivr.net/gh/nhridoy/quran-api@latest/v4/juz/image/1.json) |
| Juz/para (audio) | `/v4/juz/audio/{reciter}/{id}.json` | [juz/audio/ar.alafasy/1.json](https://cdn.jsdelivr.net/gh/nhridoy/quran-api@latest/v4/juz/audio/ar.alafasy/1.json) |
| Juz/para (tafsir) | `/v4/juz/tafsir/{lang}/{tafsir-id}/{id}.json` | [juz/tafsir/en/en-tafsir-maarif-ul-quran/1.json](https://cdn.jsdelivr.net/gh/nhridoy/quran-api@latest/v4/juz/tafsir/en/en-tafsir-maarif-ul-quran/1.json) |

## Supporting Files

| File | CDN URL |
|------|---------|
| Reciter list | [reciters.json](https://cdn.jsdelivr.net/gh/nhridoy/quran-api@latest/v4/reciters.json) / [reciters.min.json](https://cdn.jsdelivr.net/gh/nhridoy/quran-api@latest/v4/reciters.min.json) |
| TypeScript types | [quran.d.ts](https://cdn.jsdelivr.net/gh/nhridoy/quran-api@latest/v4/quran.d.ts) |
| API docs | [README.md](https://cdn.jsdelivr.net/gh/nhridoy/quran-api@latest/v4/README.md) |
| AI context | [llms.txt](https://cdn.jsdelivr.net/gh/nhridoy/quran-api@latest/v4/llms.txt) |

Using TypeScript? Download `quran.d.ts` via jsDelivr and reference it in your project:

```bash
curl -O https://cdn.jsdelivr.net/gh/nhridoy/quran-api@latest/v4/quran.d.ts
```

---

## Data Structure

### Surah-level header (common to all 4 categories)

```json
{
  "no": 1,
  "name": "سُورَةُ ٱلْفَاتِحَةِ",
  "enName": "Al-Faatiha",
  "enNameTranslation": "The Opening",
  "bnNameTranslation": "আল ফাতিহা",
  "revelationType": "Meccan",
  "revelationOrder": 5,
  "numberOfAyahs": 7,
  "verses": []
}
```

| Field | Type | Description |
|-------|------|-------------|
| `no` | int | Surah number (1–114) |
| `name` | string | Arabic name |
| `enName` | string | English transliteration |
| `enNameTranslation` | string | English translation of name |
| `bnNameTranslation` | string | Bengali translation of name |
| `revelationType` | string | `"Meccan"` or `"Medinan"` |
| `revelationOrder` | int | Chronological revelation order |
| `numberOfAyahs` | int | Total verses in this surah |
| `verses` | array | Array of verse objects |

---

### Verse-level schemas

#### verse category (`/v4/surah/verse/{id}`)

```json
{
  "totalNumber": 1,
  "numberInSurah": 1,
  "juz": 1,
  "sajda": {
    "recommended": false,
    "obligatory": false
  },
  "text": {
    "arText": "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
    "enText": "In the name of Allah, the Entirely Merciful, the Especially Merciful.",
    "enTextTransliteration": "Bismillaahir Rahmaanir Raheem",
    "bnText": "শুরু করছি আল্লাহর নামে যিনি পরম করুণাময়, অতি দয়ালু।",
    "bntextLatin": "Suru karachi allahara name yini parama karunamaya, ati dayalu."
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `totalNumber` | int | Global verse number (1–6236) |
| `numberInSurah` | int | Verse position within this surah |
| `juz` | int | Juz/para number (1–30) |
| `sajda` | object | Prostration marker |
| `sajda.recommended` | bool | Recommended prostration |
| `sajda.obligatory` | bool | Obligatory prostration |
| `text.arText` | string | Arabic (Uthmani script) |
| `text.enText` | string | English (Saheeh International) |
| `text.enTextTransliteration` | string | English transliteration |
| `text.bnText` | string | Bengali (Muhiuddin Khan) |
| `text.bntextLatin` | string | Bengali transliteration (Latin) |

---

#### image category (`/v4/surah/image/{id}`)

```json
{
  "totalNumber": 1,
  "numberInSurah": 1,
  "juz": 1,
  "image": {
    "primary": "http://cdn.islamic.network/quran/images/1_1.png",
    "secondary": "http://cdn.islamic.network/quran/images/high-resolution/1_1.png",
    "alternative": "https://cdn.jsdelivr.net/gh/nhridoy/quran-images@latest/by-verses/low-resolution/1/1.png",
    "alternative-high": "https://cdn.jsdelivr.net/gh/nhridoy/quran-images@latest/by-verses/high-resolution/1/1.png"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `image.primary` | string | Standard resolution (islamic.network) |
| `image.secondary` | string | High resolution (islamic.network) |
| `image.alternative` | string | Low resolution fallback (jsDelivr) |
| `image.alternative-high` | string | High resolution fallback (jsDelivr) |

---

#### audio category (`/v4/surah/audio/{reciter}/{id}`)

```json
{
  "totalNumber": 1,
  "numberInSurah": 1,
  "juz": 1,
  "audio": {
    "primary": "https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3",
    "secondary": "https://cdn.islamic.network/quran/audio/64/ar.alafasy/1.mp3",
    "tertiary": "https://cdn.islamic.app/quran/audio/ar.alafasy/1.mp3",
    "alternative": "https://cdn.jsdelivr.net/gh/nhridoy/1-2@latest/1/ar.alafasy/1.mp3"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `audio.primary` | string | 128 kbps (islamic.network) |
| `audio.secondary` | string | 64 kbps (islamic.network) |
| `audio.tertiary` | string | Fallback (islamic.app) |
| `audio.alternative` | string | CDN fallback (jsDelivr, grouped by surah ranges) |

---

#### tafsir category (`/v4/surah/tafsir/{lang}/{tafsir-id}/{id}`)

```json
{
  "totalNumber": 1,
  "numberInSurah": 1,
  "juz": 1,
  "lang": "English",
  "authorName": "Mufti Muhammad Shafi",
  "tafsirName": "Ma'arif al-Qur'an",
  "tafsir": "<p>Exegesis text in HTML format...</p>"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `lang` | string | Language of the tafsir |
| `authorName` | string | Author/commentator name |
| `tafsirName` | string | Tafsir work title |
| `tafsir` | string | Exegesis content (HTML) |

---

### Juz/para endpoints (`/v4/juz/{category}/{id}`)

Each juz can span multiple surahs. Responses are wrapped in a metadata object with the surah data in a `surah` array.

```json
{
  "juzNumber": 1,
  "verseMapping": {
    "1": "1-7",
    "2": "1-141"
  },
  "totalVerse": 148,
  "surah": [
    {
      "no": 1,
      "enName": "Al-Faatiha",
      "verses": [...]
    },
    {
      "no": 2,
      "enName": "Al-Baqara",
      "verses": [...]
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `juzNumber` | int | Juz number (1–30) |
| `verseMapping` | object | Maps each surah number to its verse range within this juz |
| `totalVerse` | int | Total verses in this juz |
| `surah` | array | Array of surah objects (same per-verse schema as surah endpoints) |

The per-verse objects inside `surah[].verses` have the same fields as the corresponding surah category (verse, image, audio, or tafsir).

---

## Reciters

17 reciters available. Each reciter endpoint returns audio for all verses of a surah. Full data (Arabic names, English names) is in [`reciters.json`](https://cdn.jsdelivr.net/gh/nhridoy/quran-api@latest/v4/reciters.json).

| Key | Reciter Name |
|-----|-------------|
| `ar.abdullahbasfar` | Abdullah Basfar |
| `ar.abdurrahmaansudais` | Abdurrahmaan As-Sudais |
| `ar.abdulsamad` | Abdul Samad |
| `ar.ahmedajamy` | Ahmed ibn Ali al-Ajamy |
| `ar.alafasy` | Alafasy |
| `ar.aymanswoaid` | Ayman Sowaid |
| `ar.hanirifai` | Hani Rifai |
| `ar.hudhaify` | Hudhaify |
| `ar.husary` | Husary |
| `ar.husarymujawwad` | Husary (Mujawwad) |
| `ar.ibrahimakhbar` | Ibrahim Akhdar |
| `ar.mahermuaiqly` | Maher Al Muaiqly |
| `ar.muhammadayyoub` | Muhammad Ayyoub |
| `ar.muhammadjibreel` | Muhammad Jibreel |
| `ar.parhizgar` | Parhizgar |
| `ar.saoodshuraym` | Saood bin Ibraaheem Ash-Shuraym |
| `ar.shaatree` | Abu Bakr Ash-Shaatree |

---

## Tafsirs

18 tafsir works across 6 languages.

### Arabic (7)

| ID | Author |
|----|--------|
| `ar-tafseer-al-qurtubi` | Al-Qurtubi |
| `ar-tafseer-al-saddi` | Al-Saddi |
| `ar-tafsir-al-baghawi` | Al-Baghawi |
| `ar-tafsir-al-tabari` | Al-Tabari |
| `ar-tafsir-al-wasit` | Al-Wasit |
| `ar-tafsir-ibn-kathir` | Ibn Kathir |
| `ar-tafsir-muyassar` | Al-Muyassar |

### Bengali (4)

| ID | Author |
|----|--------|
| `bn-tafseer-ibn-e-kaseer` | Ibn-e-Kaseer (Bengali) |
| `bn-tafsir-abu-bakr-zakaria` | Dr. Abu Bakr Zakaria |
| `bn-tafsir-ahsanul-bayaan` | Ahsanul Bayaan |
| `tafisr-fathul-majid-bn` | Fathul Majid |

### English (2)

| ID | Author |
|----|--------|
| `en-tafisr-ibn-kathir` | Ibn Kathir (abridged) |
| `en-tafsir-maarif-ul-quran` | Mufti Muhammad Shafi |

### Kurdish (1)

| ID | Author |
|----|--------|
| `kurd-tafsir-rebar` | Rebar |

### Russian (1)

| ID | Author |
|----|--------|
| `ru-tafseer-al-saddi` | Al-Saddi (Russian) |

### Urdu (3)

| ID | Author |
|----|--------|
| `tafseer-ibn-e-kaseer-urdu` | Ibn-e-Kaseer (Urdu) |
| `tafsir-bayan-ul-quran` | Bayan-ul-Quran |
| `tafsir-fe-zalul-quran-syed-qatab` | Syed Qutb (Fi Zilal) |

---

## Usage Examples

### Fetch verse text

```js
const BASE = 'https://cdn.jsdelivr.net/gh/nhridoy/quran-api@latest/v4';

const res = await fetch(`${BASE}/surah/verse/1.json`);
const { verses, ...surah } = await res.json();

console.log(surah.enName); // "Al-Faatiha"
console.log(verses[0].text.enText); // English translation
```

### Fetch reciter list

```js
const res = await fetch(`${BASE}/reciters.json`);
const reciters = await res.json();

console.log(reciters.count); // 17
console.log(reciters.reciters[3].englishName); // "Ahmed ibn Ali al-Ajamy"
```

### Fetch audio for a reciter

```js
const res = await fetch(`${BASE}/surah/audio/ar.alafasy/36.json`);
const data = await res.json();
console.log(data.verses[0].audio.primary); // 128 kbps MP3 URL
```

### Fetch tafsir

```js
const res = await fetch(
  `${BASE}/surah/tafsir/en/en-tafsir-maarif-ul-quran/1.json`
);
const data = await res.json();
console.log(data.verses[0].tafsir); // HTML exegesis
```

---

## Differences from v2

| Feature | v2 | v4 |
|---------|----|----|
| Revelation order | — | `revelationOrder` |
| Text fields | Flat top-level keys | Grouped under `text` object |
| Tafsir | — | 18 works in 6 languages |
| Audio | Single reciter, flat fields | 17 reciters, keyed by identifier, 4 sources each |
| Images | — | 4 quality tiers per verse |
| Data structure | Combined surah JSON | 4 separate category endpoints (verse, image, audio, tafsir) |
| Para/juz endpoints | Yes | Yes (`/v4/juz/`) |

---

## Local Assets

For self-hosting, the repo includes raw audio files at `v4/data/audio/{surahNo}/{reciter}/{verseNo}.mp3`. Images are not currently bundled but can be fetched from the CDN sources listed in the image endpoints.
