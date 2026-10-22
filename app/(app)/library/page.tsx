"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type Gallery } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { Button, EmptyState, Skeleton } from "@/components/ui";

const chips = [
  { label: "All", value: "" },
  { label: "Favorites", value: "favorites" },
  { label: "Reading", value: "reading" },
  { label: "Completed", value: "completed" },
  { label: "Unread", value: "unread" },
];

function LibraryInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const q = searchParams.get("q") || "";
  const statusParam = searchParams.get("status") || "";
  const sortParam = searchParams.get("sort") || "date_added";
  const viewParam = searchParams.get("view") || "grid";
  const [search, setSearch] = useState(q);
  const [chip, setChip] = useState(
    statusParam === "reading"
      ? "reading"
      : statusParam === "completed"
      ? "completed"
      : statusParam === "unread"
      ? "unread"
      : searchParams.get("favorite")
      ? "favorites"
      : "all"
  );

  useEffect(() => {
    setSearch(q);
  }, [q]);

  useEffect(() => {
    const params: Record<string, any> = { page_size: 24, page, sort: sortParam };
    if (q) params.q = q;
    if (sortParam) params.sort = sortParam;
    if (chip === "favorites") params.favorite = true;
    if (chip === "reading") params.status = "reading";
    if (chip === "completed") params.status = "completed";
    if (chip === "unread") params.status = "unread";
    setLoading(true);
    setError("");
    api
      .listGalleries(params)
      .then((response: any) => {
        setGalleries(response.items || []);
        setTotal(response.total || 0);
      })
      .catch((err: Error) => {
        setError(err.message);
        setGalleries([]);
      })
      .finally(() => setLoading(false));
  }, [q, chip, sortParam, page]);

  const updateParams = (next: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    });
    router.replace(`/library?${params.toString()}`);
  };

  const toggleFavorite = async (gallery: Gallery) => {
    try {
      await api.setFavorite(gallery.id, !gallery.favorite);
      setGalleries((current) =>
        current.map((item) =>
          item.id === gallery.id ? { ...item, favorite: !item.favorite } : item
        )
      );
    } catch {
      // leave current state
    }
  };

  const addToCollection = (gallery: Gallery) => {
    router.push(`/collections?add=${gallery.id}`);
  };

  const view = viewParam === "list" ? "list" : "grid";
  const totalPages = Math.max(1, Math.ceil(total / 24));

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-[-0.02em] text-text">Library</h1>
          <p className="text-[13px] text-text-secondary">
            {total} {total === 1 ? "gallery" : "galleries"} in your collection
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") updateParams({ q: search, page: null });
              }}
              placeholder="Search title, tags, artists…"
              className="w-[260px] rounded-full border border-border bg-surface py-2.5 pl-9 pr-4 text-[14px] text-text outline-none transition focus:border-primary placeholder:text-text-muted"
            />
          </div>
          <select
            value={sortParam}
            onChange={(event) => updateParams({ sort: event.target.value, page: null })}
            className="rounded-full border border-border bg-surface px-4 py-2.5 text-[13px] font-semibold text-text-secondary outline-none focus:border-primary"
          >
            <option value="date_added">Sort: Recent</option>
            <option value="title">Sort: Title</option>
            <option value="last_opened">Sort: Last opened</option>
            <option value="page_count">Sort: Page count</option>
          </select>
          <div className="flex gap-1 rounded-full border border-border bg-surface p-1">
            <button
              onClick={() => updateParams({ view: "grid" })}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-semibold ${
                view === "grid" ? "bg-primary-soft text-primary" : "text-text-muted"
              }`}
            >
              <Icon name="grid" size={13} /> Grid
            </button>
            <button
              onClick={() => updateParams({ view: "list" })}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-semibold ${
                view === "list" ? "bg-primary-soft text-primary" : "text-text-muted"
              }`}
            >
              <Icon name="list" size={13} /> List
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              setChip(item.value || "all");
              updateParams({ status: item.value, favorite: item.value === "favorites" ? "true" : null, page: null });
            }}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              (item.value === "favorites" && chip === "favorites") ||
              (item.value === "reading" && chip === "reading") ||
              (item.value === "completed" && chip === "completed") ||
              (item.value === "unread" && chip === "unread") ||
              (item.value === "" && chip === "all")
                ? "bg-primary text-white"
                : "border border-border bg-surface text-text-secondary"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-[13px] text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className={`flex flex-wrap gap-4 ${view === "list" ? "flex-col" : ""}`}>
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className={view === "list" ? "h-24 w-full" : "h-80 w-[200px]"} />
          ))}
        </div>
      ) : galleries.length === 0 ? (
        <EmptyState
          icon="image"
          title="No galleries found"
          description="Import a CBZ, ZIP, or folder to build your library."
          action={
            <div className="flex gap-2">
              <Link href="/imports">
                <Button variant="soft">Import files</Button>
              </Link>
              {(q || chip !== "all") && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setChip("all");
                    updateParams({ q: null, status: null, favorite: null, page: null });
                  }}
                >
                  Reset filters
                </Button>
              )}
            </div>
          }
        />
      ) : view === "list" ? (
        <div className="flex flex-col gap-3">
          {galleries.map((gallery) => (
            <div
              key={gallery.id}
              className="flex items-center gap-4 rounded-lg border border-border bg-surface p-3 transition hover:border-primary"
            >
              <Link href={`/gallery/${gallery.id}`} className="shrink-0">
                <div className="h-24 w-18 overflow-hidden rounded-md bg-primary-soft" style={{ width: 72 }}>
                  {gallery.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={gallery.cover_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/gallery/${gallery.id}`} className="line-clamp-1 text-[15px] font-bold text-text">
                  {gallery.title}
                </Link>
                <div className="mt-1 text-[12px] text-text-secondary">
                  {gallery.page_count} pages · {gallery.reading_status}
                  {gallery.favorite ? " · ★" : ""}
                  {gallery.missing ? " · missing files" : ""}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => toggleFavorite(gallery)}
                  className="rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-text-secondary hover:border-primary hover:text-primary"
                >
                  {gallery.favorite ? "★" : "☆"}
                </button>
                <button
                  onClick={() => addToCollection(gallery)}
                  className="rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-text-secondary hover:border-primary hover:text-primary"
                >
                  + Collection
                </button>
                <Link
                  href={`/reader/${gallery.id}`}
                  className="rounded-full bg-primary px-3 py-1.5 text-[12px] font-semibold text-white"
                >
                  Read
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
          {galleries.map((gallery) => (
            <div key={gallery.id} className="group flex w-[200px] flex-col overflow-hidden rounded-lg border border-border bg-surface transition hover:border-primary">
              <Link href={`/gallery/${gallery.id}`} className="block">
                <div className="relative h-[260px] w-[200px] bg-primary-soft overflow-hidden">
                  {gallery.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={gallery.cover_url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-primary">
                      <Icon name="image" size={28} />
                    </div>
                  )}
                  <span className="absolute right-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {gallery.reading_status}
                  </span>
                  {gallery.missing && (
                    <span className="absolute left-2.5 top-2.5 rounded-full bg-danger px-2 py-0.5 text-[10px] font-semibold text-white">
                      missing
                    </span>
                  )}
                </div>
              </Link>
              <div className="flex flex-col gap-1 px-3 py-2.5">
                <Link href={`/gallery/${gallery.id}`} className="line-clamp-2 min-h-[34px] text-[13px] font-semibold text-text" title={gallery.title}>
                  {gallery.title}
                </Link>
                <div className="text-[11px] text-text-secondary">
                  {gallery.page_count} pages
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  <button
                    onClick={() => toggleFavorite(gallery)}
                    className="rounded-full bg-primary-soft px-2 py-1 text-[10px] font-semibold text-primary"
                  >
                    {gallery.favorite ? "★ Favorite" : "☆ Favorite"}
                  </button>
                  <button
                    onClick={() => addToCollection(gallery)}
                    className="rounded-full bg-surface px-2 py-1 text-[10px] font-semibold text-text-secondary border border-border"
                  >
                    + Collection
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="ghost"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <span className="text-[13px] text-text-secondary">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
}

export default function Library() {
  return (
    <Suspense fallback={<div className="text-text-muted text-[13px]">Loading…</div>}>
      <LibraryInner />
    </Suspense>
  );
}
