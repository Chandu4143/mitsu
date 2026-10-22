"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Gallery } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { Button, EmptyState, Skeleton } from "@/components/ui";

function GalleryCard({ gallery }: { gallery: Gallery }) {
  return (
    <Link
      href={`/gallery/${gallery.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-surface transition hover:border-primary"
    >
      <div className="relative aspect-[3/4] bg-primary-soft overflow-hidden">
        {gallery.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={gallery.cover_url}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-primary">
            <Icon name="image" size={28} />
          </div>
        )}
        <span className="absolute right-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-primary">
          {gallery.reading_status}
        </span>
      </div>
      <div className="flex flex-col gap-1 px-3 py-2.5">
        <div className="line-clamp-2 min-h-[34px] text-[13px] font-semibold text-text" title={gallery.title}>
          {gallery.title}
        </div>
        <div className="text-[11px] text-text-secondary">
          {gallery.page_count} pages{gallery.favorite ? " · ★" : ""}
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listGalleries({ page_size: 24, sort: "date_added" })
      .then((response: any) => setGalleries(response.items || []))
      .catch(() => setGalleries([]))
      .finally(() => setLoading(false));
  }, []);

  const continueReading = galleries
    .filter((gallery) => gallery.reading_status === "reading")
    .slice(0, 3);
  const favorites = galleries.filter((gallery) => gallery.favorite).slice(0, 4);
  const recent = galleries.slice(0, 6);
  const total = galleries.length;

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl border border-border bg-surface px-8 py-8">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-primary-soft/60 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-2xl flex-col gap-3">
            <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-text-muted">
              A little space for your collection
            </span>
            <h1 className="text-[40px] font-extrabold leading-none tracking-[-0.03em] text-text">
              Welcome back.
            </h1>
            <p className="text-[16px] text-text-secondary">
              Pick up where you left off, or discover something new in your library.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/library">
                <Button>
                  <Icon name="library" size={16} /> Open library
                </Button>
              </Link>
              <Link href="/imports">
                <Button variant="ghost">
                  <Icon name="upload" size={16} /> Import files
                </Button>
              </Link>
            </div>
          </div>
          <div className="hidden gap-3 md:flex">
            {recent.slice(0, 3).map((gallery, index) => (
              <div
                key={gallery.id}
                className="h-44 w-32 overflow-hidden rounded-xl border border-border bg-primary-soft shadow-card"
                style={{ transform: `rotate(${index === 1 ? 0 : index === 0 ? -6 : 6}deg)` }}
              >
                {gallery.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={gallery.cover_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-primary">
                    <Icon name="image" size={24} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-bold text-text">Continue reading</h2>
          <Link href="/library?status=reading" className="text-[13px] font-semibold text-primary">
            View all
          </Link>
        </div>
        {loading ? (
          <div className="flex gap-5">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-40 w-[520px]" />
            ))}
          </div>
        ) : continueReading.length === 0 ? (
          <EmptyState
            icon="play"
            title="Nothing in progress"
            description="Open a gallery and start reading to resume it here."
            action={
              <Link href="/library">
                <Button variant="soft">Browse library</Button>
              </Link>
            }
          />
        ) : (
          <div className="flex gap-5 flex-wrap">
            {continueReading.map((gallery) => {
              const percent = gallery.page_count
                ? Math.round((gallery.current_page / gallery.page_count) * 100)
                : 0;
              return (
                <Link
                  key={gallery.id}
                  href={`/reader/${gallery.id}`}
                  className="flex w-[520px] max-w-full gap-4 rounded-lg border border-border bg-surface p-4 transition hover:border-primary"
                >
                  <div className="h-32 w-24 shrink-0 overflow-hidden rounded-md bg-primary-soft">
                    {gallery.cover_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={gallery.cover_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <div className="line-clamp-2 text-[15px] font-bold text-text" title={gallery.title}>
                      {gallery.title}
                    </div>
                    <div className="text-[13px] text-text-secondary">
                      Page {gallery.current_page + 1} of {gallery.page_count}
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                    </div>
                    <span className="mt-2 self-start rounded-full bg-primary px-3.5 py-1.5 text-[12px] font-semibold text-white">
                      Resume
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-bold text-text">Recently added</h2>
          <Link href="/library" className="text-[13px] font-semibold text-primary">
            Explore library
          </Link>
        </div>
        {loading ? (
          <div className="flex gap-4 flex-wrap">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-80 w-[180px]" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            icon="upload"
            title="No galleries yet"
            description="Import a CBZ, ZIP, or folder to build your library."
            action={
              <Link href="/imports">
                <Button variant="soft">Import files</Button>
              </Link>
            }
          />
        ) : (
          <div className="flex gap-4 flex-wrap">
            {recent.map((gallery) => (
              <GalleryCard key={gallery.id} gallery={gallery} />
            ))}
          </div>
        )}
      </section>

      {(favorites.length > 0 || total > 0) && (
        <section className="flex flex-col gap-4">
          <h2 className="text-[20px] font-bold text-text">Your favorites</h2>
          {favorites.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface px-5 py-4 text-[13px] text-text-secondary">
              Star a gallery from its card or detail page to save it here.
            </div>
          ) : (
            <div className="flex gap-4 flex-wrap">
              {favorites.map((gallery) => (
                <GalleryCard key={gallery.id} gallery={gallery} />
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
