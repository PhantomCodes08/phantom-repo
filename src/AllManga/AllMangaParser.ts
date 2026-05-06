import { CheerioAPI } from "cheerio"

export class AllMangaParser {

  parseHomePage($: CheerioAPI) {

    const results: any[] = []

    $("a").each((_, element) => {

      const href = $(element).attr("href") ?? ""

      if (!href.includes("/manga/")) return

      const title =
        $(element).text().trim() ||
        $(element).attr("title") ||
        "Unknown"

      const image =
        $(element).find("img").attr("src") ??
        $(element).find("img").attr("data-src") ??
        ""

      const id = href.split("/").pop() ?? ""

      if (!id) return

      results.push(
        App.createMangaTile({
          id,
          image,
          title: App.createIconText({
            text: title
          })
        })
      )
    })

    return results
  }

  parseSearchResults($: CheerioAPI) {
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