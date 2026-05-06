export type AllMangaSearchResult = {
    _id?: string;
    id?: string;
    name?: string;
    englishName?: string | null;
    nativeName?: string | null;
    thumbnail?: string | null;
};
export type AllMangaSearchResponse = {
    data?: {
        mangas?: {
            edges?: AllMangaSearchResult[];
        };
    };
    errors?: unknown[];
};
//# sourceMappingURL=AllMangaTypes.d.ts.map