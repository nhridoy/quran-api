const testFormat = {
  allSurahList: [
    {
      no: 1,
      name: "سُورَةُ ٱلْفَاتِحَةِ",
      enName: "Al-Fatiha",
      enNameTranslation: "The Opening",
      bnNameTranslation: "Al-Fatiha",
      revelationType: "Macca",
      numberOfAyahs: 7,
      verses: [
        {
          totalNumber: 1,
          numberInSurah: 1,
          text: "سُورَةُ ٱلْفَاتِحَةِ",
          enText: "",
          bnText: "",
          bntextLatin: "",
          audio: "",
        },
      ],
    },
  ],
  singleSurah: {
    1: {
      no: 1,
      name: "سُورَةُ ٱلْفَاتِحَةِ",
      enName: "Al-Fatiha",
      enNameTranslation: "The Opening",
      bnNameTranslation: "Al-Fatiha",
      revelationType: "Macca",
      numberOfAyahs: 7,
      verses: [
        {
          totalNumber: 1,
          numberInSurah: 1,
          text: "سُورَةُ ٱلْفَاتِحَةِ",
          enText: "",
          bnText: "",
          bntextLatin: "",
          audio: "",
        },
      ],
    },
  },
  singleAudioList: {
    1: [
      {
        totalNumber: 1,
        numberInSurah: 1,
        text: "سُورَةُ ٱلْفَاتِحَةِ",
        enText: "",
        bnText: "",
        bntextLatin: "",
        audio: "",
      },
      {
        totalNumber: 2,
        numberInSurah: 2,
        text: "سُورَةُ ٱلْفَاتِحَةِ",
        enText: "",
        bnText: "",
        bntextLatin: "",
        audio: "",
      },
    ],
  },
  allAudioList: [
    {
      no: 1,
      name: "سُورَةُ ٱلْفَاتِحَةِ",
      enName: "Al-Fatiha",
      enNameTranslation: "The Opening",
      bnNameTranslation: "Al-Fatiha",
      revelationType: "Macca",
      totalNumber: 1,
      numberInSurah: 1,
      text: "سُورَةُ ٱلْفَاتِحَةِ",
      enText: "",
      bnText: "",
      bntextLatin: "",
      audio: "",
    },
    {
      no: 1,
      name: "سُورَةُ ٱلْفَاتِحَةِ",
      enName: "Al-Fatiha",
      enNameTranslation: "The Opening",
      bnNameTranslation: "Al-Fatiha",
      revelationType: "Macca",
      totalNumber: 1,
      numberInSurah: 1,
      text: "سُورَةُ ٱلْفَاتِحَةِ",
      enText: "",
      bnText: "",
      bntextLatin: "",
      audio: "",
    },
  ],
};

let api = {};

// Fetching all surah list
const allSurah = fetch(`https://api.alquran.cloud/v1/surah`).then((res) =>
  res.json()
);

const allSurahBnName = fetch(
  `https://alquranbd.com/api/tafheem/sura/list`
).then((res) => res.json());

// const singleSurahVerses = fetch(`https://api.quran.sutanlab.id/surah/1`).then(
//   (res) => res.json()
// );

const allData = Promise.all([allSurah, allSurahBnName]);
allData.then((res) => allSurahList(res));

const allSurahList = (data) => {
  api.allSurahList = [];

  data[0].data.map((surah, index) => {
    setTimeout(() => {
      // console.log(surah.number);
      const surahVerse = fetch(
        `https://api.quran.sutanlab.id/surah/${surah.number}`
      ).then((res) => res.json());

      const surahVerseBn = fetch(
        `https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ben-muhiuddinkhan/${surah.number}.min.json`
      ).then((res) => res.json());

      const surahVerseBnLt = fetch(
        `https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ben-muhiuddinkhan-la/${surah.number}.min.json`
      ).then((res) => res.json());

      const verseData = Promise.all([surahVerse, surahVerseBn, surahVerseBnLt]);
      verseData.then((res) => verses(res));

      //   fetch(`https://api.quran.sutanlab.id/surah/${surah.number}`)
      //     .then((res) => res.json())
      //     .then((res) => verses(res.data));
    }, 500 * surah.number);

    api.allSurahList.push({
      no: surah.number,
      name: surah.name,
      enName: surah.englishName,
      enNameTranslation: surah.englishNameTranslation,
      bnNameTranslation: data[1][index].name,
      revelationType: surah.revelationType,
      numberOfAyahs: surah.numberOfAyahs,
      verses: [],
    });
    // api.allSurahList.map((surah) => (surah.verses = []));
  });

  const verses = (data) => {
    // console.log(data.number);
    // [data[0], data[1], data[2]].map((verse, index) => {
    //   console.log(data[0].data.verses);
    //   console.log(data[1]);
    //   console.log(data[2]);
    // });
    // console.log(data[0].data.number, data[0].data.verses); // Important
    data[0].data.verses.map((verse, index) => {
      api.allSurahList[data[0].data.number - 1].verses.push({
        totalNumber: verse.number.inQuran,
        numberInSurah: verse.number.inSurah,
        text: verse.text.arab,
        enText: verse.translation.en,
        enTextTransliteration: verse.text.transliteration.en,
        bnText: data[1].chapter[index].text,
        bntextLatin: data[2].chapter[index].text,
        audioPrimary: verse.audio.primary,
        audioSecond: verse.audio.secondary[0],
        audioThird: verse.audio.secondary[1],
      });
    });

    // data[0].data.verses.map((verse, index) => {
    //   api.allSurahList[data.number - 1].verses.push({
    //     totalNumber: verse.number.inQuran,
    //     numberInSurah: verse.number.inSurah,
    //     text: verse.text.arab,
    //     enText: verse.translation.en,
    //     enTextTransliteration: verse.text.transliteration.en,
    //     //   bnText: data[0].banglaText,
    //     //   bntextLatin: data[0].banglaTextLatin,
    //     audioPrimary: verse.audio.primary,
    //     audioSecond: verse.audio.secondary[0],
    //     audioThird: verse.audio.secondary[1],
    //   });
    // });
  };
};

// const surahAudio = fetch(`https://alquranbd.com/api/tafheem/sura/list`).then((res) =>
//   res.json()
// );

const allSurahBnNamev2 = fetch(
  `https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ben-muhiuddinkhan/1.min.json`
).then((res) => res.json());

const allSurahBnNamev3 = fetch(
  `https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ben-muhiuddinkhan-la/1.min.json
  `
).then((res) => res.json());

// const singleSurahVerses = fetch(`https://api.quran.sutanlab.id/surah/1`).then(
//   (res) => res.json()
// );

const allDatav2 = Promise.all([allSurah, allSurahBnName]);
allDatav2.then((res) => singleSurah(res));

const singleSurah = (data) => {
  //   console.log(data[0].data, data[1]);
  api.singleSurah = {};
  data[0].data.map((surah, index) => {
    // console.log(surah.number);

    // fetch(`https://api.quran.sutanlab.id/surah/${surah.number}`)
    //     .then((res) => res.json())
    //     .then((res) => verses(res.data));
    api.singleSurah[surah.number] = {
      no: surah.number,
      name: surah.name,
      enName: surah.englishName,
      enNameTranslation: surah.englishNameTranslation,
      bnNameTranslation: data[1][index].name,
      revelationType: surah.revelationType,
      numberOfAyahs: surah.numberOfAyahs,
      verses: [],
    };

    setTimeout(() => {
      fetch(`https://api.quran.sutanlab.id/surah/${surah.number}`)
        .then((res) => res.json())
        .then((res) => {
          //   res.data.verses.map((verse, index) => {
          // const surahVerse = fetch(
          //   `https://api.quran.sutanlab.id/surah/${surah.number}`
          // ).then((res) => res.json());

          const surahVerseBn = fetch(
            `https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ben-muhiuddinkhan/${surah.number}.min.json`
          ).then((res) => res.json());

          const surahVerseBnLt = fetch(
            `https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ben-muhiuddinkhan-la/${surah.number}.min.json`
          ).then((res) => res.json());

          const verseData = Promise.all([
            //   surahVerse,
            surahVerseBn,
            surahVerseBnLt,
          ]);
          verseData.then((res) => verses(res));

          const verses = (data) => {
            // console.log(data[0].data.verses);
            // console.log(data[1]);
            // console.log(data[2]);
            // console.log(data[0].data.number, data[0].data.verses); // Important
            res.data.verses.map((verse, index) => {
              //   console.log(data[1]);
              api.singleSurah[surah.number].verses.push({
                totalNumber: verse.number.inQuran,
                numberInSurah: verse.number.inSurah,
                text: verse.text.arab,
                enText: verse.translation.en,
                enTextTransliteration: verse.text.transliteration.en,
                bnText: data[0].chapter[index].text,
                bntextLatin: data[1].chapter[index].text,
                audioPrimary: verse.audio.primary,
                audioSecond: verse.audio.secondary[0],
                audioThird: verse.audio.secondary[1],
              });
            });
          };
          // fetch(
          //   `https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ben-muhiuddinkhan/${surah.number}.min.json`
          // )
          //   .then((res) => res.json())
          //   .then((res) => {
          //     api.singleSurah[surah.number][0].verses.push({
          //       totalNumber: verse.number.inQuran,
          //       numberInSurah: verse.number.inSurah,
          //       text: verse.text.arab,
          //       enText: verse.translation.en,
          //       enTextTransliteration: verse.text.transliteration.en,
          //       bnText: res.chapter[index].text,
          //       // bntextLatin: res.chapter[index].textLatin,
          //       audioPrimary: verse.audio.primary,
          //       audioSecond: verse.audio.secondary[0],
          //       audioThird: verse.audio.secondary[1],
          //     });
          //   });
          // console.log(data[2]);
          // console.log(api.singleSurah[surah.number][0]);
          // api.singleSurah[surah.number][0].verses.push({
          //   totalNumber: verse.number.inQuran,
          //   numberInSurah: verse.number.inSurah,
          //   text: verse.text.arab,
          //   enText: verse.translation.en,
          //   enTextTransliteration: verse.text.transliteration.en,
          //   //   bnText: data[1].chapter[index].text,
          //   //   bntextLatin: data[2].chapter[index].text,
          //   audioPrimary: verse.audio.primary,
          //   audioSecond: verse.audio.secondary[0],
          //   audioThird: verse.audio.secondary[1],
          // });
        });
      // api.singleSurah[surah.number].verses.push(res.data);
      // console.log(surah.number, res.data)
      // });
    }, 500 * surah.number);
  });
  // api.singleSurah.no = data.number;
  // api.singleSurah.no = data.data.number;
  // api.singleSurah.name = data.data.name;
  // api.singleSurah.enName = data.data.englishName;
  // api.singleSurah.enNameTranslation = data.data.englishNameTranslation;
  // api.singleSurah.bnNameTranslation = data.data.name;
  // api.singleSurah.revelationType = data.data.revelationType;
  // api.singleSurah.numberOfAyahs = data.data.numberOfAyahs;
  // api.singleSurah.verses = [];
  // data.data.verses.map((verse, index) => {
  //     api.singleSurah.verses.push({
  //         totalNumber: verse.number.inQuran,
  //         numberInSurah: verse.number.inSurah,
  //         text: verse.text.arab,
  //         enText: verse.translation.en,
  //         enTextTransliteration: verse.text.transliteration.en,
  //         bnText: data.data.verses[index].translation.bn,
  //         bntextLatin: data.data.verses[index].translation.bnLatin,
  //         audioPrimary: verse.audio.primary,
  //         audioSecond: verse.audio.secondary[0],
  //         audioThird: verse.audio.secondary[1],
  //     });
  // });
};

const sengleSurahAudioList = () => {
  api.singleSurahAudioList = {};
  for (const key in api.singleSurah) {
    api.singleSurahAudioList[key] = [];
    api.singleSurah[key].verses.map((verse, index) => {
      api.singleSurahAudioList[key].push({
        totalNumber: verse.totalNumber,
        numberInSurah: verse.numberInSurah,
        text: verse.text,
        enText: verse.enText,
        enTextTransliteration: verse.enTextTransliteration,
        bnText: verse.bnText,
        bntextLatin: verse.bntextLatin,
        audioPrimary: verse.audioPrimary,
        audioSecond: verse.audioSecond,
        audioThird: verse.audioThird,
      });
    });
  }
  //   api.singleSurah.map((surah, index) => {
  //     api.singleSurahAudioList[surah.number] = [];
  //     surah.verses.map((verse, index) => {
  //       api.singleSurahAudioList[surah.number].push({
  //         totalNumber: verse.totalNumber,
  //         numberInSurah: verse.numberInSurah,
  //         text: verse.text,
  //         enText: verse.enText,
  //         enTextTransliteration: verse.enTextTransliteration,
  //         bnText: verse.bnText,
  //         bntextLatin: verse.bntextLatin,
  //         audioPrimary: verse.audioPrimary,
  //         audioSecond: verse.audioSecond,
  //         audioThird: verse.audioThird,
  //       });
  //     });
  //   });
};

const allAudioList = () => {
  api.allSurahAudioList = [];
  for (const key in api.singleSurah) {
    let surahVerseSingle = [...api.singleSurahAudioList[key]];
    surahVerseSingle.map((verse, index) => {
      verse["surahNumber"] = key;
      verse["Name"] = api.singleSurah[key].name;
      verse["enName"] = api.singleSurah[key].enName;
      verse["enNameTranslation"] = api.singleSurah[key].enNameTranslation;
      verse["bnNameTranslation"] = api.singleSurah[key].bnNameTranslation;
      verse["revelationType"] = api.singleSurah[key].revelationType;
      verse["numberOfAyahs"] = api.singleSurah[key].numberOfAyahs;
      api.allSurahAudioList.push(verse);
    });

    // api.allSurahAudioList.push(surahVerseSingle);
  }
};
const TestFn = () => {
  console.log(api);
};
