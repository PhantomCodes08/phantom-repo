"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllManga = exports.AllMangaInfo = void 0;
const types_1 = require("@paperback/types");
const AllMangaParser_1 = require("./AllMangaParser");
const SITE = "https://allmanga.to";
const API = "https://api.allanime.day/api";
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
`;
exports.AllMangaInfo = {
    version: "0.1.0",
    name: "AllManga",
    icon: "icon.png",
    author: "Phantom",
    description: "Phantom-built AllManga source for Paperback.",
    contentRating: types_1.ContentRating.MATURE,
    websiteBaseURL: SITE,
    sourceTags: [],
    intents: types_1.SourceIntents.MANGA_CHAPTERS |
        types_1.SourceIntents.HOMEPAGE_SECTIONS |
        types_1.SourceIntents.CLOUDFLARE_BYPASS_REQUIRED
};
class AllManga {
    constructor() {
        this.baseUrl = SITE;
        this.apiUrl = API;
        this.parser = new AllMangaParser_1.AllMangaParser();
        this.requestManager = App.createRequestManager({
            requestsPerSecond: 1,
            requestTimeout: 20000,
            interceptor: {
                interceptRequest: async (request) => {
                    request.headers = {
                        ...(request.headers ?? {}),
                        "user-agent": await this.requestManager.getDefaultUserAgent(),
                        referer: `${this.baseUrl}/`,
                        origin: this.baseUrl,
                        "content-type": "application/json"
                    };
                    return request;
                },
                interceptResponse: async (response) => {
                    return response;
                }
            }
        });
    }
    getMangaShareUrl(mangaId) {
        return `${this.baseUrl}/manga/${mangaId}`;
    }
    makeSearchBody(keyword, page) {
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
        });
    }
    async requestSearch(keyword, page) {
        const request = App.createRequest({
            url: this.apiUrl,
            method: "POST",
            data: this.makeSearchBody(keyword, page)
        });
        const response = await this.requestManager.schedule(request, 1);
        this.checkResponseError(response);
        const raw = response.data;
        const results = this.parser.parseSearchResults(raw);
        if (results.length === 0) {
            return this.parser.parseDebugTile(raw);
        }
        return results;
    }
    async getSearchResults(query, metadata) {
        const page = metadata?.page ?? 1;
        const keyword = query.title ?? "";
        const results = await this.requestSearch(keyword, page);
        return App.createPagedResults({
            results,
            metadata: results.length === 20 ? { page: page + 1 } : undefined
        });
    }
    async getHomePageSections(sectionCallback) {
        const popular = App.createHomeSection({
            id: "phantom-popular",
            title: "Phantom Picks",
            items: [],
            containsMoreItems: false,
            type: "singleRowNormal"
        });
        sectionCallback(popular);
        popular.items = await this.requestSearch("solo", 1);
        sectionCallback(popular);
    }
    async getMangaDetails(mangaId) {
        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [mangaId],
                image: "",
                desc: "Details parser not connected yet.",
                status: "unknown"
            })
        });
    }
    async getChapters(mangaId) {
        return [];
    }
    async getChapterDetails(mangaId, chapterId) {
        return App.createChapterDetails({
            id: chapterId,
            mangaId,
            pages: []
        });
    }
    async getCloudflareBypassRequest() {
        return App.createRequest({
            url: this.baseUrl,
            method: "GET",
            headers: {
                "user-agent": await this.requestManager.getDefaultUserAgent(),
                referer: `${this.baseUrl}/`
            }
        });
    }
    async getTags() {
        return [];
    }
    checkResponseError(response) {
        const status = response.status;
        if (status === 403 || status === 503) {
            throw new Error(`AllManga Cloudflare/API error: ${status}. Tap the cloud icon for this source.`);
        }
        if (status === 404) {
            throw new Error("AllManga endpoint not found. The API may have changed.");
        }
    }
}
exports.AllManga = AllManga;
exports.default = AllManga;
//# sourceMappingURL=AllManga.js.map