"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type GalleryDetail } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { Button, ConfirmDialog, EmptyState, Modal, Skeleton } from "@/components/ui";

export default function GalleryDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [gallery, setGallery] = useState<GalleryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      setGallery(await api.getGallery(id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex gap-8">
        <Skeleton className="h-[360px] w-[260px]" />
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!gallery) {
    return <EmptyState icon="image" title="Gallery not found" description={error} />;
  }

  const tags = gallery.tags || [];

  const toggleFavorite = async () => {
    try {
      await api.setFavorite(gallery.id, !gallery.favorite);
      setGallery({ ...gallery, favorite: !gallery.favorite });
    } catch {
      // ignore
    }
  };

  const deleteGallery = async () => {
    try {
      await api.deleteGallery(gallery.id, true);
      router.push("/library");
    } catch {
      // ignore
    }
  };

  const percent = gallery.page_count
    ? Math.round((gallery.current_page / gallery.page_count) * 100)
    : 0;

  return (
    <>
      <div className="text-[13px] font-medium text-text-muted">
        <Link href="/library" className="hover:text-primary">
          Library
        </Link>{" "}
        / Gallery
      </div>

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
        <div className="w-full shrink-0 xl:w-[260px]">
          <div className="aspect-[3/4] overflow-hidden rounded-lg border border-border bg-primary-soft">
            {gallery.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={gallery.cover_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-primary">
                <Icon name="image" size={36} />
              </div>
            )}
          </div>
          {gallery.missing && (
            <div className="mt-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-[12px] text-danger">
              Some page files are missing from disk.
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="text-[32px] font-extrabold tracking-[-0.02em] text-text">{gallery.title}</h1>
            <div className="text-[15px] text-text-secondary">
              {gallery.artists?.join(", ") || "Unknown artist"}
            </div>
            {gallery.alternate_title && (
              <div className="text-[13px] text-text-muted">{gallery.alternate_title}</div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[12px] font-semibold text-primary">
              {gallery.reading_status}
            </span>
            <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[12px] font-semibold text-text-secondary">
              {gallery.page_count} pages
            </span>
            <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[12px] font-semibold text-text-secondary">
              {gallery.language}
            </span>
            <button
              onClick={toggleFavorite}
              className="rounded-full border border-border bg-surface px-2.5 py-1 text-[12px] font-semibold text-text-secondary hover:border-primary hover:text-primary"
            >
              {gallery.favorite ? "★ Favorited" : "☆ Favorite"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Link
              href={`/reader/${gallery.id}?page=${gallery.current_page + 1}`}
              className="rounded-full bg-primary px-5 py-2.5 text-[14px] font-semibold text-white"
            >
              {gallery.reading_status === "unread" ? "Read now" : "Continue"}
            </Link>
            <Button variant="soft" onClick={() => setCollectionOpen(true)}>
              <Icon name="collections" size={15} /> Add to collection
            </Button>
            <Button variant="ghost" onClick={() => setEditOpen(true)}>
              <Icon name="edit" size={15} /> Edit metadata
            </Button>
            <Button variant="ghost" onClick={() => setDeleteOpen(true)}>
              <Icon name="trash" size={15} /> Remove
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-text-muted">
              Tags
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border bg-surface px-2.5 py-1 text-[12px] text-text-secondary"
                >
                  {tag}
                </span>
              ))}
              <button
                onClick={() => setEditOpen(true)}
                className="rounded-full bg-primary-soft px-2.5 py-1 text-[12px] font-semibold text-primary"
              >
                + Add tag
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-text-muted">
              Progress
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
              </div>
              <div className="text-[13px] text-text-secondary">
                {gallery.current_page + 1} / {gallery.page_count} pages
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface px-4 py-3 text-[12px] text-text-muted">
            Added {gallery.date_added ? new Date(gallery.date_added).toLocaleDateString() : "recently"}
            {gallery.source_id ? ` · source: ${gallery.source_id}` : ""}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-[18px] font-bold text-text">Pages</h2>
        <div className="flex flex-wrap gap-3">
          {(gallery.pages || []).map((page) => (
            <Link
              key={page.page_index}
              href={`/reader/${gallery.id}?page=${page.page_index + 1}`}
              className="group relative h-[160px] w-[120px] overflow-hidden rounded-md border border-border bg-primary-soft"
            >
              {page.content_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={page.content_url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
              ) : (
                <div className="flex h-full items-center justify-center text-[12px] text-text-muted">
                  {page.page_index + 1}
                </div>
              )}
              <span className="absolute bottom-1.5 right-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                {page.page_index + 1}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {editOpen && (
        <EditMetadataModal
          gallery={gallery}
          saving={saving}
          setSaving={setSaving}
          onClose={() => setEditOpen(false)}
          onSaved={load}
        />
      )}

      {collectionOpen && (
        <CollectionPicker
          galleryIds={[gallery.id]}
          onClose={() => setCollectionOpen(false)}
          onDone={() => setCollectionOpen(false)}
        />
      )}

      {deleteOpen && (
        <ConfirmDialog
          title="Remove gallery from index?"
          description="This removes the database record only. Original files stay on disk."
          confirmLabel="Remove"
          danger
          onConfirm={deleteGallery}
          onCancel={() => setDeleteOpen(false)}
        />
      )}
    </>
  );
}

function EditMetadataModal({
  gallery,
  saving,
  setSaving,
  onClose,
  onSaved,
}: {
  gallery: GalleryDetail;
  saving: boolean;
  setSaving: (value: boolean) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(gallery.title);
  const [alternate, setAlternate] = useState(gallery.alternate_title || "");
  const [language, setLanguage] = useState(gallery.language || "unknown");
  const [tags, setTags] = useState((gallery.tags || []).join(", "));
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await api.patchGallery(gallery.id, {
        title,
        alternate_title: alternate || null,
        language,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Edit metadata" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-text">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded-md border border-border bg-bg px-3 py-2 text-[14px] font-normal text-text outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-text">
          Alternate title
          <input
            value={alternate}
            onChange={(event) => setAlternate(event.target.value)}
            className="rounded-md border border-border bg-bg px-3 py-2 text-[14px] font-normal text-text outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-text">
          Language
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="rounded-md border border-border bg-bg px-3 py-2 text-[14px] font-normal text-text outline-none focus:border-primary"
          >
            <option value="unknown">Unknown</option>
            <option value="en">English</option>
            <option value="ja">Japanese</option>
            <option value="ko">Korean</option>
            <option value="zh">Chinese</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-text">
          Tags (comma separated)
          <textarea
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            rows={3}
            className="rounded-md border border-border bg-bg px-3 py-2 text-[14px] font-normal text-text outline-none focus:border-primary"
          />
        </label>
        {error && <div className="text-[12px] text-danger">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CollectionPicker({
  galleryIds,
  onClose,
  onDone,
}: {
  galleryIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    api
      .listCollections()
      .then(setCollections)
      .catch(() => setCollections([]))
      .finally(() => setLoading(false));
  }, []);

  const createAndAdd = async () => {
    if (!name.trim()) return;
    const collection = await api.createCollection(name.trim());
    await api.addCollectionItems(collection.id, galleryIds);
    onDone();
  };

  const addToExisting = async () => {
    if (!selected) return;
    await api.addCollectionItems(selected, galleryIds);
    onDone();
  };

  return (
    <Modal title="Add to collection" onClose={onClose}>
      {loading ? (
        <div className="text-text-muted text-[13px]">Loading…</div>
      ) : (
        <div className="flex flex-col gap-3">
          {collections.map((collection) => (
            <button
              key={collection.id}
              onClick={() => setSelected(collection.id)}
              className={`rounded-md border px-3 py-2 text-left text-[13px] ${
                selected === collection.id
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-surface text-text"
              }`}
            >
              {collection.name} · {collection.item_count} galleries
            </button>
          ))}
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="New collection name"
              className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-[14px] text-text outline-none focus:border-primary"
            />
            <Button variant="soft" onClick={createAndAdd}>
              Create
            </Button>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={addToExisting} disabled={!selected}>
              Add
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
