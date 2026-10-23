"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type Collection, type Gallery } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { Button, EmptyState, Modal, Skeleton } from "@/components/ui";

export default function CollectionDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [collection, setCollection] = useState<Collection | null>(null);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [allGalleries, setAllGalleries] = useState<Gallery[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const detail = await api.getCollection(id);
      setCollection(detail);
      const ids: string[] = detail.gallery_ids || [];
      const items = await Promise.all(ids.map((gid) => api.getGallery(gid).catch(() => null)));
      setGalleries(items.filter(Boolean) as Gallery[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const remove = async (galleryId: string) => {
    await api.removeCollectionItem(id, galleryId);
    await load();
  };

  const move = async (index: number, delta: number) => {
    const next = [...galleries];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setGalleries(next);
    await api.reorderCollectionItems(id, next.map((gallery) => gallery.id));
  };

  const openPicker = async () => {
    const response = await api.listGalleries({ page_size: 100 });
    setAllGalleries(response.items || []);
    setSelected([]);
    setPickerOpen(true);
  };

  const addSelected = async () => {
    if (selected.length === 0) return;
    await api.addCollectionItems(id, selected);
    setPickerOpen(false);
    await load();
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-36 rounded-full" />
        <Skeleton className="h-10 w-2/3" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[112px] w-full rounded-[20px]" />
          ))}
        </div>
      </div>
    );
  }

  if (!collection) {
    return <EmptyState icon="collections" title="Collection not found" />;
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Link
          href="/collections"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full text-[13px] font-semibold text-text-secondary transition hover:text-text"
        >
          <Icon name="arrow-left" size={16} />
          Collections
        </Link>
      </div>

      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-[32px] font-extrabold leading-[1.05] tracking-[-0.045em] text-text md:text-[40px]">
            {collection.name}
          </h1>
          {collection.description && (
            <p className="mt-2 max-w-[52ch] text-[13px] leading-relaxed text-text-secondary">
              {collection.description}
            </p>
          )}
          <p className="mt-2 text-[12px] text-text-muted">
            {galleries.length} {galleries.length === 1 ? "gallery" : "galleries"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={openPicker} className="flex-1 md:flex-none">
            <Icon name="plus" size={15} />
            Add galleries
          </Button>
          <button
            type="button"
            onClick={async () => {
              const next = prompt("Collection name", collection.name);
              if (!next || next.trim() === collection.name) return;
              await api.patchCollection(collection.id, { name: next.trim() });
              await load();
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition hover:text-text"
            aria-label="Rename collection"
          >
            <Icon name="edit" size={17} />
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!confirm("Delete this collection? Galleries remain in your library.")) return;
              await api.deleteCollection(collection.id);
              router.push("/collections");
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition hover:border-danger/30 hover:text-danger"
            aria-label="Delete collection"
          >
            <Icon name="trash" size={17} />
          </button>
        </div>
      </header>

      {galleries.length === 0 ? (
        <EmptyState
          icon="collections"
          title="This collection is empty"
          description="Add galleries from your library to start shaping this list."
          action={
            <Button variant="soft" onClick={openPicker}>
              Add galleries
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {galleries.map((gallery, index) => (
            <div
              key={gallery.id}
              className="flex items-center gap-3 rounded-[20px] border border-border/80 bg-surface p-2.5 pr-2 transition hover:border-border-strong"
            >
              <span className="hidden w-5 shrink-0 text-center text-[11px] font-semibold tabular-nums text-text-muted sm:block">
                {index + 1}
              </span>
              <Link href={`/gallery/${gallery.id}`} className="shrink-0">
                <div className="h-[88px] w-[66px] overflow-hidden rounded-[14px] bg-primary-soft">
                  {gallery.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={gallery.cover_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-primary">
                      <Icon name="image" size={18} />
                    </div>
                  )}
                </div>
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/gallery/${gallery.id}`}
                  className="line-clamp-2 text-[14px] font-semibold leading-snug text-text"
                >
                  {gallery.title}
                </Link>
                <div className="mt-1 text-[11px] text-text-muted">
                  {gallery.page_count} pages · {gallery.reading_status}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="flex h-9 w-8 items-center justify-center rounded-full text-text-muted transition hover:bg-surface-soft hover:text-text disabled:opacity-25"
                  aria-label="Move up"
                >
                  <Icon name="chevron-up" size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === galleries.length - 1}
                  className="flex h-9 w-8 items-center justify-center rounded-full text-text-muted transition hover:bg-surface-soft hover:text-text disabled:opacity-25"
                  aria-label="Move down"
                >
                  <Icon name="chevron-down" size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => remove(gallery.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition hover:bg-danger/10 hover:text-danger"
                  aria-label="Remove from collection"
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pickerOpen && (
        <Modal title="Add galleries" onClose={() => setPickerOpen(false)} wide>
          <div className="flex max-h-[58dvh] flex-col gap-2 overflow-auto">
            {allGalleries.map((gallery) => {
              const checked = selected.includes(gallery.id);
              return (
                <label
                  key={gallery.id}
                  className={`flex min-h-16 items-center gap-3 rounded-2xl border px-3 py-2 transition ${
                    checked ? "border-primary/30 bg-primary-soft/50" : "border-border bg-surface"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      if (event.target.checked) setSelected([...selected, gallery.id]);
                      else setSelected(selected.filter((gid) => gid !== gallery.id));
                    }}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                  <div className="h-[56px] w-[42px] shrink-0 overflow-hidden rounded-lg bg-primary-soft">
                    {gallery.cover_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={gallery.cover_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-[13px] font-semibold text-text">
                      {gallery.title}
                    </div>
                    <div className="text-[11px] text-text-muted">{gallery.page_count} pages</div>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPickerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addSelected} disabled={selected.length === 0}>
              Add {selected.length > 0 ? `(${selected.length})` : ""}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
