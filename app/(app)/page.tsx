"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Gallery, type Stats } from "@/lib/api";
import { Icon, type IconName } from "@/components/Icon";
import { Button, EmptyState, Skeleton } from "@/components/ui";

function ProgressBar({ value, wide }: { value: number; wide?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-full bg-white/15 ${wide ? "h-1.5" : "h-1"}`}>
      <div
        className="h-full rounded-full bg-[#f0b7cc]"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function GalleryCard({ gallery }: { gallery: Gallery }) {
  const percent = gallery.page_count
    ? Math.round((gallery.current_page / gallery.page_count) * 100)
    : 0;

  return (
    <Link
      href={`/gallery/${gallery.id}`}
      className="group w-[132px] shrink-0 snap-start md:w-auto"
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-[18px] bg-primary-soft shadow-cover ring-1 ring-black/[0.06] transition duration-300 group-hover:-translate-y-1">
        {gallery.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={gallery.cover_url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-primary">
            <Icon name="image" size={28} />
          </div>
        )}
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[9px] font-semibold capitalize text-white backdrop-blur-md">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              gallery.reading_status === "reading"
                ? "bg-[#f2b3ca]"
                : gallery.reading_status === "completed"
                ? "bg-[#b8dbc1]"
                : "bg-white/70"
            }`}
          />
          {gallery.reading_status === "reading" ? "Reading" : gallery.reading_status}
        </span>
        {gallery.reading_status === "reading" && percent > 0 && (
          <div className="absolute inset-x-2 bottom-2">
            <ProgressBar value={percent} />
          </div>
        )}
      </div>
      <div className="mt-2.5 line-clamp-2 min-h-[34px] text-[13px] font-semibold leading-[1.3] tracking-[-0.01em] text-text" title={gallery.title}>
        {gallery.title}
      </div>
      <div className="mt-0.5 text-[11px] text-text-muted">
        {gallery.page_count} pages{gallery.favorite ? " · Favorited" : ""}
      </div>
    </Link>
  );
}

function StatsStrip({ stats }: { stats: Stats }) {
  const items: { label: string; value: number; href: string; icon: IconName }[] = [
    { label: "Titles", value: stats.galleries, href: "/library", icon: "library" },
    { label: "Reading", value: stats.reading, href: "/library?status=reading", icon: "play" },
    {
      label: "Finished",
      value: stats.completed,
      href: "/library?status=completed",
      icon: "check",
    },
    { label: "Bookmarks", value: stats.bookmarks, href: "/history", icon: "bookmark" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="group flex items-center gap-3 rounded-[20px] border border-border/80 bg-surface px-3.5 py-3 transition hover:border-border-strong"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Icon name={item.icon} size={15} />
          </span>
          <span className="min-w-0">
            <span className="block text-[18px] font-bold leading-none tracking-[-0.03em] text-text tabular-nums">
              {item.value}
            </span>
            <span className="mt-1 block text-[11px] text-text-muted">{item.label}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function FirstRun() {
  const steps: { icon: IconName; title: string; body: string }[] = [
    {
      icon: "upload",
      title: "Bring your files",
      body: "Import CBZ, ZIP, images, or a whole folder. Nothing leaves this machine.",
    },
    {
      icon: "bookmark",
      title: "Read your way",
      body: "Single or double pages, right-to-left, zoom, bookmarks, and a place kept.",
    },
    {
      icon: "download",
      title: "Keep it safe",
      body: "Export a portable backup whenever you like. Restore it on another machine.",
    },
  ];

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-border/80 bg-surface px-5 py-6 shadow-card md:px-8 md:py-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-primary-soft blur-2xl"
      />
      <div className="relative">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-[11px] font-semibold text-primary">
          <Icon name="star" size={12} />
          First run
        </div>
        <h2 className="mt-3 max-w-[20ch] text-[26px] font-extrabold leading-[1.05] tracking-[-0.045em] text-text md:text-[34px]">
          A quiet home for your manga.
        </h2>
        <p className="mt-2 max-w-[48ch] text-[14px] leading-relaxed text-text-secondary">
          Point Mitsu at a folder or drop in a file. It indexes the pages, keeps your
          place, and stays entirely local.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/imports"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-[13px] font-bold text-white shadow-[0_10px_24px_-14px_rgba(179,95,134,0.95)] transition active:scale-[0.99]"
          >
            <Icon name="plus" size={15} />
            Import your first files
          </Link>
          <Link
            href="/settings"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-[13px] font-semibold text-text-secondary transition hover:border-border-strong hover:text-text"
          >
            Choose a library folder
          </Link>
        </div>
        <div className="mt-6 grid gap-2 md:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.title}
              className="rounded-[20px] border border-border/70 bg-bg/50 px-3.5 py-3"
            >
              <div className="flex items-center gap-2 text-[12px] font-semibold text-text">
                <Icon name={step.icon} size={14} className="text-primary" />
                {step.title}
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-text-secondary">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [history, setHistory] = useState<Gallery[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.listGalleries({ page_size: 24, sort: "date_added" }),
      api.getHistory(16).catch(() => [] as Gallery[]),
      api.getSettings().catch(() => null),
    ])
      .then(([response, historyItems, settings]) => {
        setGalleries(response.items || []);
        setHistory(historyItems);
        setStats(settings?.stats || null);
      })
      .catch(() => setGalleries([]))
      .finally(() => setLoading(false));
  }, []);

  const continueReading = (
    history.length > 0
      ? history.filter((gallery) => gallery.reading_status === "reading")
      : galleries.filter((gallery) => gallery.reading_status === "reading")
  ).slice(0, 4);
  const favorites = galleries.filter((gallery) => gallery.favorite).slice(0, 6);
  const recent = galleries.slice(0, 6);
  const featured = continueReading[0];
  const upNext = continueReading.slice(1);
  const featuredPercent = featured?.page_count
    ? Math.round((featured.current_page / featured.page_count) * 100)
    : 0;

  return (
    <>
      <header className="flex items-end justify-between gap-4 pt-1 md:pt-0">
        <div>
          <h1 className="text-[34px] font-extrabold leading-[1.02] tracking-[-0.045em] text-text md:text-[44px]">
            {!loading && galleries.length === 0 ? "Welcome to Mitsu." : "Welcome back."}
          </h1>
          <p className="mt-2 max-w-[32ch] text-[14px] leading-relaxed text-text-secondary md:text-[15px]">
            {!loading && galleries.length === 0
              ? "Your shelves are ready. Bring in a few files and make this corner yours."
              : "Pick up where you left off, or find something new on your shelves."}
          </p>
        </div>
        <Link
          href="/imports"
          className="hidden min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-[13px] font-semibold text-text-secondary transition hover:border-border-strong hover:text-text md:inline-flex"
        >
          <Icon name="plus" size={16} />
          Import
        </Link>
      </header>

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full rounded-[24px]" />
          <Skeleton className="h-[210px] w-full rounded-[30px]" />
          <Skeleton className="h-40 w-full rounded-[26px]" />
        </div>
      ) : galleries.length === 0 ? (
        <FirstRun />
      ) : (
        <>
          {stats && <StatsStrip stats={stats} />}

          {featured ? (
        <section aria-labelledby="continue-heading">
          <h2 id="continue-heading" className="sr-only">
            Continue reading
          </h2>
          <Link
            href={`/reader/${featured.id}`}
            className="group relative block overflow-hidden rounded-[30px] bg-[#352a32] p-4 text-white shadow-float md:p-6"
          >
            {featured.cover_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={featured.cover_url}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-2xl"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-[#2b2229]/95 via-[#352a32]/85 to-[#352a32]/45" />
            <div className="relative flex items-end gap-4 md:items-center md:gap-6">
              <div className="h-[128px] w-[92px] shrink-0 overflow-hidden rounded-[16px] bg-white/10 ring-1 ring-white/15 shadow-cover md:h-[176px] md:w-[126px]">
                {featured.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={featured.cover_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-white/60">
                    <Icon name="image" size={28} />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white/60">
                  <Icon name="play" size={11} />
                  Continue reading
                </div>
                <div className="mt-1 line-clamp-2 text-[19px] font-bold leading-tight tracking-[-0.025em] md:text-[26px]" title={featured.title}>
                  {featured.title}
                </div>
                <div className="mt-1.5 text-[12px] text-white/55">
                  Page {featured.current_page + 1} of {featured.page_count}
                  {featured.artists?.length ? ` · ${featured.artists.join(", ")}` : ""}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="w-full max-w-[260px]">
                    <ProgressBar value={featuredPercent} wide />
                  </div>
                  <span className="text-[11px] font-semibold tabular-nums text-white/65">
                    {featuredPercent}%
                  </span>
                </div>
                <span className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-[13px] font-bold text-[#352a32] transition group-hover:bg-[#f8e6ee]">
                  Resume
                  <Icon name="arrow-right" size={14} />
                </span>
              </div>
            </div>
          </Link>
        </section>
      ) : (
        <EmptyState
          icon="play"
          title="Nothing in progress"
          description="Open a gallery and start reading. Mitsu will keep your place automatically."
          action={
            <Link href="/library">
              <Button variant="soft">Browse library</Button>
            </Link>
          }
        />
      )}

      {upNext.length > 0 && (
        <section aria-labelledby="up-next-heading">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 id="up-next-heading" className="text-[20px] font-bold tracking-[-0.03em] md:text-[22px]">
              Up next
            </h2>
            <Link
              href="/library?status=reading"
              className="text-[12px] font-semibold text-primary transition hover:text-primary-hover"
            >
              See all
            </Link>
          </div>
          <div className="flex flex-col gap-2.5">
            {upNext.map((gallery) => {
              const percent = gallery.page_count
                ? Math.round((gallery.current_page / gallery.page_count) * 100)
                : 0;
              return (
                <Link
                  key={gallery.id}
                  href={`/reader/${gallery.id}`}
                  className="flex items-center gap-3.5 rounded-[20px] border border-border/80 bg-surface p-2.5 pr-4 transition hover:border-border-strong"
                >
                  <div className="h-[70px] w-[52px] shrink-0 overflow-hidden rounded-xl bg-primary-soft">
                    {gallery.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={gallery.cover_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-primary">
                        <Icon name="image" size={18} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-[14px] font-semibold text-text" title={gallery.title}>
                      {gallery.title}
                    </div>
                    <div className="mt-1 text-[11px] text-text-muted">
                      Page {gallery.current_page + 1} of {gallery.page_count}
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <Icon name="play" size={13} />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section aria-labelledby="recent-heading">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 id="recent-heading" className="text-[20px] font-bold tracking-[-0.03em] md:text-[22px]">
            Recently added
          </h2>
          <Link
            href="/library"
            className="text-[12px] font-semibold text-primary transition hover:text-primary-hover"
          >
            Explore library
          </Link>
        </div>
        {loading ? (
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[240px] w-[132px] shrink-0 md:h-[300px] md:w-full" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            icon="upload"
            title="Your shelves are empty"
            description="Import a CBZ, ZIP, image, or folder to start building your library."
            action={
              <Link href="/imports">
                <Button variant="soft">Import files</Button>
              </Link>
            }
          />
        ) : (
          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 lg:grid-cols-6">
            {recent.map((gallery) => (
              <GalleryCard key={gallery.id} gallery={gallery} />
            ))}
          </div>
        )}
      </section>

      {(favorites.length > 0 || galleries.length > 0) && (
        <section aria-labelledby="favorites-heading">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 id="favorites-heading" className="text-[20px] font-bold tracking-[-0.03em] md:text-[22px]">
              Favorites
            </h2>
            <Link
              href="/library?favorite=true"
              className="text-[12px] font-semibold text-primary transition hover:text-primary-hover"
            >
              View all
            </Link>
          </div>
          {favorites.length === 0 ? (
            <div className="rounded-[24px] border border-border/80 bg-surface px-5 py-4 text-[13px] leading-relaxed text-text-secondary">
              Tap the heart on a gallery to keep it close.
            </div>
          ) : (
            <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 lg:grid-cols-6">
              {favorites.map((gallery) => (
                <GalleryCard key={gallery.id} gallery={gallery} />
              ))}
            </div>
          )}
        </section>
      )}
        </>
      )}
    </>
  );
}
