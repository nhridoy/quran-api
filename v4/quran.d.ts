// ===== Surah-level header =====

export interface SurahHeader {
  no: number;
  name: string;
  enName: string;
  enNameTranslation: string;
  bnNameTranslation: string;
  revelationType: 'Meccan' | 'Medinan';
  revelationOrder: number;
  numberOfAyahs: number;
}

// ===== Verse Text =====

export interface Sajda {
  recommended: boolean;
  obligatory: boolean;
}

export interface VerseText {
  arText: string;
  enText: string;
  enTextTransliteration: string;
  bnText: string;
  bntextLatin: string;
}

export interface VerseTextEntry {
  totalNumber: number;
  numberInSurah: number;
  juz: number;
  sajda: Sajda;
  text: VerseText;
}

export interface SurahVerseText extends SurahHeader {
  verses: VerseTextEntry[];
}

// ===== Verse Images =====

export interface VerseImageUrls {
  primary: string;
  secondary: string;
  alternative: string;
  'alternative-high': string;
}

export interface VerseImageEntry {
  totalNumber: number;
  numberInSurah: number;
  juz: number;
  image: VerseImageUrls;
}

export interface SurahImage extends SurahHeader {
  verses: VerseImageEntry[];
}

// ===== Audio by Reciter =====

export interface VerseAudioUrls {
  primary: string;
  secondary: string;
  tertiary: string;
  alternative: string;
}

export interface VerseAudioEntry {
  totalNumber: number;
  numberInSurah: number;
  juz: number;
  audio: VerseAudioUrls;
}

export interface SurahAudio extends SurahHeader {
  verses: VerseAudioEntry[];
}

// ===== Tafsir =====

export interface VerseTafsirEntry {
  totalNumber: number;
  numberInSurah: number;
  juz: number;
  lang: string;
  authorName: string;
  tafsirName: string;
  tafsir: string;
}

export interface SurahTafsir extends SurahHeader {
  verses: VerseTafsirEntry[];
}

// ===== Reciters =====

export type ReciterKey =
  | 'ar.abdullahbasfar'
  | 'ar.abdurrahmaansudais'
  | 'ar.abdulsamad'
  | 'ar.ahmedajamy'
  | 'ar.alafasy'
  | 'ar.aymanswoaid'
  | 'ar.hanirifai'
  | 'ar.hudhaify'
  | 'ar.husary'
  | 'ar.husarymujawwad'
  | 'ar.ibrahimakhbar'
  | 'ar.mahermuaiqly'
  | 'ar.muhammadayyoub'
  | 'ar.muhammadjibreel'
  | 'ar.parhizgar'
  | 'ar.saoodshuraym'
  | 'ar.shaatree';

export interface ReciterInfo {
  identifier: ReciterKey;
  name: string;
  englishName: string;
}

export interface RecitersList {
  count: number;
  reciters: ReciterInfo[];
}

// ===== Tafsir language groups =====

export type TafsirLanguage = 'ar' | 'bn' | 'en' | 'ku' | 'ru' | 'ur';

export type ArabicTafsirId =
  | 'ar-tafseer-al-qurtubi'
  | 'ar-tafseer-al-saddi'
  | 'ar-tafsir-al-baghawi'
  | 'ar-tafsir-al-tabari'
  | 'ar-tafsir-al-wasit'
  | 'ar-tafsir-ibn-kathir'
  | 'ar-tafsir-muyassar';

export type BengaliTafsirId =
  | 'bn-tafseer-ibn-e-kaseer'
  | 'bn-tafsir-abu-bakr-zakaria'
  | 'bn-tafsir-ahsanul-bayaan'
  | 'tafisr-fathul-majid-bn';

export type EnglishTafsirId =
  | 'en-tafisr-ibn-kathir'
  | 'en-tafsir-maarif-ul-quran';

export type KurdishTafsirId = 'kurd-tafsir-rebar';
export type RussianTafsirId = 'ru-tafseer-al-saddi';

export type UrduTafsirId =
  | 'tafseer-ibn-e-kaseer-urdu'
  | 'tafsir-bayan-ul-quran'
  | 'tafsir-fe-zalul-quran-syed-qatab';

export type TafsirId =
  | ArabicTafsirId
  | BengaliTafsirId
  | EnglishTafsirId
  | KurdishTafsirId
  | RussianTafsirId
  | UrduTafsirId;

// ===== API Response union =====

export type SurahResponse =
  | SurahVerseText
  | SurahImage
  | SurahAudio
  | SurahTafsir;

// ===== Juz/Para (grouped by juz number) =====

export type VerseRange = `${number}-${number}` | `${number}`;

export interface VerseMapping {
  [surahNumber: string]: VerseRange;
}

export interface JuzPara<SurahType> {
  juzNumber: number;
  verseMapping: VerseMapping;
  totalVerse: number;
  surah: SurahType[];
}

export type JuzVerseText = JuzPara<SurahVerseText>;
export type JuzImage = JuzPara<SurahImage>;
export type JuzAudio = JuzPara<SurahAudio>;
export type JuzTafsir = JuzPara<SurahTafsir>;

export type JuzResponse =
  | JuzVerseText
  | JuzImage
  | JuzAudio
  | JuzTafsir;
