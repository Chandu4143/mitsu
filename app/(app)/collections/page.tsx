"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Collections() {
  const [collections, setCollections] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = () => api.listCollections().then(setCollections).catch(() => {});

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    await api.createCollection(name.trim());
    setName("");
    refresh();
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-[32px] font-extrabold tracking-[-0.02em] text-text">Collections</h1>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New collection name"
            className="px-4 py-2.5 bg-surface border border-border rounded-full text-[13px] text-text"
          />
          <button onClick={create} className="px-[18px] py-2.5 bg-primary text-white rounded-full text-[14px] font-semibold">
            + New
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-text-muted text-[13px]">Loading…</div>
      ) : collections.length === 0 ? (
        <div className="text-text-muted text-[13px]">No collections yet.</div>
      ) : (
        <div className="flex gap-5 flex-wrap">
          {collections.map((c) => (
            <a
              key={c.id}
              href={`/collections/${c.id}`}
              className="flex flex-col w-[320px] bg-surface border border-border rounded-lg overflow-hidden hover:border-primary"
            >
              <div className="flex gap-1 p-3 h-[140px] bg-primary-soft">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex-1 bg-surface rounded-sm border border-border" />
                ))}
              </div>
              <div className="px-4 py-3.5 flex flex-col gap-1">
                <div className="text-[15px] font-bold text-text">{c.name}</div>
                <div className="text-[12px] text-text-secondary">
                  {c.item_count} galleries
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
