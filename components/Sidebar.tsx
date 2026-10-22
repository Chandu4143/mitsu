"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { api, type Settings } from "@/lib/api";

const items: { href: string; label: string; icon: any }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/library", label: "Library", icon: "library" },
  { href: "/collections", label: "Collections", icon: "collections" },
  { href: "/discover", label: "Discover", icon: "discover" },
  { href: "/imports", label: "Imports", icon: "imports" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

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

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [statsText, setStatsText] = useState("Loading library…");

  useEffect(() => {
    api
      .getSettings()
      .then((settings: Settings) => {
        const total = settings.stats.galleries;
        const pages = settings.stats.pages;
        const bytesValue = settings.stats.bytes;
        setStatsText(`${total} titles · ${pages} pages · ${bytes(bytesValue)}`);
      })
      .catch(() => setStatsText("Library unavailable"));
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const submitSearch = () => {
    const value = query.trim();
    router.push(value ? `/library?q=${encodeURIComponent(value)}` : "/library");
  };

  const nav = (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[14px] font-medium transition-colors ${
              active
                ? "bg-primary-soft text-primary font-semibold"
                : "text-text-secondary hover:bg-primary-soft/40"
            }`}
          >
            <Icon name={item.icon} size={18} className="shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-2 text-text-secondary hover:bg-primary-soft hover:text-primary"
          aria-label="Open navigation"
        >
          <Icon name="list" size={20} />
        </button>
        <div className="text-[18px] font-black tracking-[-0.02em] text-primary">mitsu.</div>
        <div className="ml-auto text-[12px] text-text-muted">{statsText}</div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-text/30 backdrop-blur-sm" />
          <aside
            onClick={(event) => event.stopPropagation()}
            className="absolute left-0 top-0 h-full w-[280px] bg-surface px-4 py-6 shadow-card"
          >
            <div className="mb-6 px-2 text-[22px] font-black tracking-[-0.02em] text-primary">
              mitsu.
            </div>
            {nav}
            <div className="mt-6 rounded-md bg-primary-soft p-3">
              <div className="text-[12px] font-semibold text-primary">Library</div>
              <div className="mt-1 text-[12px] text-text-secondary">{statsText}</div>
            </div>
          </aside>
        </div>
      )}

      <aside className="hidden w-[240px] shrink-0 flex-col gap-6 border-r border-border bg-surface px-4 py-6 md:flex">
        <div className="px-2 text-[22px] font-black tracking-[-0.02em] text-primary">mitsu.</div>
        <div className="relative">
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitSearch();
            }}
            placeholder="Search library…"
            className="w-full rounded-full border border-border bg-bg py-2 pl-9 pr-3 text-[13px] text-text outline-none transition focus:border-primary placeholder:text-text-muted"
          />
        </div>
        {nav}
        <div className="mt-auto rounded-md bg-primary-soft p-3">
          <div className="text-[12px] font-semibold text-primary">Storage</div>
          <div className="mt-1 text-[12px] text-text-secondary">{statsText}</div>
        </div>
      </aside>
    </>
  );
}
