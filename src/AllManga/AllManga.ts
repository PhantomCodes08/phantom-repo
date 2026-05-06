import {
  Chapter,
  ChapterDetails,
  ContentRating,
  HomeSection,
  PagedResults,
  SearchRequest,
  Source,
  SourceInfo,
  SourceIntents,
  TagSection
} from "@paperback/types"

import { AllMangaParser } from "./AllMangaParser"

const BASE_URL = "https://allmanga.to"

export const AllMangaInfo: SourceInfo = {
  version: "0.0.1",
  name: "AllManga",
  icon: "icon.png",
  author: "Phantom",
  description: "AllManga source for Phantom Sources.",
  contentRating: ContentRating.MATURE,
  websiteBaseURL: BASE_URL,
  sourceTags: [],
  intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS
}

export class AllManga extends Source {
  requestManager = App.createRequestManager({
    requestsPerSecond: 4,
    requestTimeout: 20000
  })

  parser = new AllMangaParser()

  override getMangaShareUrl(mangaId: string): string {
    return `${BASE_URL}/manga/${mangaId}`
  }

  async getMangaDetails(mangaId: string) {
    return App.createSourceManga({
      id: mangaId,
      mangaInfo: App.createMangaInfo({
        titles: [mangaId],
        image: "",
        desc: "Placeholder source. AllManga parser is not connected yet.",
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
    return App.createPagedResults({
      results: [],
      metadata: undefined
    })
  }

  override async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
    const request = App.createRequest({
      url: BASE_URL,
      method: "GET"
    })

    const response = await this.requestManager.schedule(request, 1)
    const $ = this.cheerio.load(response.data)
    const items = this.parser.parseHomePage($)

    const section = App.createHomeSection({
      id: "popular",
      title: "Popular",
      items,
      containsMoreItems: false,
      type: "singleRowNormal"
    })

    sectionCallback(section)
  }

  override async getTags(): Promise<TagSection[]> {
    return []
  }
}

export default AllManga