import { Chapter, ChapterDetails, HomeSection, HomePageSectionsProviding, MangaProviding, PagedResults, Request, SearchRequest, SearchResultsProviding, SourceInfo, SourceManga, TagSection } from "@paperback/types";
export declare const AllMangaInfo: SourceInfo;
export declare class AllManga implements SearchResultsProviding, MangaProviding, HomePageSectionsProviding {
    baseUrl: string;
    apiUrl: string;
    parser: any;
    requestManager: import("@paperback/types").RequestManager;
    getMangaShareUrl(mangaId: string): string;
    private makeSearchBody;
    private requestSearch;
    getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults>;
    getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void>;
    getMangaDetails(mangaId: string): Promise<SourceManga>;
    getChapters(mangaId: string): Promise<Chapter[]>;
    getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails>;
    getCloudflareBypassRequest(): Promise<Request>;
    getTags(): Promise<TagSection[]>;
    private checkResponseError;
}
export default AllManga;
//# sourceMappingURL=AllManga.d.ts.map