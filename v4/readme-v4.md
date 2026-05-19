# v4 Quran API

Enhanced version of the Quran API with tafsir, multi-reciter audio, and verse images.

## Base URL

```
https://cdn.jsdelivr.net/gh/nhridoy/quran-api@main/v4
```

## Endpoints

### Single Surah

```
GET /v4/surah/{id}.json
```

| Param | Type | Example |
|---|---|---|
| `id` | int (1–114) | `1` |

```
https://cdn.jsdelivr.net/gh/nhridoy/quran-api@main/v4/surah/1.json
```

## Data Structure

### Surah level

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
|---|---|---|
| `no` | int | Surah number (1–114) |
| `name` | string | Arabic name |
| `enName` | string | English transliteration |
| `enNameTranslation` | string | English translation |
| `bnNameTranslation` | string | Bengali translation |
| `revelationType` | string | `Meccan` or `Medinan` |
| `revelationOrder` | int | Chronological revelation order |
| `numberOfAyahs` | int | Total verses in this surah |
| `verses` | array | Array of verse objects |

### Verse level

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
  },
  "tafsir": {
    "en": "English tafsir (Ma'arif al-Qur'an)...",
    "bn": "Bengali tafsir (Abu Bakr Zakaria)..."
  },
  "audio": {
    "ar.alafasy": {
      "primary": "https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3",
      "secondary": "https://cdn.islamic.network/quran/audio/64/ar.alafasy/1.mp3",
      "tertiary": "https://cdn.islamic.app/quran/audio/ar.alafasy/1.mp3",
      "local": "data/audio/1/ar.alafasy/1.mp3"
    }
  },
  "image": {
    "primary": "http://cdn.islamic.network/quran/images/1_1.png",
    "secondary": "http://cdn.islamic.network/quran/images/high-resolution/1_1.png",
    "local": "data/images/1/1.png"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `totalNumber` | int | Global verse number (1–6236) |
| `numberInSurah` | int | Verse position within this surah |
| `juz` | int | Juz/para number |
| `sajda` | object | Prostration marker (`recommended`, `obligatory`) |
| `text` | object | Text translations (see below) |
| `tafsir` | object | Exegesis/commentary (see below) |
| `audio` | object | Audio URLs keyed by reciter (see below) |
| `image` | object | Verse image URLs (see below) |

### `text` — Translations

| Field | Description |
|---|---|
| `arText` | Arabic (Uthmani script) |
| `enText` | English translation (Saheeh International) |
| `enTextTransliteration` | English transliteration |
| `bnText` | Bengali translation (Muhiuddin Khan) |
| `bntextLatin` | Bengali transliteration (Latin script) |

### `tafsir` — Exegesis

| Field | Source |
|---|---|
| `en` | Ma'arif al-Qur'an (English) |
| `bn` | Tafsir Abu Bakr Zakaria (Bengali) |

### `audio` — Reciters

17 reciters are available, each with 4 sources:

| Key | Reciter |
|---|---|
| `ar.abdullahbasfar` | Abdullah Basfar |
| `ar.abdurrahmaansudais` | Abdur-Rahman As-Sudais |
| `ar.abdulsamad` | Abdul Samad |
| `ar.ahmedajamy` | Ahmed Al-Ajamy |
| `ar.alafasy` | Mishary Al-Afasy |
| `ar.aymanswoaid` | Ayman Sowaid |
| `ar.hanirifai` | Hani Ar-Rifai |
| `ar.hudhaify` | Ali Al-Hudhaify |
| `ar.husary` | Mahmoud Khalil Al-Husary |
| `ar.husarymujawwad` | Husary (Mujawwad) |
| `ar.ibrahimakhbar` | Ibrahim Al-Akhbar |
| `ar.mahermuaiqly` | Maher Al-Muaiqly |
| `ar.muhammadayyoub` | Muhammad Ayyoub |
| `ar.muhammadjibreel` | Muhammad Jibreel |
| `ar.parhizgar` | Parhizgar |
| `ar.saoodshuraym` | Saood Ash-Shuraym |
| `ar.shaatree` | Abu Bakr Ash-Shaatree |

Each reciter has 4 audio sources per verse:

| Source | Quality | Host |
|---|---|---|
| `primary` | 128 kbps | cdn.islamic.network |
| `secondary` | 64 kbps | cdn.islamic.network |
| `tertiary` | Fallback | cdn.islamic.app |
| `local` | Local path | Project data directory |

### `image` — Verse Images

| Field | Resolution |
|---|---|
| `primary` | Standard (cdn.islamic.network) |
| `secondary` | High-resolution |
| `local` | Local path |

## Usage Example

```js
const res = await fetch('https://cdn.jsdelivr.net/gh/nhridoy/quran-api@main/v4/surah/1.json');
const surah = await res.json();

console.log(surah.enName); // "Al-Faatiha"

// First verse
const v = surah.verses[0];
console.log(v.text.enText); // English translation
console.log(v.tafsir.en);   // English tafsir
console.log(v.audio.ar.alafasy.primary); // Audio URL
```

## Differences from v2

| Feature | v2 | v4 |
|---|---|---|
| Revelation order | — | `revelationOrder` |
| Text fields | Flat | Grouped under `text` |
| Tafsir | — | `tafsir.en`, `tafsir.bn` |
| Audio | Single reciter (flat) | 17 reciters, keyed by identifier |
| Images | — | `image` with CDN + local paths |
| Para/juz endpoints | Yes | Not yet |

## Local Assets

If you self-host, audio and image files can be served from `data/audio/` and `data/images/`. The `local` field in each verse points to the relative path within these directories.
