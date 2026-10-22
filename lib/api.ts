const BASE = "/api/v1";

async function req(path: string, init?: RequestInit) {
  const res = await fetch(BASE + path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || res.statusText);
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
  patchGallery: (id: string, body: any) => req(`/galleries/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteGallery: (id: string) => req(`/galleries/${id}`, { method: "DELETE" }),
  getProgress: (id: string) => req(`/galleries/${id}/progress`),
  setProgress: (id: string, body: { current_page: number; status: string }) =>
    req(`/galleries/${id}/progress`, { method: "PUT", body: JSON.stringify(body) }),
  setFavorite: (id: string, favorite: boolean) =>
    req(`/galleries/${id}/favorite`, { method: "PUT", body: JSON.stringify({ favorite }) }),
  listCollections: () => req("/collections"),
  createCollection: (name: string, description?: string) =>
    req("/collections", { method: "POST", body: JSON.stringify({ name, description }) }),
  getCollection: (id: string) => req(`/collections/${id}`),
  addCollectionItems: (id: string, gallery_ids: string[]) =>
    req(`/collections/${id}/items`, { method: "POST", body: JSON.stringify({ gallery_ids }) }),
  removeCollectionItem: (id: string, gid: string) =>
    req(`/collections/${id}/items/${gid}`, { method: "DELETE" }),
  startImport: (path: string) => req("/imports", { method: "POST", body: JSON.stringify({ path }) }),
  listImports: () => req("/imports"),
  getImport: (id: string) => req(`/imports/${id}`),
  listLibraryRoots: () => req("/library-roots"),
  createLibraryRoot: (path: string) => req("/library-roots", { method: "POST", body: JSON.stringify({ path }) }),
};

export type Gallery = {
  id: string;
  title: string;
  alternate_title?: string | null;
  language: string;
  page_count: number;
  favorite: boolean;
  reading_status: string;
  current_page: number;
  cover_url?: string | null;
};
