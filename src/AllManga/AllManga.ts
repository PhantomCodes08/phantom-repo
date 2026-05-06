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
const IMAGE_CDN = "https://wp.youtube-anime.com"

const SEARCH_QUERY = `
query (
  $search: SearchInput,
  $size: Int,
  $page: Int,
  $translationType: VaildTranslationTypeEnumType,
  $countryOrigin: VaildCountryOriginEnumType
) {
  mangas(
    search: $search,
    limit: $size,
    page: $page,
    translationType: $translationType,
    countryOrigin: $countryOrigin
  ) {
    edges {
      _id
      name
      englishName
      nativeName
      thumbnail
    }
  }
}
`

export const AllMangaInfo: SourceInfo = {
  version: "0.0.7",
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
  nativeName?: string | null
  thumbnail?: string | null
}

export class AllManga extends Source {
  requestManager = App.createRequestManager({
    requestsPerSecond: 1,
    requestTimeout: 20000
  })

  override getMangaShareUrl(mangaId: string): string {
    return `${BASE_URL}/manga/${mangaId}`
  }

  private fixImage(url?: string | null): string {
    if (!url) return ""
    if (url.startsWith("http")) return url
    return `${IMAGE_CDN}/${url.replace(/^\/+/, "")}`
  }

  private makeSearchPayload(search: string, page: number) {
    return {
      query: SEARCH_QUERY,
      variables: {
        search: {
          query: search.length > 0 ? search : undefined,
          isManga: true,
          allowAdult: true,
          allowUnknown: false
        },
        size: 20,
        page,
        translationType: "sub",
        countryOrigin: "ALL"
      }
    }
  }

  private async getMangaList(search: string, page: number): Promise<PartialSourceManga[]> {
    const request = App.createRequest({
      url: API_URL,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Referer": `${BASE_URL}/`
      },
      data: JSON.stringify(this.makeSearchPayload(search, page))
    })

    const response = await this.requestManager.schedule(request, 1)
    const json = JSON.parse(response.data as string)

    const edges: AllMangaItem[] = json?.data?.mangas?.edges ?? []

    return edges.map((manga) =>
      App.createPartialSourceManga({
        mangaId: manga._id,
        image: this.fixImage(manga.thumbnail),
        title: manga.englishName || manga.name,
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

  override async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
    const page = metadata?.page ?? 1
    const searchQuery = query.title ?? ""

    const results = await this.getMangaList(searchQuery, page)

    return App.createPagedResults({
      results,
      metadata: results.length === 20 ? { page: page + 1 } : undefined
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