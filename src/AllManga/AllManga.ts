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

// Correct hashes
const HASH_SEARCH = "2d48e19fb67ddcac42fbb885204b6abb0a84f406f15ef83f36de4a66f49f651a"
const HASH_RANDOM = "23ea909e23c92fc54cd37121d5ada5e3b32297837c094b4ea982407d0669081e"

// Chapter list hash
const HASH_CHAPTER_LIST = "ae7b2ed82ce3bf6fe9af426372174468958a066694167e6800bfcb3fcbdbb460"

// Chapter pages hash
const HASH_CHAPTER_PAGES = "466783e19a7540387e34265be906bebbe853857088d45d28af922ab8668ebb31"

export const AllMangaInfo: SourceInfo = {
  version: "0.3.1",
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

  // ⭐ Bulletproof thumbnail handler
  private cover(path?: string | null): string {
    if (!path || path.trim() === "")
      return "https://allmanga.to/assets/logo512.png"

    const clean = path.split("?")[0]
    return clean.trim()
  }

  // ⭐ English‑preferred title logic
  private titleFor(m: AllMangaSearchResult): string {
    if (m.englishName && m.englishName.trim() !== "")
      return m.englishName.trim()

    if (m.name && m.name.trim() !== "")
      return m.name.trim()

    if (m.nativeName && m.nativeName.trim() !== "")
      return m.nativeName.trim()

    return "Untitled"
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
  // SEARCH
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
        title: this.titleFor(m),
        subtitle: m.nativeName || "AllManga"
      })
    )
  }

  // ------------------------------------------------------------
  // RANDOM PICKS
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
        title: this.titleFor(m),
        subtitle: m.nativeName || "AllManga"
      })
    )
  }

  // ------------------------------------------------------------
  // HOMEPAGE
  // ------------------------------------------------------------
  private async fetchHomepageTiles(): Promise<PartialSourceManga[]> {
    return await this.fetchSearch("")
  }

  async getSearchResults(query: SearchRequest): Promise<PagedResults> {
    const results = await this.fetchSearch(query.title ?? "")
    return App.createPagedResults({ results })
  }

  // ------------------------------------------------------------
  // HOMEPAGE SECTIONS (two rows + random)
  // ------------------------------------------------------------
  async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {

    const results = await this.fetchHomepageTiles()
    const half = Math.ceil(results.length / 2)

    const row1Items = results.slice(0, half)
    const row2Items = results.slice(half)

    // Row 1
    const recent1 = App.createHomeSection({
      id: "recent_1",
      title: "Recently Updated (1)",
      type: "singleRowNormal",
      items: [],
      containsMoreItems: false
    })
    sectionCallback(recent1)

    recent1.items = row1Items
    sectionCallback(recent1)

    // Row 2
    const recent2 = App.createHomeSection({
      id: "recent_2",
      title: "Recently Updated (2)",
      type: "singleRowNormal",
      items: [],
      containsMoreItems: false
    })
    sectionCallback(recent2)

    recent2.items = row2Items
    sectionCallback(recent2)

    // Random Picks
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

  // ------------------------------------------------------------
  // MANGA DETAILS
  // ------------------------------------------------------------
  async getMangaDetails(mangaId: string) {
    return App.createSourceManga({
      id: mangaId,
      mangaInfo: App.createMangaInfo({
        titles: [mangaId],
        image: "https://allmanga.to/assets/logo512.png",
        desc: "Details not implemented yet.",
        status: "ONGOING"
      })
    })
  }

  // ------------------------------------------------------------
  // CHAPTER LIST
  // ------------------------------------------------------------
  async getChapters(mangaId: string): Promise<Chapter[]> {

    const variables = {
      showId: `manga@${mangaId}`,
      episodeNumStart: 0,
      episodeNumEnd: 500
    }

    const jsonString = await this.tryMirrors((base) =>
      `${base}?variables=${encodeURIComponent(JSON.stringify(variables))}&extensions=${encodeURIComponent(JSON.stringify({
        persistedQuery: {
          version: 1,
          sha256Hash: HASH_CHAPTER_LIST
        }
      }))}`
    )

    const parsed = JSON.parse(jsonString)
    const eps = parsed?.data?.show?.episodes ?? []

    return eps.map((ep: any) =>
      App.createChapter({
        id: ep.episodeId,
        mangaId,
        chapNum: parseFloat(ep.episodeNum),
        name: ep.title || `Chapter ${ep.episodeNum}`,
        time: new Date()
      })
    )
  }

  // ------------------------------------------------------------
  // CHAPTER PAGES
  // ------------------------------------------------------------
  async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {

    const variables = {
      mangaId,
      translationType: "sub",
      chapterString: chapterId,
      limit: 500,
      offset: 0
    }

    const jsonString = await this.tryMirrors((base) =>
      `${base}?variables=${encodeURIComponent(JSON.stringify(variables))}&extensions=${encodeURIComponent(JSON.stringify({
        persistedQuery: {
          version: 1,
          sha256Hash: HASH_CHAPTER_PAGES
        }
      }))}`
    )

    const parsed = JSON.parse(jsonString)
    const pages = parsed?.data?.manga?.chapter?.pages?.map((p: any) => p.img) ?? []

    return App.createChapterDetails({
      id: chapterId,
      mangaId,
      pages
    })
  }

  async getTags(): Promise<TagSection[]> {
    return []
  }
}
