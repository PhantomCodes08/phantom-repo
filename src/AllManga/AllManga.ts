import {
  Chapter,
  ChapterDetails,
  ContentRating,
  HomeSection,
  HomePageSectionsProviding,
  MangaProviding,
  PagedResults,
  PartialSourceManga,
  Request,
  Response,
  SearchRequest,
  SearchResultsProviding,
  SourceInfo,
  SourceIntents,
  SourceManga,
  TagSection
} from "@paperback/types"

import { AllMangaParser } from "./AllMangaParser"

const SITE = "https://allmanga.to"
const API = "https://api.allanime.day/api"

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
  version: "0.1.0",
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

export class AllManga
  implements
    SearchResultsProviding,
    MangaProviding,
    HomePageSectionsProviding
{
  baseUrl = SITE
  apiUrl = API
  parser = new AllMangaParser()

  requestManager = App.createRequestManager({
    requestsPerSecond: 1,
    requestTimeout: 20000,
    interceptor: {
      interceptRequest: async (request: Request): Promise<Request> => {
        request.headers = {
          ...(request.headers ?? {}),
          "user-agent": await this.requestManager.getDefaultUserAgent(),
          referer: `${this.baseUrl}/`,
          origin: this.baseUrl,
          "content-type": "application/json"
        }
        return request
      },
      interceptResponse: async (response: Response): Promise<Response> => {
        return response
      }
    }
  })

  getMangaShareUrl(mangaId: string): string {
    return `${this.baseUrl}/manga/${mangaId}`
  }

  private makeSearchBody(keyword: string, page: number): string {
    return JSON.stringify({
      query: SEARCH_QUERY,
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

  private async requestSearch(keyword: string, page: number): Promise<PartialSourceManga[]> {
    const request = App.createRequest({
      url: this.apiUrl,
      method: "POST",
      data: this.makeSearchBody(keyword, page)
    })

    const response = await this.requestManager.schedule(request, 1)
    this.checkResponseError(response)

    const raw = response.data as string
    const results = this.parser.parseSearchResults(raw)
  }

  async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
    const page = metadata?.page ?? 1
    const keyword = query.title ?? ""

    const results = await this.requestSearch(keyword, page)

    return App.createPagedResults({
      results,
      metadata: results.length === 20 ? { page: page + 1 } : undefined
    })
  }

  async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
    const popular = App.createHomeSection({
      id: "phantom-popular",
      title: "Phantom Picks",
      items: [],
      containsMoreItems: true,
      type: "singleRowNormal"
    })

    sectionCallback(popular)

    popular.items = await this.requestSearch("solo", 1)
    sectionCallback(popular)
  }

  async getViewMoreItems(
    homepageSectionId: string,
    metadata: any
  ): Promise<PagedResults> {
    const page = metadata?.page ?? 1
    const results = await this.requestSearch("solo", page)

    return App.createPagedResults({
      results,
      metadata: results.length === 20 ? { page: page + 1 } : undefined
    })
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
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

  async getCloudflareBypassRequest(): Promise<Request> {
    return App.createRequest({
      url: this.baseUrl,
      method: "GET",
      headers: {
        "user-agent": await this.requestManager.getDefaultUserAgent(),
        referer: `${this.baseUrl}/`
      }
    })
  }

  async getTags(): Promise<TagSection[]> {
    return []
  }

  private checkResponseError(response: Response): void {
    const status = response.status

    if (status === 403 || status === 503) {
      throw new Error(`AllManga Cloudflare/API error: ${status}. Tap the cloud icon for this source.`)
    }

    if (status === 404) {
      throw new Error("AllManga endpoint not found. The API may have changed.")
    }
  }
}

export default AllManga