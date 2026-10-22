"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
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

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-[240px] shrink-0 bg-surface border-r border-border flex flex-col gap-6 px-4 py-6">
      <div className="px-2 text-[22px] font-black tracking-[-0.02em] text-primary">mitsu.</div>
      <nav className="flex flex-col gap-1">
        {items.map((it) => {
          const active = isActive(pathname, it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[14px] font-medium transition-colors ${
                active
                  ? "bg-primary-soft text-primary font-semibold"
                  : "text-text-secondary hover:bg-primary-soft/40"
              }`}
            >
              <span
                className={`w-[18px] h-[18px] rounded shrink-0 ${
                  active ? "bg-primary" : "bg-border"
                }`}
              />
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto p-3 bg-primary-soft rounded-md">
        <div className="text-[12px] font-semibold text-primary">Storage</div>
        <div className="text-[12px] text-text-secondary mt-1">1.2 GB of 10 GB used</div>
        <div className="mt-2 h-1.5 bg-border rounded-full overflow-hidden">
          <div className="h-full w-[12%] bg-primary rounded-full" />
        </div>
      </div>
    </aside>
  );
}
