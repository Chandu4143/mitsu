"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, type Gallery } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { EmptyState, Skeleton } from "@/components/ui";

function relativeDay(value?: string | null) {
  if (!value) return "Earlier";
  const date = new Date(value);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const time = date.getTime();
  const dayMs = 86_400_000;
  if (time >= startOfToday) return "Today";
  if (time >= startOfToday - dayMs) return "Yesterday";
  if (time >= startOfToday - dayMs * 7) return "This week";
  if (time >= startOfToday - dayMs * 30) return "This month";
  return "Earlier";
}

function formatTime(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const [items, setItems] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getHistory(100)
      .then(setItems)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => {
    const order = ["Today", "Yesterday", "This week", "This month", "Earlier"];
    const map = new Map<string, Gallery[]>();
    items.forEach((item) => {
      const key = relativeDay(item.last_opened_at);
      map.set(key, [...(map.get(key) || []), item]);
    });
    return order
      .filter((key) => map.has(key))
      .map((key) => ({ label: key, items: map.get(key) || [] }));
  }, [items]);

  const finished = items.filter((item) => item.reading_status === "completed").length;

  return (
    <>
      <header className="flex items-end justify-between gap-4 pt-1 md:pt-0">
        <div>
          <h1 className="text-[34px] font-extrabold leading-none tracking-[-0.045em] text-text md:text-[40px]">
            History
          </h1>
          <p className="mt-2 max-w-[44ch] text-[13px] leading-relaxed text-text-secondary">
            Every gallery you have opened, newest first. Pick up right where you stopped.
          </p>
        </div>
        {items.length > 0 && (
          <div className="hidden shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-[12px] font-semibold text-text-secondary md:flex">
            <Icon name="history" size={14} className="text-primary" />
            {finished} finished · {items.length} opened
          </div>
        )}
      </header>

      {error && (
        <div className="rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3 text-[13px] text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-[112px] w-full rounded-[22px]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="history"
          title="Nothing read yet"
          description="Open a gallery and Mitsu will remember the page you stopped on."
          action={
            <Link
              href="/library"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary-soft px-5 text-[13px] font-semibold text-primary"
            >
              Browse library
              <Icon name="arrow-right" size={14} />
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.label} aria-labelledby={`history-${group.label}`}>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2
                  id={`history-${group.label}`}
                  className="text-[15px] font-bold tracking-[-0.02em] text-text"
                >
                  {group.label}
                </h2>
                <span className="text-[11px] text-text-muted">{group.items.length}</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {group.items.map((gallery) => {
                  const percent = gallery.page_count
                    ? Math.round((gallery.current_page / gallery.page_count) * 100)
                    : 0;
                  return (
                    <article
                      key={gallery.id}
                      className="flex items-center gap-3.5 rounded-[22px] border border-border/80 bg-surface p-2.5 pr-3 transition hover:border-border-strong"
                    >
                      <Link
                        href={`/gallery/${gallery.id}`}
                        className="relative h-[92px] w-[69px] shrink-0 overflow-hidden rounded-[14px] bg-primary-soft"
                      >
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
                            <Icon name="image" size={20} />
                          </div>
                        )}
                      </Link>

                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/gallery/${gallery.id}`}
                          className="line-clamp-2 text-[14px] font-semibold leading-snug text-text"
                        >
                          {gallery.title}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-muted">
                          <span className="capitalize">{gallery.reading_status}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            Page {gallery.current_page + 1} of {gallery.page_count}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{formatTime(gallery.last_opened_at)}</span>
                        </div>
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      <Link
                        href={`/reader/${gallery.id}?page=${gallery.current_page + 1}`}
                        aria-label={`Resume ${gallery.title}`}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary transition hover:bg-primary-soft-hover"
                      >
                        <Icon name="play" size={14} />
                      </Link>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
