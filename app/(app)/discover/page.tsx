"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { Button, EmptyState, Skeleton } from "@/components/ui";

export default function Discover() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [local, setLocal] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<any[]>([]);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(handle);
  }, [q]);

  useEffect(() => {
    api.listMetadataSources().then(setSources).catch(() => setSources([]));
  }, []);

  useEffect(() => {
    if (!debounced.trim()) {
      setLocal([]);
      return;
    }
    setLoading(true);
    api
      .listGalleries({ q: debounced.trim(), page_size: 12 })
      .then((response: any) => setLocal(response.items || []))
      .catch(() => setLocal([]))
      .finally(() => setLoading(false));
  }, [debounced]);

  return (
    <>
      <h1 className="text-[32px] font-extrabold tracking-[-0.02em] text-text">Discover</h1>
      <p className="text-[13px] text-text-secondary">
        Search your local library instantly. Remote metadata sources stay optional and disabled by default.
      </p>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search titles, artists, tags…"
            className="w-full rounded-full border border-border bg-surface py-2.5 pl-9 pr-4 text-[14px] text-text outline-none transition focus:border-primary placeholder:text-text-muted"
          />
        </div>
        <Button variant="ghost" onClick={() => setQ("")}>
          Clear
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-text-muted">
          Local matches
        </div>
        {loading ? (
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-[260px]" />
            ))}
          </div>
        ) : !debounced.trim() ? (
          <div className="rounded-lg border border-border bg-surface px-5 py-4 text-[13px] text-text-secondary">
            Start typing to search your library. Local search works fully offline.
          </div>
        ) : local.length === 0 ? (
          <EmptyState
            icon="search"
            title="No local matches"
            description="Try another title, artist, tag, or language."
          />
        ) : (
          <div className="flex flex-wrap gap-3">
            {local.map((gallery) => (
              <Link
                key={gallery.id}
                href={`/gallery/${gallery.id}`}
                className="flex w-[260px] items-center gap-2.5 rounded-md border border-border bg-surface px-3 py-2.5 transition hover:border-primary"
              >
                <div className="h-[52px] w-10 shrink-0 overflow-hidden rounded-md bg-primary-soft">
                  {gallery.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={gallery.cover_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="line-clamp-2 text-[13px] font-semibold text-text">{gallery.title}</div>
                  <div className="text-[11px] text-text-secondary">{gallery.page_count} pages</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-text-muted">
          Metadata sources
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {sources.map((source) => (
            <div
              key={source.id}
              className="rounded-lg border border-border bg-surface p-5"
            >
              <div className="flex items-center justify-between">
                <div className="text-[15px] font-bold text-text">{source.name}</div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    source.enabled
                      ? "bg-success/10 text-success"
                      : "bg-border text-text-muted"
                  }`}
                >
                  {source.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <div className="mt-2 text-[13px] text-text-secondary">{source.description}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(source.capabilities || []).map((capability: string) => (
                  <span
                    key={capability}
                    className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary"
                  >
                    {capability}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
