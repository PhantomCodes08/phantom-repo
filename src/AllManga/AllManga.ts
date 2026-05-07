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

const API_MIRRORS = [
  "https://api.allanime.day/api",
  "https://api.allanime.to/api",
  "https://api.allanime.site/api",
  "https://api.allanime.cc/api",
  "https://api.allanime.xyz/api"
]

const COVER_CDN = "https://wp.youtube-anime.com"

// The ONE TRUE HASH used for ALL search + homepage queries
const HASH = "2d48e19fb67ddcac42fbb885204b6abb0a84f406f15ef83f36de4a66f49f651a"

export const AllMangaInfo: SourceInfo = {
  version: "0.2.1",
  name: "AllManga",
  icon: "icon.png",
  author: "Phantom",
  description: "Fully updated AllManga source using AllAnime backend.",
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

  // ------------------------------------------------------------
  // MIRROR FAILOVER SYSTEM
  // ------------------------------------------------------------
  private async tryMirrors(urlBuilder: (base: string) => string): Promise<string> {
    for (const base of API_MIRRORS) {
      const url = urlBuilder(base)

      try {
        const request = App.createRequest({
          url,
          method: "GET",
          headers: {
            Referer: `${SITE}/`,
            Origin: SITE,
            "User-Agent": "Mozilla/5.0 (Android 13; Mobile; rv:109.0) Gecko/109.0 Firefox/109.0",
            "Accept": "application/json",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache"
          }
        })

        const response = await this.requestManager.schedule(request, 1)

        // Validate JSON
        JSON.parse(response.data as string)

        return response.data as string

      } catch (err) {
        continue
      }
    }

    throw new Error("All mirrors failed")
  }

  // ------------------------------------------------------------
  // SEARCH + HOMEPAGE FETCHER (Unified Schema)
  // ------------------------------------------------------------
  private async fetchTiles(keyword: string, page: number): Promise<PartialSourceManga[]> {
    try {
      const variables = {
        search: {
          isManga: true,
          ...(keyword.trim() ? { query: keyword.trim() } : {})
        },
        limit: keyword.trim() ? 26 : 26,
        page,
        translationType: "sub",
        countryOrigin: "ALL"
      }

      const jsonString = await this.tryMirrors((base) =>
        `${base}?variables=${encodeURIComponent(JSON.stringify(variables))}&extensions=${encodeURIComponent(JSON.stringify({
          persistedQuery: {
            version: 1,
            sha256Hash: HASH
          }
        }))}`
      )

      const parsed = JSON.parse(jsonString) as AllMangaSearchResponse

      // THE CORRECT FIELD NAME
      const edges: AllMangaSearchResult[] = parsed?.data?.shows?.edges ?? []

      if (!edges.length) {
        return [
          App.createPartialSourceManga({
            mangaId: "debug-no-results",
            image: "https://via.placeholder.com/256?text=No+Results",
            title: "No results",
            subtitle: `keyword="${keyword}" page=${page}`
          })
        ]
      }

      return edges.map((m) =>
        App.createPartialSourceManga({
          mangaId: m._id!,
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
  // REQUIRED PAPERBACK METHODS
  // ------------------------------------------------------------
  async getMangaDetails(mangaId: string) {
    return App.createSourceManga({
      id: mangaId,
      mangaInfo: App.createMangaInfo({
        titles: [mangaId],
        image: "https://via.placeholder.com/256?text=No+Image",
        desc: "Details parser not implemented yet.",
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

  // ------------------------------------------------------------
  // SEARCH RESULTS
  // ------------------------------------------------------------
  async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
    const results = await this.fetchTiles(query.title ?? "", 1)

    return App.createPagedResults({
      results,
      metadata: undefined
    })
  }

  // ------------------------------------------------------------
  // HOMEPAGE SECTIONS (Fixed Rows)
  // ------------------------------------------------------------
  async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {

    // Row 1 — Recently Updated
    const recent = App.createHomeSection({
      id: "recent",
      title: "Recently Updated",
      type: "singleRowNormal",
      items: [],
      containsMoreItems: false
    })
    sectionCallback(recent)

    recent.items = await this.fetchTiles("", 1)
    sectionCallback(recent)

    // Row 2 — Random Picks
    const random = App.createHomeSection({
      id: "random",
      title: "Random Picks",
      type: "singleRowNormal",
      items: [],
      containsMoreItems: false
    })
    sectionCallback(random)

    random.items = await this.fetchTiles(" ", 1) // space triggers random
    sectionCallback(random)
  }

  async getTags(): Promise<TagSection[]> {
    return []
  }
}
