"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type Gallery, type GalleryQuery } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { Button, EmptyState, IconButton, Skeleton } from "@/components/ui";

const chips = [
  { label: "All", value: "" },
  { label: "Favorites", value: "favorites" },
  { label: "Reading", value: "reading" },
  { label: "Completed", value: "completed" },
  { label: "Unread", value: "unread" },
];

const PAGE_SIZE = 24;

function Cover({ gallery, className = "" }: { gallery: Gallery; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-primary-soft ${className}`}>
      {gallery.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={gallery.cover_url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-primary">
          <Icon name="image" size={24} />
        </div>
      )}
      {gallery.missing && (
        <span className="absolute left-2 top-2 rounded-full bg-danger px-2 py-0.5 text-[9px] font-bold text-white">
          Missing
        </span>
      )}
    </div>
  );
}

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(q);
  }, [q]);

  useEffect(() => {
    const params: GalleryQuery = { page_size: PAGE_SIZE, page, sort: sortParam };
    if (q) params.q = q;
    if (chip === "favorites") params.favorite = true;
    if (chip === "reading") params.status = "reading";
    if (chip === "completed") params.status = "completed";
    if (chip === "unread") params.status = "unread";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    api
      .listGalleries(params)
      .then((response) => {
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

  useEffect(() => {
    // Search as you type: update the query after a short pause, so the grid
    // filters without requiring Enter. Enter still applies it immediately.
    const handle = window.setTimeout(() => {
      const next = search.trim();
      if (next === q) return;
      updateParams({ q: next || null, page: null });
    }, 350);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const toggleFavorite = async (gallery: Gallery) => {
    try {
      await api.setFavorite(gallery.id, !gallery.favorite);
      setGalleries((current) =>
        current.map((item) =>
          item.id === gallery.id ? { ...item, favorite: !item.favorite } : item
        )
      );
    } catch {
      // Keep the previous state when the request fails.
    }
  };

  const addToCollection = (gallery: Gallery) => {
    router.push(`/collections?add=${gallery.id}`);
  };

  const view = viewParam === "list" ? "list" : "grid";
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isFiltered = Boolean(q || chip !== "all");

  return (
    <>
      <header className="flex items-end justify-between gap-4 pt-1 md:pt-0">
        <div>
          <h1 className="text-[34px] font-extrabold leading-none tracking-[-0.045em] text-text md:text-[40px]">
            Library
          </h1>
          <p className="mt-2 text-[13px] text-text-secondary">
            {loading ? "Opening your shelves…" : `${total} ${total === 1 ? "gallery" : "galleries"}`}
          </p>
        </div>
        <Link href="/imports" aria-label="Import files">
          <IconButton
            icon="plus"
            label="Import files"
            className="!border-transparent !bg-primary-soft !text-primary"
          />
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-full md:basis-[420px] md:max-w-[520px]">
          <Icon
            name="search"
            size={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") updateParams({ q: search, page: null });
            }}
            placeholder="Search titles, artists, tags"
            aria-label="Search library"
            className="h-12 w-full rounded-2xl border border-border bg-surface py-2 pl-11 pr-11 text-[16px] text-text outline-none transition placeholder:text-text-muted focus:border-primary md:h-11 md:text-[14px]"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                updateParams({ q: null, page: null });
              }}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-text-muted"
              aria-label="Clear search"
            >
              <Icon name="x" size={15} />
            </button>
          )}
        </div>

        <div className="flex w-full items-center gap-2 md:ml-auto md:w-auto">
          <div className="relative min-w-0">
            <select
              value={sortParam}
              onChange={(event) => updateParams({ sort: event.target.value, page: null })}
              aria-label="Sort galleries"
              className="h-10 appearance-none rounded-full border border-border bg-surface pl-3.5 pr-9 text-[12px] font-semibold text-text-secondary outline-none focus:border-primary"
            >
              <option value="date_added">Newest</option>
              <option value="title">Title</option>
              <option value="last_opened">Last opened</option>
              <option value="page_count">Page count</option>
            </select>
            <Icon
              name="chevron-down"
              size={13}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
          </div>

          <div className="ml-auto flex rounded-full border border-border bg-surface p-1">
            {[
              { value: "grid", icon: "grid" as const, label: "Grid view" },
              { value: "list", icon: "list" as const, label: "List view" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateParams({ view: option.value })}
                aria-label={option.label}
                aria-pressed={view === option.value}
                className={`flex h-8 w-9 items-center justify-center rounded-full transition ${
                  view === option.value
                    ? "bg-primary-soft text-primary"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                <Icon name={option.icon} size={15} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {chips.map((item) => {
          const active = item.value === "" ? chip === "all" : chip === item.value;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setChip(item.value || "all");
                updateParams({
                  status: item.value === "favorites" ? null : item.value,
                  favorite: item.value === "favorites" ? "true" : null,
                  page: null,
                });
              }}
              className={`min-h-9 shrink-0 rounded-full px-3.5 text-[12px] font-semibold transition ${
                active
                  ? "bg-text text-white"
                  : "border border-border bg-surface text-text-secondary hover:border-border-strong"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3 text-[13px] text-danger">
          {error}
        </div>
      )}

      {loading ? (
        view === "list" ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-[112px] w-full rounded-[20px]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 min-[390px]:grid-cols-3 md:grid-cols-[repeat(auto-fill,minmax(154px,1fr))] md:gap-x-5 md:gap-y-7">
            {Array.from({ length: 9 }).map((_, index) => (
              <div key={index}>
                <Skeleton className="aspect-[3/4] w-full rounded-[18px]" />
                <Skeleton className="mt-2.5 h-3.5 w-4/5 rounded-full" />
                <Skeleton className="mt-1.5 h-2.5 w-1/3 rounded-full" />
              </div>
            ))}
          </div>
        )
      ) : galleries.length === 0 ? (
        <EmptyState
          icon={isFiltered ? "search" : "image"}
          title={isFiltered ? "Nothing on this shelf" : "Your library is empty"}
          description={
            isFiltered
              ? "Try a different search or clear the filters."
              : "Import a CBZ, ZIP, image, or folder to start your collection."
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {isFiltered ? (
                <Button
                  variant="soft"
                  onClick={() => {
                    setSearch("");
                    setChip("all");
                    updateParams({ q: null, status: null, favorite: null, page: null });
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Link href="/imports">
                  <Button variant="soft">Import files</Button>
                </Link>
              )}
            </div>
          }
        />
      ) : view === "list" ? (
        <div className="flex flex-col gap-2.5">
          {galleries.map((gallery) => (
            <div
              key={gallery.id}
              className="flex items-center gap-3.5 rounded-[20px] border border-border/80 bg-surface p-2.5 pr-3 transition hover:border-border-strong"
            >
              <Link href={`/gallery?id=${gallery.id}`} className="shrink-0">
                <Cover gallery={gallery} className="h-[92px] w-[69px] rounded-[14px]" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/gallery?id=${gallery.id}`}
                  className="line-clamp-2 text-[14px] font-semibold leading-snug text-text"
                >
                  {gallery.title}
                </Link>
                <div className="mt-1 text-[11px] text-text-muted">
                  {gallery.page_count} pages · {gallery.reading_status}
                  {gallery.favorite ? " · Favorited" : ""}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <Link
                    href={`/reader?id=${gallery.id}`}
                    className="inline-flex min-h-8 items-center gap-1 rounded-full bg-primary-soft px-3 text-[11px] font-semibold text-primary"
                  >
                    <Icon name="play" size={11} />
                    Read
                  </Link>
                  <button
                    type="button"
                    onClick={() => addToCollection(gallery)}
                    className="inline-flex min-h-8 items-center rounded-full border border-border px-3 text-[11px] font-semibold text-text-secondary"
                  >
                    Add to list
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleFavorite(gallery)}
                aria-label={gallery.favorite ? "Remove from favorites" : "Add to favorites"}
                aria-pressed={gallery.favorite}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  gallery.favorite ? "bg-primary-soft text-primary" : "text-text-muted"
                }`}
              >
                <Icon name={gallery.favorite ? "heart" : "star"} size={18} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 min-[390px]:grid-cols-3 md:grid-cols-[repeat(auto-fill,minmax(154px,1fr))] md:gap-x-5 md:gap-y-7">
          {galleries.map((gallery) => (
            <div key={gallery.id} className="group min-w-0">
              <div className="relative">
                <Link href={`/gallery?id=${gallery.id}`} className="block">
                  <Cover
                    gallery={gallery}
                    className="aspect-[3/4] w-full rounded-[18px] shadow-card ring-1 ring-black/[0.05] transition duration-300 group-hover:-translate-y-1"
                  />
                </Link>
                <button
                  type="button"
                  onClick={() => toggleFavorite(gallery)}
                  aria-label={gallery.favorite ? "Remove from favorites" : "Add to favorites"}
                  aria-pressed={gallery.favorite}
                  className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition ${
                    gallery.favorite
                      ? "bg-white/90 text-primary"
                      : "bg-black/25 text-white/85 hover:bg-black/40"
                  }`}
                >
                  <Icon name="heart" size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => addToCollection(gallery)}
                  aria-label="Add to collection"
                  className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-text-secondary shadow-sm backdrop-blur-md transition hover:text-primary"
                >
                  <Icon name="plus" size={14} />
                </button>
                {gallery.reading_status === "reading" && (
                  <span className="absolute left-2 top-2 rounded-full bg-white/88 px-2 py-1 text-[9px] font-bold text-primary backdrop-blur-md">
                    Reading
                  </span>
                )}
              </div>
              <Link href={`/gallery?id=${gallery.id}`} className="block">
                <div
                  className="mt-2.5 line-clamp-2 min-h-[34px] text-[13px] font-semibold leading-[1.3] tracking-[-0.01em] text-text"
                  title={gallery.title}
                >
                  {gallery.title}
                </div>
                <div className="mt-0.5 text-[11px] text-text-muted">
                  {gallery.page_count} pages
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <IconButton
            icon="arrow-left"
            label="Previous page"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          />
          <span className="min-w-24 text-center text-[12px] font-semibold tabular-nums text-text-secondary">
            {page} / {totalPages}
          </span>
          <IconButton
            icon="arrow-right"
            label="Next page"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          />
        </div>
      )}
    </>
  );
}

export default function Library() {
  return (
    <Suspense fallback={<div className="text-[13px] text-text-muted">Opening library…</div>}>
      <LibraryInner />
    </Suspense>
  );
}
