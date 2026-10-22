"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type Collection, type Gallery } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { Button, EmptyState, Modal, Skeleton } from "@/components/ui";

function CollectionsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [covers, setCovers] = useState<Record<string, Gallery[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pendingGallery, setPendingGallery] = useState(searchParams.get("add"));

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await api.listCollections();
      setCollections(list);
      const details = await Promise.all(
        list.map((collection: Collection) => api.getCollection(collection.id).catch(() => null))
      );
      const next: Record<string, Gallery[]> = {};
      details.forEach((detail, index) => {
        if (detail?.items) next[list[index].id] = detail.items.slice(0, 3);
      });
      setCovers(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const add = searchParams.get("add");
    if (add) setPendingGallery(add);
  }, [searchParams]);

  const create = async () => {
    if (!name.trim()) return;
    const collection = await api.createCollection(name.trim(), description.trim() || undefined);
    setName("");
    setDescription("");
    setCreateOpen(false);
    if (pendingGallery) {
      await api.addCollectionItems(collection.id, [pendingGallery]);
      setPendingGallery(null);
      router.replace("/collections");
    }
    await load();
  };

  const removeCollection = async (id: string) => {
    if (!confirm("Delete this collection? Galleries remain in your library.")) return;
    await api.deleteCollection(id);
    await load();
  };

  const renameCollection = async (collection: Collection) => {
    const next = prompt("Collection name", collection.name);
    if (!next || next.trim() === collection.name) return;
    await api.patchCollection(collection.id, { name: next.trim() });
    await load();
  };

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-[-0.02em] text-text">Collections</h1>
          <p className="text-[13px] text-text-secondary">
            Organize galleries into reading lists and themes.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Icon name="plus" size={16} /> New collection
        </Button>
      </div>

      {pendingGallery && (
        <div className="rounded-lg border border-primary/30 bg-primary-soft px-4 py-3 text-[13px] text-primary">
          Choose or create a collection for the selected gallery.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-[13px] text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-wrap gap-5">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-[218px] w-[320px]" />
          ))}
        </div>
      ) : collections.length === 0 ? (
        <EmptyState
          icon="collections"
          title="No collections yet"
          description="Create a collection to group galleries by mood, series, or reading plan."
          action={
            <Button variant="soft" onClick={() => setCreateOpen(true)}>
              Create collection
            </Button>
          }
        />
      ) : (
        <div className="flex flex-wrap gap-5">
          {collections.map((collection) => (
            <div
              key={collection.id}
              className="group flex w-[320px] flex-col overflow-hidden rounded-lg border border-border bg-surface transition hover:border-primary"
            >
              <Link href={`/collections/${collection.id}`} className="block">
                <div className="flex h-[170px] gap-1 bg-primary-soft p-3">
                  {(covers[collection.id] || []).length === 0
                    ? Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="flex-1 rounded-sm border border-border bg-surface/70" />
                      ))
                    : (covers[collection.id] || []).map((gallery) => (
                        <div key={gallery.id} className="flex-1 overflow-hidden rounded-sm bg-surface">
                          {gallery.cover_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={gallery.cover_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-primary">
                              <Icon name="image" size={18} />
                            </div>
                          )}
                        </div>
                      ))}
                </div>
              </Link>
              <div className="flex items-center justify-between px-4 py-3.5">
                <Link href={`/collections/${collection.id}`} className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold text-text">{collection.name}</div>
                  <div className="text-[12px] text-text-secondary">
                    {collection.item_count} galleries
                  </div>
                </Link>
                <div className="flex gap-1">
                  <button
                    onClick={() => renameCollection(collection)}
                    className="rounded-md p-1.5 text-text-muted hover:bg-primary-soft hover:text-primary"
                    aria-label="Rename collection"
                  >
                    <Icon name="edit" size={15} />
                  </button>
                  <button
                    onClick={() => removeCollection(collection.id)}
                    className="rounded-md p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger"
                    aria-label="Delete collection"
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <Modal title="New collection" onClose={() => setCreateOpen(false)}>
          <div className="flex flex-col gap-3">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Collection name"
              className="rounded-md border border-border bg-bg px-3 py-2 text-[14px] text-text outline-none focus:border-primary"
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Description (optional)"
              rows={3}
              className="rounded-md border border-border bg-bg px-3 py-2 text-[14px] text-text outline-none focus:border-primary"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={create}>Create</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function CollectionsPage() {
  return (
    <Suspense fallback={<div className='text-text-muted text-[13px]'>Loading...</div>}>
      <CollectionsInner />
    </Suspense>
  );
}

