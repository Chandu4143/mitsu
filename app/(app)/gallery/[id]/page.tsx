"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

export default function GalleryDetail() {
  const params = useParams();
  const id = params?.id as string;
  const [gallery, setGallery] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api
      .getGallery(id)
      .then(setGallery)
      .catch(() => setGallery(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-text-muted text-[13px]">Loading…</div>;
  if (!gallery) return <div className="text-text-muted text-[13px]">Gallery not found.</div>;

  const tags = gallery.tags || [];

  return (
    <>
      <div className="text-[13px] font-medium text-text-muted">Library / Gallery</div>

      <div className="flex gap-8 items-start">
        <div className="w-[260px] h-[360px] bg-primary-soft rounded-lg shrink-0 border border-border overflow-hidden">
          {gallery.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gallery.cover_url} alt="" className="w-full h-full object-cover" />
          )}
        </div>

        <div className="flex flex-col gap-4 flex-1">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[32px] font-extrabold tracking-[-0.02em] text-text">
              {gallery.title}
            </h1>
            <div className="text-[15px] text-text-secondary">
              {gallery.artists?.join(", ") || ""}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <span className="px-2.5 py-1 bg-primary-soft text-primary rounded-full text-[12px] font-semibold">
              {gallery.reading_status}
            </span>
            <span className="px-2.5 py-1 bg-surface text-text-secondary border border-border rounded-full text-[12px] font-semibold">
              {gallery.page_count} pages
            </span>
            <span className="px-2.5 py-1 bg-surface text-text-secondary border border-border rounded-full text-[12px] font-semibold">
              {gallery.language}
            </span>
            <button
              onClick={() => {
                api.setFavorite(gallery.id, !gallery.favorite).then(() => {
                  setGallery({ ...gallery, favorite: !gallery.favorite });
                });
              }}
              className="px-2.5 py-1 bg-surface text-text-secondary border border-border rounded-full text-[12px] font-semibold"
            >
              {gallery.favorite ? "★ Favorite" : "☆ Favorite"}
            </button>
          </div>

          <div className="flex gap-2.5 mt-1">
            <a
              href={`/reader/${gallery.id}`}
              className="px-5 py-2.5 bg-primary text-white rounded-full text-[14px] font-semibold"
            >
              Read now
            </a>
            <button className="px-5 py-2.5 bg-primary-soft text-primary rounded-full text-[14px] font-semibold">
              Add to collection
            </button>
            <button className="px-5 py-2.5 bg-surface text-text-secondary border border-border rounded-full text-[14px] font-semibold">
              Edit metadata
            </button>
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <div className="text-[12px] font-semibold text-text-muted tracking-[0.04em] uppercase">
              Tags
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {tags.map((t: string) => (
                <span
                  key={t}
                  className="px-2.5 py-1 bg-surface text-text-secondary border border-border rounded-full text-[12px]"
                >
                  {t}
                </span>
              ))}
              <span className="px-2.5 py-1 bg-primary-soft text-primary rounded-full text-[12px] font-semibold cursor-pointer">
                + Add tag
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[12px] font-semibold text-text-muted tracking-[0.04em] uppercase">
              Progress
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${gallery.page_count ? (gallery.current_page / gallery.page_count) * 100 : 0}%` }}
                />
              </div>
              <div className="text-[13px] text-text-secondary">
                {gallery.current_page} / {gallery.page_count} pages
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-[18px] font-bold text-text">Pages</h2>
        <div className="flex gap-3 flex-wrap">
          {(gallery.pages || []).map((p: any) => (
            <div
              key={p.page_index}
              className="w-[120px] h-[160px] bg-primary-soft rounded-md border border-border overflow-hidden flex items-center justify-center text-[12px] text-text-muted"
            >
              {p.content_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.content_url} alt="" className="w-full h-full object-cover" />
              ) : (
                p.page_index + 1
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
