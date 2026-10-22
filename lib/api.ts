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
  metadata?: any[];
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
  metadata: any[];
};

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
  status: string;
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

const BASE = "/api/v1";

async function req(path: string, init?: RequestInit) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
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
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  listGalleries: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    });
    return req("/galleries?" + qs.toString());
  },
  getGallery: (id: string) => req(`/galleries/${id}`),
  patchGallery: (id: string, body: any) =>
    req(`/galleries/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteGallery: (id: string, confirm = false) =>
    req(`/galleries/${id}?confirm=${confirm}`, { method: "DELETE" }),
  getPages: (id: string) => req(`/galleries/${id}/pages`),
  getProgress: (id: string) => req(`/galleries/${id}/progress`),
  setProgress: (id: string, body: { current_page: number; status: string }) =>
    req(`/galleries/${id}/progress`, { method: "PUT", body: JSON.stringify(body) }),
  setFavorite: (id: string, favorite: boolean) =>
    req(`/galleries/${id}/favorite`, { method: "PUT", body: JSON.stringify({ favorite }) }),
  removeFavorite: (id: string) => req(`/galleries/${id}/favorite`, { method: "DELETE" }),

  listCollections: () => req("/collections"),
  getCollection: (id: string) => req(`/collections/${id}`),
  createCollection: (name: string, description?: string) =>
    req("/collections", { method: "POST", body: JSON.stringify({ name, description }) }),
  patchCollection: (id: string, body: any) =>
    req(`/collections/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteCollection: (id: string) => req(`/collections/${id}`, { method: "DELETE" }),
  addCollectionItems: (id: string, gallery_ids: string[]) =>
    req(`/collections/${id}/items`, { method: "POST", body: JSON.stringify({ gallery_ids }) }),
  removeCollectionItem: (id: string, galleryId: string) =>
    req(`/collections/${id}/items/${galleryId}`, { method: "DELETE" }),
  reorderCollectionItems: (id: string, gallery_ids: string[]) =>
    req(`/collections/${id}/items/order`, {
      method: "PATCH",
      body: JSON.stringify({ gallery_ids }),
    }),

  startImport: (body: any) => req("/imports", { method: "POST", body: JSON.stringify(body) }),
  listImports: () => req("/imports"),
  getImport: (id: string) => req(`/imports/${id}`),
  retryImport: (id: string) => req(`/imports/${id}/retry`, { method: "POST" }),
  cancelImport: (id: string) => req(`/imports/${id}/cancel`, { method: "POST" }),

  listLibraryRoots: () => req("/library-roots"),
  createLibraryRoot: (path: string) =>
    req("/library-roots", { method: "POST", body: JSON.stringify({ path }) }),
  deleteLibraryRoot: (id: string) => req(`/library-roots/${id}`, { method: "DELETE" }),

  getSettings: () => req("/settings"),
  saveSettings: (body: any) => req("/settings", { method: "PUT", body: JSON.stringify(body) }),
  getStats: () => req("/stats"),

  listMetadataSources: () => req("/metadata/sources"),
  lookupMetadata: (galleryId: string, sourceId = "local") =>
    req(`/galleries/${galleryId}/metadata/lookup`, {
      method: "POST",
      body: JSON.stringify({ source_id: sourceId }),
    }),
  applyMetadata: (galleryId: string, recordId: string, fields: string[] = []) =>
    req(`/galleries/${galleryId}/metadata/apply`, {
      method: "POST",
      body: JSON.stringify({ record_id: recordId, fields }),
    }),

  listProviders: () => req("/providers"),
};
