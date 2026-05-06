import { CheerioAPI } from "cheerio"
export class AllMangaParser {
  parseSearchResults($: CheerioAPI) {
    return []
  }

  parseHomePage($: CheerioAPI) {
    return []
  }

  parseMangaDetails($: CheerioAPI, mangaId: string) {
    return null
  }

  parseChapters($: CheerioAPI, mangaId: string) {
    return []
  }

  parseChapterPages($: CheerioAPI) {
    return []
  }
}