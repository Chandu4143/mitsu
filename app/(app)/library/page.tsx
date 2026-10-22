"use client";

import { useEffect, useState } from "react";
import { api, Gallery } from "@/lib/api";

const chips = ["All", "Favorites", "Reading", "Completed", "Unread"];

export default function Library() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [activeChip, setActiveChip] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params: Record<string, any> = { page_size: 60 };
    if (activeChip === 1) params.favorite = true;
    if (activeChip === 2) params.status = "reading";
    if (activeChip === 3) params.status = "completed";
    if (activeChip === 4) params.status = "unread";
    setLoading(true);
    api
      .listGalleries(params)
      .then((r) => setGalleries(r.items || []))
      .catch(() => setGalleries([]))
      .finally(() => setLoading(false));
  }, [activeChip]);

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[32px] font-extrabold tracking-[-0.02em] text-text">Library</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 w-[320px] px-4 py-2.5 bg-surface border border-border rounded-full text-[14px] text-text-muted">
            <span className="w-4 h-4 bg-border rounded shrink-0" />
            Search title, tags, artists…
          </div>
          <button className="px-4 py-2.5 bg-surface border border-border rounded-full text-[13px] font-semibold text-text-secondary">
            Filter
          </button>
          <button className="px-4 py-2.5 bg-surface border border-border rounded-full text-[13px] font-semibold text-text-secondary">
            Sort: Recent
          </button>
          <div className="flex gap-1 p-1 bg-surface border border-border rounded-full">
            <span className="px-2.5 py-1.5 bg-primary-soft text-primary rounded-full text-[12px] font-semibold">
              Grid
            </span>
            <span className="px-2.5 py-1.5 text-text-muted text-[12px] font-semibold">List</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {chips.map((c, i) => (
          <button
            key={c}
            onClick={() => setActiveChip(i)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-semibold cursor-pointer ${
              i === activeChip
                ? "bg-primary text-white"
                : "bg-surface text-text-secondary border border-border"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-text-muted text-[13px]">Loading…</div>
      ) : galleries.length === 0 ? (
        <div className="text-text-muted text-[13px]">No galleries. Import a CBZ to get started.</div>
      ) : (
        <div className="flex gap-4 flex-wrap">
          {galleries.map((c) => (
            <a
              key={c.id}
              href={`/gallery/${c.id}`}
              className="flex flex-col w-[200px] bg-surface border border-border rounded-lg overflow-hidden hover:border-primary"
            >
              <div className="relative w-[200px] h-[260px] bg-primary-soft overflow-hidden">
                {c.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.cover_url} alt="" className="w-full h-full object-cover" />
                )}
                <span className="absolute top-2.5 right-2.5 px-2 py-1 bg-white rounded-full text-[10px] font-semibold text-primary">
                  {c.reading_status}
                </span>
              </div>
              <div className="px-3 py-2.5 flex flex-col gap-1">
                <div className="text-[13px] font-semibold text-text">{c.title}</div>
                <div className="text-[11px] text-text-secondary">
                  {c.page_count} pages
                </div>
                <div className="flex gap-1.5 mt-1.5">
                  <span className="px-2 py-1 bg-primary text-white rounded-full text-[10px] font-semibold">
                    Open
                  </span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      api.setFavorite(c.id, !c.favorite).then(() => {
                        setGalleries((prev) =>
                          prev.map((g) => (g.id === c.id ? { ...g, favorite: !g.favorite } : g))
                        );
                      });
                    }}
                    className="px-2 py-1 bg-primary-soft text-primary rounded-full text-[10px] font-semibold"
                  >
                    {c.favorite ? "★" : "☆"}
                  </button>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
