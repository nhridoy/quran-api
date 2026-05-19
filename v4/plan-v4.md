v4 will be exactly like source/surah with some additional fields from islamic.app and ummahapi, but without the `para/` folder for now. The main focus is on improving data quality and consistency, not adding new features or restructuring the output.

## 1. Current output structure

```
{
    "no": 1,
    "name": "سُورَةُ ٱلْفَاتِحَةِ",
    "enName": "Al-Faatiha",
    "enNameTranslation": "The Opening",
    "bnNameTranslation": "আল ফাতিহা ",
    "revelationType": "Meccan",
    "numberOfAyahs": 7,
    "verses": [
        {
            "totalNumber": 1,
            "numberInSurah": 1,
            "juz": 1,
            "sajda": {
                "recommended": false,
                "obligatory": false
            },
            "text": "﻿بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
            "enText": "In the name of Allah, the Entirely Merciful, the Especially Merciful.",
            "enTextTransliteration": "Bismillaahir Rahmaanir Raheem",
            "bnText": "শুরু করছি আল্লাহর নামে যিনি পরম করুণাময়, অতি দয়ালু।",
            "bntextLatin": "Suru karachi allahara name yini parama karunamaya, ati dayalu.",
            "audioPrimary": "https://cdn.alquran.cloud/media/audio/ayah/ar.alafasy/1",
            "audioSecond": "https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3",
            "audioThird": "https://cdn.islamic.network/quran/audio/64/ar.alafasy/1.mp3"
        },
        ...
    ]
}
```

## 2. Goals for v4
```
{
    "no": 1,
    "name": "سُورَةُ ٱلْفَاتِحَةِ",
    "enName": "Al-Faatiha",
    "enNameTranslation": "The Opening",
    "bnNameTranslation": "আল ফাতিহা ",
    "revelationType": "Meccan",
    "revelationOrder": 5,
    "numberOfAyahs": 7,
    "verses": [
        {
            "totalNumber": 1,
            "numberInSurah": 1,
            "juz": 1,
            "sajda": {
                "recommended": false,
                "obligatory": false
            },
            "text": {
                "arText": "﻿بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
                "enText": "In the name of Allah, the Entirely Merciful, the Especially Merciful.",
                "enTextTransliteration": "Bismillaahir Rahmaanir Raheem",
                "bnText": "শুরু করছি আল্লাহর নামে যিনি পরম করুণাময়, অতি দয়ালু।",
                "bntextLatin": "Suru karachi allahara name yini parama karunamaya, ati dayalu.",
            },
            "tafsir":{
                "en": "This verse is the opening verse of the Quran and is recited at the beginning of each chapter (except for Surah At-Tawbah). It emphasizes the importance of seeking blessings and guidance from Allah before starting any task. The verse highlights two of Allah's attributes: Ar-Rahman (the Entirely Merciful) and Ar-Raheem (the Especially Merciful), indicating that Allah's mercy encompasses all things and is particularly directed towards believers.",
                "bn": "এই আয়াতটি কুরআনের প্রথম আয়াত এবং প্রতিটি সূরার শুরুতে পাঠ করা হয় (সূরা আত-তাওবাহ ছাড়া)। এটি যে কোনও কাজ শুরু করার আগে আল্লাহর কাছ থেকে বরকত এবং দিকনির্দেশনা চাওয়ার গুরুত্বকে জোর দেয়। এই আয়াতটি আল্লাহর দুটি গুণাবলীকে তুলে ধরে: আর-রহমান (পরম করুণাময়) এবং আর-রহীম (অতি দয়ালু), যা নির্দেশ করে যে আল্লাহর রহমত সবকিছুকে ঘিরে রাখে এবং বিশেষভাবে বিশ্বাসীদের প্রতি নির্দেশিত।"
            },
            "audio":{
                "ar.alafasy":{
                    "primary": "https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3",
                    "secondary": "https://cdn.islamic.network/quran/audio/64/ar.alafasy/1.mp3",
                    "tertiary": "https://cdn.islamic.app/quran/audio/ar.alafasy/1.mp3",
                    "local": "audio/ar.alafasy/1.mp3"
                },
                "ar.abdullahbasfar":{
                    "primary": "https://cdn.islamic.network/quran/audio/128/ar.abdullahbasfar/1.mp3",
                    "secondary": "https://cdn.islamic.network/quran/audio/64/ar.abdullahbasfar/1.mp3",
                    "tertiary": "https://cdn.islamic.app/quran/audio/ar.abdullahbasfar/1.mp3",
                    "local": "audio/ar.abdullahbasfar/1.mp3"
                }
                ...
            }
            "image": {
                "primary": "http://cdn.islamic.network/quran/images/1_1.png",
                "secondary": "http://cdn.islamic.network/quran/images/high-resolution/1_1.png",
                "local": "images/1_1.png"
            }
        },
        ...
    ]
}
```

### Summary of changes:
- Add `revelationOrder` at the surah level
- Restructure `text` to group all text fields together
- Add a new `tafsir` field with English and Bengali tafsir for each verse
- Restructure `audio` to group all audio URLs by reciter, with primary/secondary/tertiary sources and a local path for caching
- Add a new `image` field with URLs for verse images (if available) and a local path for caching
- No changes to folder structure or file naming conventions for now

### Sources:
- source/surah existing data for primary structure and existing fields
- islamic.app for additional metadata fields and tafsir
    - `revelation_order` for surah-level metadata (API: `https://api.islamic.app/v1/chapters/{surah_number}`)
    - `tafsir` for verse-level tafsir in multiple languages (for english use tafsir of en-tafsir-maarif-ul-quran, for bengali use tafsir of bn-tafsir-abu-bakr-zakaria) (api: `https://api.islamic.app/v1/verses/by_chapter/{surah_number}?tafsirs=en-tafsir-maarif-ul-quran,bn-tafsir-abu-bakr-zakaria`)
- alquran.cloud and islamic.network for audio URLs (with caching strategy for reliability)
    - API to get the list of reciters: `https://api.alquran.cloud/v1/edition?format=audio&language=ar&type=versebyverse`
    - download audio files and store locally in `audio/{reciter}/{verse_number}.mp3` for caching, and use the local path in the output JSON for the `local` field. The `primary`, `secondary`, and `tertiary` fields can still point to the original URLs for fallback.
- islamic.network for image URLs (with caching strategy for reliability)
    - download images and store locally in `images/{verse_key}.png` for caching, and use the local path in the output JSON for the `local` field. The `primary` and `secondary` fields can still point to the original URLs for fallback.


## 3. What you will do
- Create a new `v4/build.js` script that implements the above structure and data sources
- Use the same folder structure and file naming conventions as source/surah for consistency
- Implement the merging logic to combine data from multiple sources while ensuring consistency and handling discrepancies gracefully
- Implement error handling for network failures, missing data, and write failures
- node/bun v4/build.js 1 to build only the first surah for testing, and node/bun v4/build.js to build all 114 surahs
- Output JSON files should be formatted with 2-space indentation for readability
- Don't run the build script in this environment, just provide the code for it. The actual execution and testing will be done separately. You can test by running for surah 1, 110, 111, 112, 113, 114 which are smaller and faster to build.
- Make sure the script is well-commented and structured for readability and maintainability, as it will be the basis for future updates and potential v5 restructuring.
- Make the script optimized for performance, as it will be fetching data from multiple APIs and writing multiple files. Consider using asynchronous operations and batching where appropriate.