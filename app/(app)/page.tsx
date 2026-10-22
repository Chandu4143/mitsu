"use client";

import { useEffect, useState } from "react";
import { api, Gallery } from "@/lib/api";

export default function Home() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listGalleries({ page_size: 20 })
      .then((r) => setGalleries(r.items || []))
      .catch(() => setGalleries([]))
      .finally(() => setLoading(false));
  }, []);

  const continueReading = galleries.filter((g) => g.reading_status === "reading").slice(0, 2);
  const recent = galleries.slice(0, 6);

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-text-muted">Good evening</span>
          <h1 className="text-[32px] font-extrabold tracking-[-0.02em] text-text">Welcome back.</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 w-[280px] px-4 py-2.5 bg-surface border border-border rounded-full text-[14px] text-text-muted">
            <span className="w-4 h-4 bg-border rounded shrink-0" />
            Search your library…
          </div>
          <div className="w-10 h-10 rounded-full bg-primary-soft flex items-center justify-center text-primary font-bold text-[14px]">
            C
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-bold text-text">Continue reading</h2>
          <span className="text-[13px] font-semibold text-primary cursor-pointer">View all</span>
        </div>
        {loading ? (
          <div className="text-text-muted text-[13px]">Loading…</div>
        ) : continueReading.length === 0 ? (
          <div className="text-text-muted text-[13px]">No galleries in progress yet.</div>
        ) : (
          <div className="flex gap-5">
            {continueReading.map((g) => {
              const pct = g.page_count ? Math.round((g.current_page / g.page_count) * 100) : 0;
              return (
                <a
                  key={g.id}
                  href={`/reader/${g.id}`}
                  className="flex gap-4 w-[520px] bg-surface border border-border rounded-lg p-4 items-center hover:border-primary"
                >
                  <div className="w-24 h-32 bg-primary-soft rounded-md shrink-0 overflow-hidden">
                    {g.cover_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.cover_url} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <div className="text-[15px] font-bold text-text">{g.title}</div>
                    <div className="text-[13px] text-text-secondary">{g.alternate_title || ""}</div>
                    <div className="text-[12px] text-text-muted">
                      Page {g.current_page} of {g.page_count}
                    </div>
                    <div className="mt-1.5 h-1.5 bg-border rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-2 flex gap-2">
                      <span className="px-3.5 py-1.5 bg-primary text-white rounded-full text-[12px] font-semibold">
                        Resume
                      </span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-bold text-text">Recently added</h2>
          <a href="/library" className="text-[13px] font-semibold text-primary cursor-pointer">
            Explore library
          </a>
        </div>
        {loading ? (
          <div className="text-text-muted text-[13px]">Loading…</div>
        ) : (
          <div className="flex gap-4 flex-wrap">
            {recent.map((g) => (
              <a
                key={g.id}
                href={`/gallery/${g.id}`}
                className="flex flex-col w-[180px] bg-surface border border-border rounded-lg overflow-hidden hover:border-primary"
              >
                <div className="w-[180px] h-[240px] bg-primary-soft overflow-hidden">
                  {g.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.cover_url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="px-3 py-2.5 flex flex-col gap-1">
                  <div className="text-[13px] font-semibold text-text">{g.title}</div>
                  <div className="text-[11px] text-text-secondary">
                    {g.page_count} pages · {g.reading_status}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
