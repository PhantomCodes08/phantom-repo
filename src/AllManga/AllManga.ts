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

// ⭐ Correct hashes
const HASH_SEARCH = "2d48e19fb67ddcac42fbb885204b6abb0a84f406f15ef83f36de4a66f49f651a"
const HASH_RANDOM = "23ea909e23c92fc54cd37121d5ada5e3b32297837c094b4ea982407d0669081e"

export const AllMangaInfo: SourceInfo = {
  version: "0.2.6",
  name: "AllManga",
  icon: "icon.png",
  author: "Phantom",
  description: "AllManga source using AllAnime backend.",
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
  // MIRROR FAILOVER
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
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json"
          }
        })

        const response = await this.requestManager.schedule(request, 1)
        JSON.parse(response.data as string)
        return response.data as string

      } catch (_) {
        continue
      }
    }

    throw new Error("All mirrors failed")
  }

  // ------------------------------------------------------------
  // SEARCH (correct)
  // ------------------------------------------------------------
  private async fetchSearch(keyword: string): Promise<PartialSourceManga[]> {
    const variables = {
      search: { query: keyword, isManga: true },
      limit: 26,
      page: 1,
      translationType: "sub",
      countryOrigin: "ALL"
    }

    const jsonString = await this.tryMirrors((base) =>
      `${base}?variables=${encodeURIComponent(JSON.stringify(variables))}&extensions=${encodeURIComponent(JSON.stringify({
        persistedQuery: { version: 1, sha256Hash: HASH_SEARCH }
      }))}`
    )

    const parsed = JSON.parse(jsonString) as AllMangaSearchResponse
    const edges = parsed?.data?.mangas?.edges ?? []

    return edges.map((m: AllMangaSearchResult) =>
      App.createPartialSourceManga({
        mangaId: m._id!,
        image: this.cover(m.thumbnail),
        title: m.englishName || m.name || m.nativeName || "Unknown Title",
        subtitle: m.nativeName || "AllManga"
      })
    )
  }

  // ------------------------------------------------------------
  // RANDOM PICKS (correct)
  // ------------------------------------------------------------
  private async fetchRandom(): Promise<PartialSourceManga[]> {
    const variables = {
      search: { sortBy: "Random" },
      limit: 26,
      page: 1,
      translationType: "sub",
      countryOrigin: "ALL"
    }

    const jsonString = await this.tryMirrors((base) =>
      `${base}?variables=${encodeURIComponent(JSON.stringify(variables))}&extensions=${encodeURIComponent(JSON.stringify({
        persistedQuery: { version: 1, sha256Hash: HASH_RANDOM }
      }))}`
    )

    const parsed = JSON.parse(jsonString) as AllMangaSearchResponse
    const edges = parsed?.data?.mangas?.edges ?? []

    return edges.map((m: AllMangaSearchResult) =>
      App.createPartialSourceManga({
        mangaId: m._id!,
        image: this.cover(m.thumbnail),
        title: m.englishName || m.name || m.nativeName || "Unknown Title",
        subtitle: m.nativeName || "AllManga"
      })
    )
  }

  // ------------------------------------------------------------
  // HOMEPAGE (RESTORED: search("", 1))
  // ------------------------------------------------------------
  private async fetchHomepageTiles(): Promise<PartialSourceManga[]> {
    return await this.fetchSearch("")
  }

  // ------------------------------------------------------------
  // SEARCH RESULTS
  // ------------------------------------------------------------
  async getSearchResults(query: SearchRequest): Promise<PagedResults> {
    const results = await this.fetchSearch(query.title ?? "")
    return App.createPagedResults({ results })
  }

  // ------------------------------------------------------------
  // HOMEPAGE SECTIONS (RESTORED)
  // ------------------------------------------------------------
  async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {

    // ⭐ Row 1 — Recently Updated (search(""))
    const recent = App.createHomeSection({
      id: "recent",
      title: "Recently Updated",
      type: "singleRowNormal",
      items: [],
      containsMoreItems: false
    })
    sectionCallback(recent)

    recent.items = await this.fetchHomepageTiles()
    sectionCallback(recent)

    // ⭐ Row 2 — Random Picks
    const random = App.createHomeSection({
      id: "random",
      title: "Random Picks",
      type: "singleRowNormal",
      items: [],
      containsMoreItems: false
    })
    sectionCallback(random)

    random.items = await this.fetchRandom()
    sectionCallback(random)
  }

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

  async getChapters(): Promise<Chapter[]> {
    return []
  }

  async getChapterDetails(): Promise<ChapterDetails> {
    return App.createChapterDetails({ id: "", mangaId: "", pages: [] })
  }

  async getTags(): Promise<TagSection[]> {
    return []
  }
}
