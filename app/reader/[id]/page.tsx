"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

export default function Reader() {
  const params = useParams();
  const id = params?.id as string;
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(24);
  const [title, setTitle] = useState("Loading…");

  useEffect(() => {
    if (!id) return;
    api.getGallery(id).then((g) => {
      setTitle(g.title);
      setTotal(g.page_count || 24);
      api.getProgress(id).then((p) => {
        setPage((p.current_page || 0) + 1);
      }).catch(() => {});
    }).catch(() => {});
  }, [id]);

  const saveProgress = (newPage: number) => {
    if (!id) return;
    const status = newPage >= total ? "completed" : "reading";
    api.setProgress(id, { current_page: newPage - 1, status }).catch(() => {});
  };

  const go = (delta: number) => {
    setPage((p) => {
      const np = Math.min(total, Math.max(1, p + delta));
      if (np !== p) saveProgress(np);
      return np;
    });
  };

  return (
    <div className="min-h-screen bg-reader-bg text-reader-text flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 bg-reader-surface border-b border-white/5">
        <div className="flex items-center gap-3">
          <a href={`/gallery/${id}`} className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-reader-text text-[14px]">
            ←
          </a>
          <div className="flex flex-col gap-0.5">
            <div className="text-[14px] font-semibold text-reader-text">{title}</div>
            <div className="text-[12px] text-reader-text/60">
              Page {page} of {total}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 bg-white/8 text-reader-text rounded-full text-[12px] font-semibold">
            Fit width
          </button>
          <button className="px-3 py-1.5 bg-white/8 text-reader-text rounded-full text-[12px] font-semibold">
            Single
          </button>
          <button className="px-3 py-1.5 bg-white/8 text-reader-text rounded-full text-[12px] font-semibold">
            Fullscreen
          </button>
          <button className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-reader-text text-[14px]">
            ⚙
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-6 relative">
        <div className="w-[640px] h-[800px] bg-white/5 border border-dashed border-white/10 rounded-md flex items-center justify-center text-reader-text/40 text-[14px] overflow-hidden">
          {id && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/v1/galleries/${id}/pages/${page - 1}/content`}
              alt=""
              className="w-full h-full object-contain"
            />
          )}
        </div>
        <button
          onClick={() => go(-1)}
          className="absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/8 flex items-center justify-center text-reader-text text-[18px]"
        >
          ‹
        </button>
        <button
          onClick={() => go(1)}
          className="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/8 flex items-center justify-center text-reader-text text-[18px]"
        >
          ›
        </button>
      </div>

      <div className="flex flex-col gap-2.5 px-6 py-3 bg-reader-surface border-t border-white/5">
        <div className="flex gap-2 justify-center overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className={`w-12 h-16 rounded-md shrink-0 border ${
                i === 2 ? "bg-primary/40 border-primary" : "bg-white/5 border-white/8"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[12px] text-reader-text/60">
            {page} / {total}
          </span>
          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${(page / total) * 100}%` }}
            />
          </div>
          <span className="text-[12px] text-reader-text/60">Reading mode: single</span>
        </div>
      </div>
    </div>
  );
}
