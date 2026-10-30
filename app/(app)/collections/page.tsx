"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type Collection, type Gallery } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { Button, ConfirmDialog, EmptyState, Modal, Skeleton } from "@/components/ui";

function CollectionCover({ covers }: { covers?: Gallery[] }) {
  const items = covers || [];
  return (
    <div className="flex h-full gap-0.5 bg-primary-soft">
      {items.length === 0
        ? Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex-1 border-r border-white/60 bg-surface/55 last:border-r-0">
              <div className="flex h-full items-center justify-center text-primary/40">
                <Icon name="image" size={16} />
              </div>
            </div>
          ))
        : items.map((gallery) => (
            <div key={gallery.id} className="min-w-0 flex-1 overflow-hidden bg-surface">
              {gallery.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={gallery.cover_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-primary">
                  <Icon name="image" size={16} />
                </div>
              )}
            </div>
          ))}
    </div>
  );
}

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
  const [renameTarget, setRenameTarget] = useState<Collection | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  useEffect(() => {
    const add = searchParams.get("add");
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    setDeleteTarget(null);
    try {
      await api.deleteCollection(id);
    } catch (err) {
      setError((err as Error).message);
    }
    await load();
  };

  const renameCollection = async (collection: Collection, value: string) => {
    const next = value.trim();
    if (!next || next === collection.name) {
      setRenameTarget(null);
      return;
    }
    setRenameTarget(null);
    try {
      await api.patchCollection(collection.id, { name: next });
    } catch (err) {
      setError((err as Error).message);
    }
    await load();
  };

  return (
    <>
      <header className="flex items-end justify-between gap-4 pt-1 md:pt-0">
        <div>
          <h1 className="text-[34px] font-extrabold leading-none tracking-[-0.045em] text-text md:text-[40px]">
            Collections
          </h1>
          <p className="mt-2 max-w-[36ch] text-[13px] leading-relaxed text-text-secondary">
            Reading lists for a mood, a series, or a rainy afternoon.
          </p>
        </div>
        <div className="hidden md:block">
          <Button onClick={() => setCreateOpen(true)} aria-label="New collection">
            <Icon name="plus" size={16} />
            New collection
          </Button>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          aria-label="New collection"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary md:hidden"
        >
          <Icon name="plus" size={20} />
        </button>
      </header>

      {pendingGallery && (
        <div className="rounded-2xl border border-primary/20 bg-primary-soft px-4 py-3 text-[13px] text-primary">
          Choose a collection for the selected gallery, or create a new one.
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3 text-[13px] text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 min-[390px]:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[228px] w-full rounded-[24px]" />
          ))}
        </div>
      ) : collections.length === 0 ? (
        <EmptyState
          icon="collections"
          title="No collections yet"
          description="Group galleries into reading lists and keep the next book ready."
          action={
            <Button variant="soft" onClick={() => setCreateOpen(true)}>
              Create collection
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[390px]:grid-cols-2 xl:grid-cols-3">
          {collections.map((collection) => (
            <article
              key={collection.id}
              className="group overflow-hidden rounded-[24px] border border-border/80 bg-surface transition hover:border-border-strong"
            >
              <Link href={`/collection?id=${collection.id}`} className="block">
                <div className="h-[126px] overflow-hidden md:h-[178px]">
                  <CollectionCover covers={covers[collection.id]} />
                </div>
              </Link>
              <div className="flex items-center gap-2 px-3 py-3.5">
                <Link href={`/collection?id=${collection.id}`} className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-bold tracking-[-0.02em] text-text">
                    {collection.name}
                  </div>
                  <div className="mt-0.5 text-[11px] text-text-muted">
                    {collection.item_count} {collection.item_count === 1 ? "gallery" : "galleries"}
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setRenameTarget(collection);
                    setRenameValue(collection.name);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition hover:bg-surface-soft hover:text-text"
                  aria-label="Rename collection"
                >
                  <Icon name="edit" size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(collection)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition hover:bg-danger/10 hover:text-danger"
                  aria-label="Delete collection"
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            </article>
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
              autoFocus
              className="min-h-12 rounded-2xl border border-border bg-surface-soft px-4 text-[16px] text-text outline-none focus:border-primary md:text-[14px]"
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Description (optional)"
              rows={3}
              className="rounded-2xl border border-border bg-surface-soft px-4 py-3 text-[16px] text-text outline-none focus:border-primary md:text-[14px]"
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={create} disabled={!name.trim()}>
                Create
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {renameTarget && (
        <Modal title="Rename collection" onClose={() => setRenameTarget(null)}>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              renameCollection(renameTarget, renameValue);
            }}
          >
            <input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              placeholder="Collection name"
              autoFocus
              className="min-h-12 rounded-2xl border border-border bg-surface-soft px-4 text-[16px] text-text outline-none focus:border-primary md:text-[14px]"
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" type="button" onClick={() => setRenameTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!renameValue.trim()}>
                Save
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete collection?"
          description={`"${deleteTarget.name}" will be removed. The galleries in it stay in your library.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => removeCollection(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}

export default function CollectionsPage() {
  return (
    <Suspense fallback={<div className="text-[13px] text-text-muted">Loading collections…</div>}>
      <CollectionsInner />
    </Suspense>
  );
}
