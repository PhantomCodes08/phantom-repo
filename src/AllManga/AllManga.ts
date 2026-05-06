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

const SITE = "https://allmanga.to"
const API = "https://api.allanime.day/api"
const COVER_CDN = "https://wp.youtube-anime.com"

export const AllMangaInfo: SourceInfo = {
  version: "0.1.3",
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

type AllMangaResult = {
  _id?: string
  name?: string
  englishName?: string | null
  nativeName?: string | null
  thumbnail?: string | null
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
    if (!path) return ""
    if (path.startsWith("http")) return encodeURI(path)
    return encodeURI(`${COVER_CDN}/${path.replace(/^\/+/, "")}`)
  }

  private searchUrl(keyword: string, page: number): string {
    const variables = {
      search: {
        query: keyword.trim().length > 0 ? keyword.trim() : undefined,
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
        sha256Hash: "72d48e19fb67ddcac42fbb885204b6abb0a84ff406f15ef83f36de4a66f4f9651"
      }
    }

    return `${API}?variables=${encodeURIComponent(JSON.stringify(variables))}&extensions=${encodeURIComponent(JSON.stringify(extensions))}`
  }

  private async fetchTiles(keyword: string, page: number): Promise<PartialSourceManga[]> {
    const request = App.createRequest({
      url: this.searchUrl(keyword, page),
      method: "GET",
      headers: {
        "Referer": `${SITE}/`,
        "Origin": SITE
      }
    })

    const response = await this.requestManager.schedule(request, 1)
    const parsed = JSON.parse(response.data as string)

    const edges: AllMangaResult[] = parsed?.data?.mangas?.edges ?? []

    return edges
      .filter((manga) => manga._id && (manga.englishName || manga.name || manga.nativeName))
      .map((manga) =>
        App.createPartialSourceManga({
          mangaId: manga._id!,
          image: this.cover(manga.thumbnail),
          title: manga.englishName || manga.name || manga.nativeName || "Unknown Title",
          subtitle: manga.nativeName || "AllManga"
        })
      )
  }

  async getMangaDetails(mangaId: string) {
    return App.createSourceManga({
      id: mangaId,
      mangaInfo: App.createMangaInfo({
        titles: [mangaId],
        image: "",
        desc: "Details parser not connected yet.",
        status: "unknown"
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
    const page = metadata?.page ?? 1
    const keyword = query.title ?? ""

    const results = await this.fetchTiles(keyword, page)

    return App.createPagedResults({
      results,
      metadata: results.length === 20 ? { page: page + 1 } : undefined
    })
  }

  async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
    const section = App.createHomeSection({
      id: "phantom-picks",
      title: "Phantom Picks",
      items: [],
      containsMoreItems: false,
      type: "singleRowNormal"
    })

    sectionCallback(section)

    section.items = await this.fetchTiles("solo", 1)
    sectionCallback(section)
  }

  async getTags(): Promise<TagSection[]> {
    return []
  }
}

export default AllManga