export type Gallery = {
  id: string;
  title: string;
  alternate_title?: string | null;
  language: string;
  page_count: number;
  favorite: boolean;
  reading_status: "unread" | "reading" | "completed";
  current_page: number;
  cover_url?: string | null;
  date_added?: string | null;
  last_opened_at?: string | null;
  file_size: number;
  source_id?: string | null;
  missing?: boolean;
  tags?: string[];
  artists?: string[];
  pages?: GalleryPage[];
  metadata?: MetadataRecord[];
};

export type GalleryPage = {
  page_index: number;
  content_url: string;
  width?: number | null;
  height?: number | null;
};

export type GalleryDetail = Gallery & {
  tags: string[];
  artists: string[];
  pages: GalleryPage[];
  metadata: MetadataRecord[];
};

export type MetadataRecord = Record<string, unknown>;

export type Collection = {
  id: string;
  name: string;
  description?: string | null;
  item_count: number;
  created_at?: string | null;
  items?: Gallery[];
  gallery_ids?: string[];
};

export type Job = {
  id: string;
  type: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress_current: number;
  progress_total: number;
  error_code?: string | null;
  error_message?: string | null;
  result_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
};

export type LibraryRoot = {
  id: string;
  path: string;
  is_enabled: boolean;
};

export type MetadataSource = {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  capabilities?: string[];
};

export type Stats = {
  galleries: number;
  pages: number;
  favorites: number;
  collections: number;
  bytes: number;
  roots: number;
};

export type Settings = {
  preferences: Record<string, string>;
  paths: Record<string, string>;
  stats: Stats;
};

export type GalleryList = {
  items: Gallery[];
  total: number;
  page: number;
  page_size: number;
};

export type Progress = {
  current_page: number;
  status: Gallery["reading_status"];
  last_opened_at?: string | null;
};

export type GalleryQuery = Record<
  string,
  string | number | boolean | null | undefined
>;

export type GalleryPatch = Partial<
  Pick<
    Gallery,
    "title" | "alternate_title" | "language" | "favorite" | "reading_status"
  >
> & {
  tags?: string[];
};

export type CollectionPatch = {
  name?: string;
  description?: string | null;
};

export type ImportRequest = {
  path: string;
  source_id?: string;
  library_root_id?: string;
};

export type SaveSettingsResponse = {
  preferences: Record<string, string>;
};

export type RemoteSearchResult = {
  id: string;
  title: string;
  cover_url?: string | null;
  thumbnail_url?: string | null;
  page_count?: number | null;
  source?: string;
  source_url?: string;
};

export type RemoteSearchResponse = {
  items: RemoteSearchResult[];
  page?: number;
  total?: number;
};

const BASE = "/api/v1";

async function req<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as {
        error?: { message?: string };
        detail?: string;
      };
      message = body?.error?.message || body?.detail || message;
    } catch {
      try {
        message = (await res.text()) || message;
      } catch {
        // ignore
      }
    }
    throw new Error(message);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

export const api = {
  listGalleries: (params: GalleryQuery = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        qs.set(key, String(value));
      }
    });
    return req<GalleryList>("/galleries?" + qs.toString());
  },
  getGallery: (id: string) => req<GalleryDetail>(`/galleries/${id}`),
  patchGallery: (id: string, body: GalleryPatch) =>
    req<GalleryDetail>(`/galleries/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteGallery: (id: string, confirm = false) =>
    req<null>(`/galleries/${id}?confirm=${confirm}`, { method: "DELETE" }),
  getPages: (id: string) => req<GalleryPage[]>(`/galleries/${id}/pages`),
  getProgress: (id: string) => req<Progress>(`/galleries/${id}/progress`),
  setProgress: (id: string, body: { current_page: number; status: string }) =>
    req<Progress>(`/galleries/${id}/progress`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  setFavorite: (id: string, favorite: boolean) =>
    req<Gallery>(`/galleries/${id}/favorite`, {
      method: "PUT",
      body: JSON.stringify({ favorite }),
    }),
  removeFavorite: (id: string) =>
    req<null>(`/galleries/${id}/favorite`, { method: "DELETE" }),

  listCollections: () => req<Collection[]>("/collections"),
  getCollection: (id: string) => req<Collection>(`/collections/${id}`),
  createCollection: (name: string, description?: string) =>
    req<Collection>("/collections", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    }),
  patchCollection: (id: string, body: CollectionPatch) =>
    req<Collection>(`/collections/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteCollection: (id: string) =>
    req<null>(`/collections/${id}`, { method: "DELETE" }),
  addCollectionItems: (id: string, gallery_ids: string[]) =>
    req<Collection>(`/collections/${id}/items`, {
      method: "POST",
      body: JSON.stringify({ gallery_ids }),
    }),
  removeCollectionItem: (id: string, galleryId: string) =>
    req<null>(`/collections/${id}/items/${galleryId}`, { method: "DELETE" }),
  reorderCollectionItems: (id: string, gallery_ids: string[]) =>
    req<Collection>(`/collections/${id}/items/order`, {
      method: "PATCH",
      body: JSON.stringify({ gallery_ids }),
    }),

  startImport: (body: ImportRequest) =>
    req<Job>("/imports", { method: "POST", body: JSON.stringify(body) }),
  listImports: () => req<Job[]>("/imports"),
  getImport: (id: string) => req<Job>(`/imports/${id}`),
  retryImport: (id: string) =>
    req<Job>(`/imports/${id}/retry`, { method: "POST" }),
  cancelImport: (id: string) =>
    req<Job>(`/imports/${id}/cancel`, { method: "POST" }),

  listLibraryRoots: () => req<LibraryRoot[]>("/library-roots"),
  createLibraryRoot: (path: string) =>
    req<LibraryRoot>("/library-roots", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),
  deleteLibraryRoot: (id: string) =>
    req<null>(`/library-roots/${id}`, { method: "DELETE" }),

  getSettings: () => req<Settings>("/settings"),
  saveSettings: (body: Record<string, string>) =>
    req<SaveSettingsResponse>("/settings", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  getStats: () => req<Stats>("/stats"),

  listMetadataSources: () =>
    req<MetadataSource[]>("/metadata/sources"),
  lookupMetadata: (galleryId: string, sourceId = "local") =>
    req<MetadataRecord[]>(`/galleries/${galleryId}/metadata/lookup`, {
      method: "POST",
      body: JSON.stringify({ source_id: sourceId }),
    }),
  applyMetadata: (
    galleryId: string,
    recordId: string,
    fields: string[] = []
  ) =>
    req<GalleryDetail>(`/galleries/${galleryId}/metadata/apply`, {
      method: "POST",
      body: JSON.stringify({ record_id: recordId, fields }),
    }),

  searchNhentai: (q: string, page = 1) =>
    req<RemoteSearchResponse>(
      `/providers/nhentai/search?q=${encodeURIComponent(q)}&page=${page}`
    ),
  importNhentai: (id: string) =>
    req<Job>("/providers/nhentai/import", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),
};
