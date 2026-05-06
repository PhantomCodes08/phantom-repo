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

const BASE_URL = "https://allmanga.to"
const API_URL = "https://api.allanime.day/api"
const CDN_URL = "https://wp.youtube-anime.com/aln.youtube-anime.com"

export const AllMangaInfo: SourceInfo = {
  version: "0.0.2",
  name: "AllManga",
  icon: "icon.png",
  author: "Phantom",
  description: "AllManga source for Phantom Sources.",
  contentRating: ContentRating.MATURE,
  websiteBaseURL: BASE_URL,
  sourceTags: [],
  intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS
}

type AllMangaItem = {
  _id: string
  name: string
  englishName?: string | null
  thumbnail?: string | null
}

export class AllManga extends Source {
  requestManager = App.createRequestManager({
    requestsPerSecond: 4,
    requestTimeout: 20000
  })

  override getMangaShareUrl(mangaId: string): string {
    return `${BASE_URL}/manga/${mangaId}`
  }

  private fixImage(url?: string | null): string {
  if (!url) return ""

  if (url.startsWith("http")) {
    return url
  }

  return `https://wp.youtube-anime.com/${url}`
}

  private makeSearchUrl(search: string, page: number): string {
    const variables = {
      search: {
        query: search,
        isManga: true
      },
      limit: 26,
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

    return `${API_URL}?variables=${encodeURIComponent(JSON.stringify(variables))}&extensions=${encodeURIComponent(JSON.stringify(extensions))}`
  }

  private async getMangaList(search: string, page: number): Promise<PartialSourceManga[]> {
    const request = App.createRequest({
      url: this.makeSearchUrl(search, page),
      method: "GET",
      headers: {
        "Referer": BASE_URL,
        "Origin": BASE_URL
      }
    })

    const response = await this.requestManager.schedule(request, 1)
    const json = JSON.parse(response.data as string)

    const edges: AllMangaItem[] = json?.data?.mangas?.edges ?? []

    return edges.map((item) =>
      App.createPartialSourceManga({
        mangaId: item._id,
        image: this.fixImage(item.thumbnail),
        title: item.englishName || item.name
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

  override async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
    const page = metadata?.page ?? 1
    const searchQuery = query.title ?? ""

    const results = await this.getMangaList(searchQuery, page)

    return App.createPagedResults({
      results,
      metadata: { page: page + 1 }
    })
  }

  override async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
    const section = App.createHomeSection({
      id: "popular",
      title: "Popular",
      items: [],
      containsMoreItems: false,
      type: "singleRowNormal"
    })

    sectionCallback(section)

    section.items = await this.getMangaList("solo", 1)
    sectionCallback(section)
  }

  override async getTags(): Promise<TagSection[]> {
    return []
  }
}

export default AllManga