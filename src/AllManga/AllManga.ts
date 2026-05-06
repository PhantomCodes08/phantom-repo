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

const ALLMANGA_SEARCH_QUERY = `
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
  version: "0.0.8",
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
    requestTimeout: 20000,
    interceptor: {
      interceptRequest: async (request) => {
        request.headers = {
          ...(request.headers ?? {}),
          referer: `${SITE}/`,
          origin: SITE,
          "content-type": "application/json",
          "user-agent": await this.requestManager.getDefaultUserAgent()
        }

        return request
      },
      interceptResponse: async (response) => {
        return response
      }
    }
  })

  override getMangaShareUrl(mangaId: string): string {
    return `${SITE}/manga/${mangaId}`
  }

  private cover(path?: string | null): string {
    if (!path) return ""

    if (path.startsWith("http://") || path.startsWith("https://")) {
      return encodeURI(path)
    }

    return encodeURI(`${COVER_CDN}/${path.replace(/^\/+/, "")}`)
  }

  private searchBody(keyword: string, page: number): string {
    return JSON.stringify({
      query: ALLMANGA_SEARCH_QUERY,
      variables: {
        search: {
          query: keyword.trim().length > 0 ? keyword.trim() : undefined,
          isManga: true,
          allowAdult: true,
          allowUnknown: false
        },
        size: 20,
        page,
        translationType: "sub",
        countryOrigin: "ALL"
      }
    })
  }

  private async fetchTiles(keyword: string, page: number): Promise<PartialSourceManga[]> {
    const request = App.createRequest({
      url: API,
      method: "POST",
      data: this.searchBody(keyword, page)
    })

    const response = await this.requestManager.schedule(request, 1)

    const parsed = JSON.parse(response.data as string)
    const edges: AllMangaResult[] = parsed?.data?.mangas?.edges ?? []

    const tiles: PartialSourceManga[] = []

    for (const manga of edges) {
      const id = manga._id
      const title = manga.englishName || manga.name || manga.nativeName || ""

      if (!id || !title) continue

      tiles.push(
        App.createPartialSourceManga({
          mangaId: id,
          image: this.cover(manga.thumbnail),
          title,
          subtitle: manga.nativeName || "AllManga"
        })
      )
    }

    return tiles
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
    const keyword = query.title ?? ""

    const results = await this.fetchTiles(keyword, page)

    return App.createPagedResults({
      results,
      metadata: results.length === 20 ? { page: page + 1 } : undefined
    })
  }

  override async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
    const section = App.createHomeSection({
      id: "phantom-popular",
      title: "Phantom Picks",
      items: [],
      containsMoreItems: false,
      type: "singleRowNormal"
    })

    sectionCallback(section)

    section.items = await this.fetchTiles("solo", 1)
    sectionCallback(section)
  }

  override async getTags(): Promise<TagSection[]> {
    return []
  }
}

export default AllManga