"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type Collection, type GalleryDetail } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { Button, ConfirmDialog, EmptyState, Modal, Skeleton } from "@/components/ui";

export default function GalleryDetailPage() {
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-32 rounded-full" />
        <div className="flex gap-4">
          <Skeleton className="h-[180px] w-[134px] shrink-0 rounded-[20px]" />
          <div className="flex flex-1 flex-col gap-3">
            <Skeleton className="h-7 w-4/5" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-11 w-full rounded-full" />
          </div>
        </div>
        <Skeleton className="h-40 w-full rounded-[24px]" />
      </div>
    );
  }

  if (!gallery) {
    return <EmptyState icon="image" title="Gallery not found" description={error} />;
  }

  const tags = gallery.tags || [];
  const percent = gallery.page_count
    ? Math.round((gallery.current_page / gallery.page_count) * 100)
    : 0;

  const toggleFavorite = async () => {
    try {
      await api.setFavorite(gallery.id, !gallery.favorite);
      setGallery({ ...gallery, favorite: !gallery.favorite });
    } catch {
      // Leave the current state in place.
    }
  };

  const deleteGallery = async () => {
    try {
      await api.deleteGallery(gallery.id, true);
      router.push("/library");
    } catch {
      // Leave the current state in place.
    }
  };

  return (
    <>
      <Link
        href="/library"
        className="inline-flex min-h-10 w-fit items-center gap-1.5 rounded-full text-[13px] font-semibold text-text-secondary transition hover:text-text"
      >
        <Icon name="arrow-left" size={16} />
        Library
      </Link>

      <section className="flex flex-col gap-6">
        <div className="grid gap-5 md:grid-cols-[260px_minmax(0,1fr)] md:gap-x-10 md:gap-y-6">
          <div className="flex items-start gap-4 md:contents">
            <div className="h-[150px] w-[112px] shrink-0 overflow-hidden rounded-[20px] bg-primary-soft shadow-cover ring-1 ring-black/[0.06] md:row-span-2 md:aspect-[3/4] md:h-auto md:w-full">
              {gallery.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={gallery.cover_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-primary">
                  <Icon name="image" size={34} />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 md:col-start-2 md:row-start-1 md:pt-1">
              <h1 className="line-clamp-4 text-[22px] font-extrabold leading-[1.12] tracking-[-0.04em] text-text md:line-clamp-none md:text-[36px]">
                {gallery.title}
              </h1>
              <div className="mt-2 text-[13px] text-text-secondary">
                {gallery.artists?.join(", ") || "Unknown artist"}
              </div>
              {gallery.alternate_title && (
                <div className="mt-1 line-clamp-2 text-[12px] text-text-muted">
                  {gallery.alternate_title}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold capitalize text-primary">
                  {gallery.reading_status}
                </span>
                <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                  {gallery.page_count} pages
                </span>
                {gallery.language && gallery.language !== "unknown" && (
                  <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase text-text-secondary">
                    {gallery.language}
                  </span>
                )}
              </div>

              {gallery.missing && (
                <div className="mt-3 rounded-2xl border border-danger/25 bg-danger/5 px-3 py-2 text-[12px] text-danger">
                  Some page files are missing from disk.
                </div>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-5 md:col-start-2 md:row-start-2 md:flex-none">
            <div className="flex items-center gap-2">
              <Link
                href={`/reader/${gallery.id}?page=${gallery.current_page + 1}`}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 text-[14px] font-bold text-white shadow-[0_10px_24px_-14px_rgba(179,95,134,0.95)] transition active:scale-[0.99] md:flex-none"
              >
                <Icon name="play" size={15} />
                {gallery.reading_status === "unread" ? "Start reading" : "Continue reading"}
              </Link>
              <button
                type="button"
                onClick={toggleFavorite}
                aria-label={gallery.favorite ? "Remove from favorites" : "Add to favorites"}
                aria-pressed={gallery.favorite}
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition ${
                  gallery.favorite
                    ? "border-primary/20 bg-primary-soft text-primary"
                    : "border-border bg-surface text-text-secondary"
                }`}
              >
                <Icon name="heart" size={19} />
              </button>
              <button
                type="button"
                onClick={() => setCollectionOpen(true)}
                aria-label="Add to collection"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition hover:text-primary"
              >
                <Icon name="collections" size={19} />
              </button>
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                aria-label="Edit metadata"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition hover:text-primary"
              >
                <Icon name="edit" size={18} />
              </button>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                aria-label="Remove gallery"
                className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition hover:text-danger md:flex"
              >
                <Icon name="trash" size={18} />
              </button>
            </div>

            <div>
              <div className="mb-2 flex items-baseline justify-between gap-4">
                <div className="text-[13px] font-semibold text-text">Progress</div>
                <div className="text-[12px] tabular-nums text-text-muted">
                  {gallery.current_page + 1} / {gallery.page_count} pages
                </div>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
              </div>
            </div>

            <div>
              <div className="mb-2 text-[13px] font-semibold text-text">Tags</div>
              <div className="flex flex-wrap gap-1.5">
                {tags.length === 0 && (
                  <span className="text-[12px] text-text-muted">No tags yet.</span>
                )}
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-text-secondary"
                  >
                    {tag}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary"
                >
                  Edit tags
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
              <span>
                Added{" "}
                {gallery.date_added
                  ? new Date(gallery.date_added).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "recently"}
              </span>
              {gallery.source_id && <span>Source {gallery.source_id}</span>}
              {gallery.file_size > 0 && <span>{(gallery.file_size / 1024 / 1024).toFixed(1)} MB</span>}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="pages-heading" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="pages-heading" className="text-[20px] font-bold tracking-[-0.03em] md:text-[22px]">
            Pages
          </h2>
          <span className="text-[11px] text-text-muted">{gallery.page_count} total</span>
        </div>
        <div className="grid grid-cols-3 gap-2 min-[480px]:grid-cols-4 md:grid-cols-[repeat(auto-fill,minmax(112px,1fr))] md:gap-3">
          {(gallery.pages || []).map((page) => (
            <Link
              key={page.page_index}
              href={`/reader/${gallery.id}?page=${page.page_index + 1}`}
              className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-border/70 bg-primary-soft"
            >
              {page.content_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={page.content_url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[12px] text-text-muted">
                  {page.page_index + 1}
                </div>
              )}
              <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/45 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
                {page.page_index + 1}
              </span>
            </Link>
          ))}
        </div>
      </section>

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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-text">
      {label}
      {children}
    </label>
  );
}

function fieldClass() {
  return "min-h-11 w-full rounded-2xl border border-border bg-surface-soft px-3.5 py-2.5 text-[15px] font-normal text-text outline-none transition focus:border-primary md:text-[14px]";
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
      <div className="flex flex-col gap-4">
        <Field label="Title">
          <input value={title} onChange={(event) => setTitle(event.target.value)} className={fieldClass()} />
        </Field>
        <Field label="Alternate title">
          <input
            value={alternate}
            onChange={(event) => setAlternate(event.target.value)}
            className={fieldClass()}
          />
        </Field>
        <Field label="Language">
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className={fieldClass()}
          >
            <option value="unknown">Unknown</option>
            <option value="en">English</option>
            <option value="ja">Japanese</option>
            <option value="ko">Korean</option>
            <option value="zh">Chinese</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
          </select>
        </Field>
        <Field label="Tags">
          <textarea
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            rows={3}
            placeholder="Comma separated"
            className={fieldClass()}
          />
        </Field>
        {error && <div className="text-[12px] text-danger">{error}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
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
  const [collections, setCollections] = useState<Collection[]>([]);
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
        <div className="text-[13px] text-text-muted">Loading collections…</div>
      ) : (
        <div className="flex flex-col gap-3">
          {collections.length === 0 ? (
            <div className="rounded-2xl bg-surface-soft px-4 py-3 text-[13px] text-text-secondary">
              No collections yet. Create one below.
            </div>
          ) : (
            <div className="flex max-h-64 flex-col gap-2 overflow-auto">
              {collections.map((collection) => (
                <button
                  key={collection.id}
                  type="button"
                  onClick={() => setSelected(collection.id)}
                  className={`flex min-h-12 items-center rounded-2xl border px-3.5 text-left text-[13px] transition ${
                    selected === collection.id
                      ? "border-primary/30 bg-primary-soft text-primary"
                      : "border-border bg-surface text-text"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate font-semibold">{collection.name}</span>
                  <span className="ml-3 text-[11px] text-text-muted">
                    {collection.item_count} galleries
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="New collection name"
              className="min-h-11 flex-1 rounded-2xl border border-border bg-surface-soft px-3.5 text-[15px] text-text outline-none focus:border-primary md:text-[14px]"
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
