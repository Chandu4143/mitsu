"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Discover() {
  const [q, setQ] = useState("");
  const [local, setLocal] = useState<any[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      api.listGalleries({ q: q || undefined, page_size: 6 }).then((r) => setLocal(r.items || [])).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const remote = ["Remote Title A", "Remote Title B", "Remote Title C", "Remote Title D"];

  return (
    <>
      <h1 className="text-[32px] font-extrabold tracking-[-0.02em] text-text">Discover</h1>

      <div className="flex gap-3">
        <div className="flex items-center gap-2 w-[420px] px-4 py-2.5 bg-surface border border-border rounded-full text-[14px] text-text">
          <span className="w-4 h-4 bg-border rounded shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search remote & local…"
            className="flex-1 bg-transparent outline-none text-text placeholder:text-text-muted"
          />
        </div>
        <button className="px-4 py-2.5 bg-primary text-white rounded-full text-[13px] font-semibold">
          Search
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="text-[12px] font-semibold text-text-muted tracking-[0.04em] uppercase">
          Local matches
        </div>
        <div className="flex gap-3 flex-wrap">
          {local.map((g) => (
            <a
              key={g.id}
              href={`/gallery/${g.id}`}
              className="flex items-center gap-2.5 px-3 py-2.5 bg-surface border border-border rounded-md w-[260px] hover:border-primary"
            >
              <div className="w-10 h-[52px] bg-primary-soft rounded-md shrink-0 overflow-hidden">
                {g.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.cover_url} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="text-[13px] font-semibold text-text">{g.title}</div>
            </a>
          ))}
          {local.length === 0 && <div className="text-text-muted text-[13px]">No local matches.</div>}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-[12px] font-semibold text-text-muted tracking-[0.04em] uppercase">
            Remote results · Source: Metadata provider
          </div>
          <div className="text-[12px] text-text-muted">Not downloaded</div>
        </div>
        <div className="flex gap-3 flex-wrap">
          {remote.map((t) => (
            <div
              key={t}
              className="flex flex-col w-[200px] bg-surface border border-border rounded-lg overflow-hidden opacity-90"
            >
              <div className="w-[200px] h-[260px] bg-border" />
              <div className="px-3 py-2.5 flex flex-col gap-1">
                <div className="text-[13px] font-semibold text-text">{t}</div>
                <div className="text-[11px] text-text-secondary">12 pages · remote</div>
                <span className="mt-1 px-2 py-1 bg-primary-soft text-primary rounded-full text-[10px] font-semibold self-start cursor-pointer">
                  Import
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
