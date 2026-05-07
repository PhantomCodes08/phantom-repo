import {
  Chapter,
  ChapterDetails,
  ContentRating,
  HomeSection,
  PagedResults,
  PartialSourceManga,
  SearchRequest,
  Source,
  SourceInfo,
  SourceIntents,
  TagSection
} from "@paperback/types"

import {
  AllMangaSearchResult,
  AllMangaSearchResponse
} from "./AllMangaTypes"

const SITE = "https://allmanga.to"
const API = "https://api.allanime.to/api"
const COVER_CDN = "https://wp.youtube-anime.com"

export const AllMangaInfo: SourceInfo = {
  version: "0.1.7",
  name: "AllManga",
  icon: "icon.png",
  author: "Phantom",
  description: "Phantom-built AllManga source for Paperback.",
  contentRating: ContentRating.MATURE,
  websiteBaseURL: SITE,
  sourceTags: [],
  intents:
    SourceIntents.MANGA_CHAPTERS |
    SourceIntents.HOMEPAGE_SECTIONS |
    SourceIntents.CLOUDFLARE_BYPASS_REQUIRED
}

export class AllManga extends Source {

  requestManager = App.createRequestManager({
    requestsPerSecond: 1,
    requestTimeout: 20000
  })

  getMangaShareUrl(mangaId: string): string {
    return `${SITE}/manga/${mangaId}`
  }

  private cover(path?: string | null): string {
    if (!path) return "https://via.placeholder.com/256?text=No+Cover"
    if (path.startsWith("http")) return encodeURI(path)
    return encodeURI(`${COVER_CDN}/${path.replace(/^\/+/, "")}`)
  }

  private searchUrl(keyword: string, page: number): string {
    const variables = {
      search: {
        query: keyword.trim(),
        isManga: true,
        allowAdult: true,
        allowUnknown: false
      },
      limit: 20,
      page,
      translationType: "sub",
      countryOrigin: "ALL"
    }

    const extensions = {
      persistedQuery: {
        version: 1,
        sha256Hash: "d4f3b8c1e2a9f7d6c5b4a392817f6e5d4c3b2a1908f7e6d5c4b3a291817f6e5d"
      }
    }

    return `${API}?variables=${encodeURIComponent(JSON.stringify(variables))}&extensions=${encodeURIComponent(JSON.stringify(extensions))}`
  }

  // ------------------------------------------------------------
  // API WRAPPER
  // ------------------------------------------------------------
  private async fetchTiles(keyword: string, page: number): Promise<PartialSourceManga[]> {
    try {
      const request = App.createRequest({
        url: this.searchUrl(keyword, page),
        method: "GET",
        headers: {
          Referer: `${SITE}/`,
          Origin: SITE,
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)",
          "Accept": "application/json",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache"
        }
      })

      const response = await this.requestManager.schedule(request, 1)
      const parsed = JSON.parse(response.data as string) as AllMangaSearchResponse

      const edges: AllMangaSearchResult[] = parsed?.data?.mangas?.edges ?? []

      if (!Array.isArray(edges) || edges.length === 0) {
        return [
          App.createPartialSourceManga({
            mangaId: "debug-no-results",
            image: "https://via.placeholder.com/256?text=No+Results",
            title: "API returned zero items",
            subtitle: `keyword="${keyword}" page=${page}`
          })
        ]
      }

      return edges
        .filter(m => m._id)
        .map(m =>
          App.createPartialSourceManga({
            mangaId: m._id,
            image: this.cover(m.thumbnail),
            title: m.englishName || m.name || m.nativeName || "Unknown Title",
            subtitle: m.nativeName || "AllManga"
          })
        )

    } catch (e: any) {
      return [
        App.createPartialSourceManga({
          mangaId: "debug-error",
          image: "https://via.placeholder.com/256?text=API+Error",
          title: "API ERROR",
          subtitle: String(e?.message ?? "Unknown error")
        })
      ]
    }
  }

  // ------------------------------------------------------------
  // REQUIRED METHODS
  // ------------------------------------------------------------
  async getMangaDetails(mangaId: string) {
    return App.createSourceManga({
      id: mangaId,
      mangaInfo: App.createMangaInfo({
        titles: [mangaId],
        image: "https://via.placeholder.com/256?text=No+Image",
        desc: "Details parser not connected yet.",
        status: "UNKNOWN"
      })
    })
  }

  async getChapters(mangaId: string): Promise<Chapter[]> {
    return []
  }

  async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
    return App.createChapterDetails({
      id: chapterId,
      mangaId,
      pages: []
    })
  }

  async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
    const results = await this.fetchTiles(query.title ?? "", 1)

    return App.createPagedResults({
      results,
      metadata: undefined
    })
  }

  async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
    const section = App.createHomeSection({
      id: "trending",
      title: "Trending",
      type: "singleRowNormal",
      items: [],
      containsMoreItems: false
    })

    sectionCallback(section)

    const results = await this.fetchTiles("", 1)
    section.items = results

    sectionCallback(section)
  }

  async getTags(): Promise<TagSection[]> {
    return []
  }
}
