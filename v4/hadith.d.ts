// ===== Hadith Editions =====

export interface HadithEditionName {
  [langCode: string]: string;
}

export interface HadithEdition {
  id: string;
  slug: string;
  bookCount: number;
  hadithCount: number;
  availableLanguages: string[];
  name: HadithEditionName;
}

export type HadithEditions = HadithEdition[];

// ===== Hadith Books =====

export interface HadithBookName {
  [langCode: string]: string;
}

export interface HadithBook {
  id: string;
  editionId: string;
  bookIndex: number;
  hadithCount: number;
  hadithIndexStart: number;
  name: HadithBookName;
}

export type HadithBooks = HadithBook[];

// ===== Hadith Grades =====

export interface HadithGrade {
  id: string;
  name: string;
  grade: string;
}

// ===== Hadith Entries =====

export interface HadithEntry {
  id: string;
  editionId: string;
  bookIndex: number;
  hadithIndex: number;
  bookHadithIndex: number;
  text: string;
  grades: HadithGrade[];
}

// ===== Hadith (all in one file) =====

export interface HadithCollection {
  total: number;
  items: HadithEntry[];
}

// ===== Hadith (paginated) =====

export interface PaginatedHadithCollection {
  total: number;
  totalPage: number;
  page: number;
  pageSize: number;
  items: HadithEntry[];
}

// Editions list: /v4/hadith/editions.json
// Get books for an edition: /v4/hadith/{edition-slug}/books.json
// Get all hadith for a book: /v4/hadith/{edition-slug}/{edition-slug}-{book-index}/{lang-code}/hadith.json
// Get paginated hadith: /v4/hadith/{edition-slug}/{edition-slug}-{book-index}/{lang-code}/{page}.json