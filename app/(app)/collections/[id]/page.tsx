"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

export default function CollectionDetail() {
  const params = useParams();
  const id = params?.id as string;
  const [col, setCol] = useState<any>(null);
  const [galleries, setGalleries] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    api.getCollection(id).then(async (c) => {
      setCol(c);
      const ids: string[] = c.gallery_ids || [];
      const gs = await Promise.all(ids.map((gid) => api.getGallery(gid).catch(() => null)));
      setGalleries(gs.filter(Boolean));
    }).catch(() => {});
  }, [id]);

  return (
    <>
      <h1 className="text-[32px] font-extrabold tracking-[-0.02em] text-text">
        {col?.name || "Collection"}
      </h1>
      {galleries.length === 0 ? (
        <div className="text-text-muted text-[13px]">No galleries in this collection.</div>
      ) : (
        <div className="flex gap-4 flex-wrap">
          {galleries.map((g) => (
            <a
              key={g.id}
              href={`/gallery/${g.id}`}
              className="flex flex-col w-[200px] bg-surface border border-border rounded-lg overflow-hidden hover:border-primary"
            >
              <div className="w-[200px] h-[260px] bg-primary-soft overflow-hidden">
                {g.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.cover_url} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="px-3 py-2.5">
                <div className="text-[13px] font-semibold text-text">{g.title}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
