import { PartialSourceManga } from "@paperback/types"
import { AllMangaSearchResponse } from "./AllMangaTypes"

const COVER_CDN = "https://wp.youtube-anime.com"

export class AllMangaParser {
  private cover(path?: string | null): string {
    if (!path) return ""

    if (path.startsWith("http://") || path.startsWith("https://")) {
      return encodeURI(path)
    }

    return encodeURI(`${COVER_CDN}/${path.replace(/^\/+/, "")}`)
  }

  parseSearchResults(raw: string): PartialSourceManga[] {
    const json = JSON.parse(raw) as AllMangaSearchResponse
    const edges = json?.data?.mangas?.edges ?? []

    const results: PartialSourceManga[] = []

    for (const item of edges) {
      const mangaId = item._id ?? item.id
      const title = item.englishName || item.name || item.nativeName

      if (!mangaId || !title) continue

      results.push(
        App.createPartialSourceManga({
          mangaId,
          image: this.cover(item.thumbnail),
          title,
          subtitle: item.nativeName || "AllManga"
        })
      )
    }

    return results
  }

  parseDebugTile(raw: string): PartialSourceManga[] {
    return [
      App.createPartialSourceManga({
        mangaId: "debug",
        image: "",
        title: "DEBUG: AllManga response",
        subtitle: raw.slice(0, 120)
      })
    ]
  }
}