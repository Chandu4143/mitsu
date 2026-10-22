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
    load();
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
        <Skeleton className="h-10 w-1/3" />
        <div className="flex flex-wrap gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[370px] w-[220px]" />
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-[-0.02em] text-text">{collection.name}</h1>
          {collection.description && (
            <p className="text-[13px] text-text-secondary">{collection.description}</p>
          )}
          <p className="text-[12px] text-text-muted">{galleries.length} galleries</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={openPicker}>
            <Icon name="plus" size={15} /> Add galleries
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              const next = prompt("Collection name", collection.name);
              if (!next || next.trim() === collection.name) return;
              await api.patchCollection(collection.id, { name: next.trim() });
              await load();
            }}
          >
            <Icon name="edit" size={15} /> Rename
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (!confirm("Delete this collection? Galleries remain in your library.")) return;
              await api.deleteCollection(collection.id);
              router.push("/collections");
            }}
          >
            <Icon name="trash" size={15} /> Delete
          </Button>
        </div>
      </div>

      {galleries.length === 0 ? (
        <EmptyState
          icon="collections"
          title="No galleries in this collection"
          description="Add galleries from your library to start organizing this collection."
          action={
            <Button variant="soft" onClick={openPicker}>
              Add galleries
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {galleries.map((gallery, index) => (
            <div
              key={gallery.id}
              className="flex items-center gap-4 rounded-lg border border-border bg-surface p-3"
            >
              <Link href={`/gallery/${gallery.id}`} className="shrink-0">
                <div className="h-[104px] w-[78px] shrink-0 overflow-hidden rounded-md bg-primary-soft" style={{ width: 78 }}>
                  {gallery.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={gallery.cover_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/gallery/${gallery.id}`} className="line-clamp-1 text-[15px] font-bold text-text">
                  {gallery.title}
                </Link>
                <div className="mt-1 text-[12px] text-text-secondary">
                  {gallery.page_count} pages · {gallery.reading_status}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="rounded-md p-1.5 text-text-muted hover:bg-primary-soft hover:text-primary disabled:opacity-30"
                  aria-label="Move up"
                >
                  <Icon name="chevron-up" size={16} />
                </button>
                <button
                  onClick={() => move(index, 1)}
                  disabled={index === galleries.length - 1}
                  className="rounded-md p-1.5 text-text-muted hover:bg-primary-soft hover:text-primary disabled:opacity-30"
                  aria-label="Move down"
                >
                  <Icon name="chevron-down" size={16} />
                </button>
                <button
                  onClick={() => remove(gallery.id)}
                  className="rounded-md p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger"
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
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-auto">
            {allGalleries.map((gallery) => (
              <label
                key={gallery.id}
                className="flex items-center gap-3 rounded-md border border-border bg-surface p-2"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(gallery.id)}
                  onChange={(event) => {
                    if (event.target.checked) setSelected([...selected, gallery.id]);
                    else setSelected(selected.filter((id) => id !== gallery.id));
                  }}
                />
                <div className="h-[60px] w-[45px] shrink-0 overflow-hidden rounded bg-primary-soft">
                  {gallery.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={gallery.cover_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-[13px] font-semibold text-text">{gallery.title}</div>
                  <div className="text-[11px] text-text-secondary">{gallery.page_count} pages</div>
                </div>
              </label>
            ))}
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
