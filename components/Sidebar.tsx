"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "./Icon";
import { api, type Settings } from "@/lib/api";

type NavItem = { href: string; label: string; icon: IconName };

const primaryItems: NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/library", label: "Library", icon: "library" },
  { href: "/discover", label: "Discover", icon: "discover" },
  { href: "/collections", label: "Collections", icon: "collections" },
];

const utilityItems: NavItem[] = [
  { href: "/imports", label: "Imports", icon: "imports" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

const allItems = [...primaryItems, ...utilityItems];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function bytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function Wordmark({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onClick}
      className="inline-flex items-baseline text-[23px] font-extrabold leading-none tracking-[-0.055em] text-text"
      aria-label="Mitsu home"
    >
      mitsu<span className="text-primary">.</span>
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [stats, setStats] = useState<Settings["stats"] | null>(null);
  const [statsText, setStatsText] = useState("Loading library…");

  useEffect(() => {
    api
      .getSettings()
      .then((settings: Settings) => {
        setStats(settings.stats);
        setStatsText(
          `${settings.stats.galleries} titles · ${settings.stats.pages.toLocaleString()} pages`
        );
      })
      .catch(() => setStatsText("Library unavailable"));
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const submitSearch = () => {
    const value = query.trim();
    router.push(value ? `/library?q=${encodeURIComponent(value)}` : "/library");
  };

  const moreActive = utilityItems.some((item) => isActive(pathname, item.href));

  return (
    <>
      {/* Phone chrome */}
      <header className="fixed inset-x-0 top-0 z-30 border-b border-border/70 bg-bg/82 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-2xl md:hidden">
        <div className="flex h-11 items-center gap-2 px-4">
          <Wordmark />
          <div className="ml-auto flex items-center gap-1.5">
            <Link
              href="/library"
              className="flex h-10 w-10 items-center justify-center rounded-full text-text-secondary transition active:scale-95 active:bg-primary-soft"
              aria-label="Search library"
            >
              <Icon name="search" size={20} />
            </Link>
            <Link
              href="/imports"
              className="flex h-10 w-10 items-center justify-center rounded-full text-text-secondary transition active:scale-95 active:bg-primary-soft"
              aria-label="Import files"
            >
              <Icon name="imports" size={20} />
            </Link>
          </div>
        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/75 bg-surface/88 px-1.5 pt-1 backdrop-blur-2xl safe-bottom md:hidden"
        aria-label="Primary"
      >
        <div className="mx-auto flex max-w-md items-stretch">
          {primaryItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition ${
                  active ? "text-primary" : "text-text-muted"
                }`}
              >
                {active && (
                  <span className="absolute top-0 h-1 w-4 rounded-b-full bg-primary" aria-hidden="true" />
                )}
                <Icon name={item.icon} size={21} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`relative flex h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition ${
              moreActive ? "text-primary" : "text-text-muted"
            }`}
            aria-label="More"
            aria-expanded={moreOpen}
          >
            {moreActive && (
              <span className="absolute top-0 h-1 w-4 rounded-b-full bg-primary" aria-hidden="true" />
            )}
            <Icon name="more" size={21} />
            <span>More</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-text/25 backdrop-blur-[3px]" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More"
            onClick={(event) => event.stopPropagation()}
            className="sheet-in absolute inset-x-0 bottom-0 rounded-t-[30px] border-t border-white/60 bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-float"
          >
            <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-border-strong" />
            <div className="mb-4 flex items-center justify-between px-1">
              <div>
                <div className="text-[20px] font-bold tracking-[-0.03em]">Your corner</div>
                <div className="mt-0.5 text-[13px] text-text-secondary">{statsText}</div>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-soft text-text-secondary"
                aria-label="Close menu"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-bg/60">
              {utilityItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex min-h-14 items-center gap-3 border-b border-border/70 px-4 text-[15px] font-semibold last:border-b-0"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <Icon name={item.icon} size={17} />
                  </span>
                  {item.label}
                  <Icon name="chevron-right" size={17} className="ml-auto text-text-muted" />
                </Link>
              ))}
            </div>

            {stats && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { label: "Titles", value: stats.galleries },
                  { label: "Favorites", value: stats.favorites },
                  { label: "On disk", value: bytes(stats.bytes) },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl bg-surface-soft px-3 py-3">
                    <div className="text-[15px] font-bold tracking-[-0.02em]">{stat.value}</div>
                    <div className="mt-0.5 text-[11px] text-text-secondary">{stat.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-border/80 bg-surface/72 px-4 py-6 backdrop-blur-xl md:flex">
        <div className="px-2">
          <Wordmark />
        </div>

        <div className="relative mt-6">
          <Icon
            name="search"
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitSearch();
            }}
            placeholder="Search your shelves"
            aria-label="Search library"
            className="h-11 w-full rounded-full border border-border bg-bg/80 py-2 pl-10 pr-3 text-[13px] text-text outline-none transition placeholder:text-text-muted focus:border-primary"
          />
        </div>

        <nav className="mt-5 flex flex-col gap-1" aria-label="Primary">
          {allItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition ${
                  active
                    ? "bg-primary-soft font-semibold text-primary"
                    : "text-text-secondary hover:bg-surface-soft hover:text-text"
                }`}
              >
                <Icon name={item.icon} size={18} className="shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-border/80 bg-bg/70 p-4">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-text">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
            Local library
          </div>
          <div className="mt-1.5 text-[11px] leading-relaxed text-text-secondary">{statsText}</div>
        </div>
      </aside>
    </>
  );
}
