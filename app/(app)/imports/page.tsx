"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, type Job, type LibraryRoot } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { Button, EmptyState } from "@/components/ui";

const filters = ["All", "Running", "Completed", "Failed"];

type Notice = {
  tone: "info" | "success" | "error";
  title: string;
  detail?: string;
  galleryId?: string;
};

const statusMeta: Record<
  string,
  {
    label: string;
    color: string;
    text: string;
    icon: "check" | "alert" | "clock" | "refresh" | "x";
  }
> = {
  queued: { label: "Queued", color: "bg-warning", text: "text-warning", icon: "clock" },
  running: { label: "Importing", color: "bg-primary", text: "text-primary", icon: "refresh" },
  completed: { label: "Completed", color: "bg-success", text: "text-success", icon: "check" },
  failed: { label: "Failed", color: "bg-danger", text: "text-danger", icon: "alert" },
  cancelled: { label: "Cancelled", color: "bg-text-muted", text: "text-text-muted", icon: "x" },
};

export default function Imports() {
  const [path, setPath] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [roots, setRoots] = useState<LibraryRoot[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All");
  const [notice, setNotice] = useState<Notice | null>(null);
  const trackedIdRef = useRef<string | null>(null);
  const trackedLabelRef = useRef("");
  const jobsRef = useRef<HTMLDivElement>(null);

  const refresh = async (): Promise<Job[]> => {
    try {
      const nextJobs: Job[] = await api.listImports();
      setJobs(nextJobs);
      setRoots(await api.listLibraryRoots());
      return nextJobs;
    } catch (err) {
      setError((err as Error).message);
      return [];
    }
  };

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const nextJobs = await refresh();
      if (cancelled) return;
      // Follow the job the user just started and keep the banner up to date.
      if (!trackedIdRef.current) return;
      const job = nextJobs.find((item) => item.id === trackedIdRef.current);
      if (!job) return;
      const label = trackedLabelRef.current;
      const progress = job.progress_total
        ? `${job.progress_current}/${job.progress_total} pages`
        : "Preparing files…";
      if (job.status === "queued") {
        setNotice({ tone: "info", title: "Import queued", detail: label });
      } else if (job.status === "running") {
        setNotice({ tone: "info", title: "Importing…", detail: `${label} · ${progress}` });
      } else if (job.status === "completed") {
        setNotice({
          tone: "success",
          title: "Import complete",
          detail:
            job.error_code === "DUPLICATE"
              ? `${label} is already in your library.`
              : `${label} · ${progress}`,
          galleryId: job.result_id || undefined,
        });
        trackedIdRef.current = null;
      } else if (job.status === "failed") {
        setNotice({
          tone: "error",
          title: "Import failed",
          detail: job.error_message || `Could not import ${label}.`,
        });
        trackedIdRef.current = null;
      } else if (job.status === "cancelled") {
        setNotice({ tone: "info", title: "Import cancelled", detail: label });
        trackedIdRef.current = null;
      }
    };
    poll();
    const timer = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const doImport = async () => {
    if (!path.trim()) return;
    const target = path.trim();
    setImporting(true);
    setError("");
    setNotice({ tone: "info", title: "Starting import…", detail: target });
    try {
      const job = await api.startImport({ path: target });
      trackedIdRef.current = job.id;
      trackedLabelRef.current = target;
      setPath("");
      await refresh();
      jobsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      setNotice(null);
      setError((err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const addRoot = async () => {
    if (!rootPath.trim()) return;
    setError("");
    try {
      await api.createLibraryRoot(rootPath.trim());
      setRootPath("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const retry = async (job: Job) => {
    try {
      await api.retryImport(job.id);
      trackedIdRef.current = job.id;
      trackedLabelRef.current = `Job ${job.id.slice(0, 8)}`;
      setNotice({ tone: "info", title: "Retrying import…", detail: `Job ${job.id.slice(0, 8)}` });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const cancel = async (job: Job) => {
    try {
      await api.cancelImport(job.id);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const visibleJobs = jobs.filter((job) => {
    if (filter === "All") return true;
    if (filter === "Running") return job.status === "queued" || job.status === "running";
    return job.status === filter.toLowerCase();
  });

  return (
    <>
      <h1 className="text-[32px] font-extrabold tracking-[-0.02em] text-text">Imports</h1>
      <p className="text-[13px] text-text-secondary">
        Import CBZ, ZIP, image files, or folders. Existing galleries are detected by content.
      </p>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
        <div className="flex gap-2">
          <input
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="Path to CBZ/ZIP, image, or folder"
            className="flex-1 rounded-full border border-border bg-bg px-4 py-2.5 text-[14px] text-text outline-none focus:border-primary placeholder:text-text-muted"
          />
          <Button onClick={doImport} disabled={importing}>
            {importing ? "Starting…" : "Import"}
          </Button>
        </div>
        {error && <div className="text-[12px] text-danger">{error}</div>}
      </div>

      {notice && (
        <div
          className={`flex items-start gap-3 rounded-lg border px-4 py-3.5 ${
            notice.tone === "success"
              ? "border-success/30 bg-success/5"
              : notice.tone === "error"
              ? "border-danger/30 bg-danger/5"
              : "border-primary/30 bg-primary-soft"
          }`}
          role="status"
          aria-live="polite"
        >
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              notice.tone === "success"
                ? "bg-success text-white"
                : notice.tone === "error"
                ? "bg-danger text-white"
                : "bg-primary text-white"
            }`}
          >
            {notice.tone === "success" ? (
              <Icon name="check" size={18} />
            ) : notice.tone === "error" ? (
              <Icon name="alert" size={18} />
            ) : (
              <Icon name="refresh" size={18} className="animate-spin" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div
              className={`text-[14px] font-bold ${
                notice.tone === "success"
                  ? "text-success"
                  : notice.tone === "error"
                  ? "text-danger"
                  : "text-primary"
              }`}
            >
              {notice.title}
            </div>
            {notice.detail && (
              <div className="mt-0.5 truncate text-[12px] text-text-secondary" title={notice.detail}>
                {notice.detail}
              </div>
            )}
          </div>
          {notice.galleryId && (
            <Link
              href={`/gallery/${notice.galleryId}`}
              className="shrink-0 self-center rounded-full bg-primary px-3 py-1.5 text-[12px] font-semibold text-white"
            >
              Open gallery
            </Link>
          )}
          {notice.tone !== "info" && (
            <button
              onClick={() => setNotice(null)}
              className="shrink-0 self-center rounded-md p-1.5 text-text-muted hover:bg-primary-soft hover:text-primary"
              aria-label="Dismiss"
            >
              <Icon name="x" size={15} />
            </button>
          )}
        </div>
      )}

      <div ref={jobsRef} className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                  filter === item
                    ? "bg-primary text-white"
                    : "border border-border bg-surface text-text-secondary"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          {jobs.length === 0 ? (
            <EmptyState
              icon="upload"
              title="No import jobs yet"
              description="Paste a path above to start indexing your collection."
            />
          ) : visibleJobs.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface px-5 py-8 text-center text-[13px] text-text-secondary">
              No jobs match this filter.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {visibleJobs.map((job) => {
                const meta = statusMeta[job.status] || statusMeta.queued;
                const isActive = job.status === "queued" || job.status === "running";
                const percent = job.progress_total
                  ? Math.round((job.progress_current / job.progress_total) * 100)
                  : 0;
                return (
                  <div
                    key={job.id}
                    className={`flex items-center gap-4 rounded-lg border bg-surface p-4 transition ${
                      isActive ? "border-primary/40" : "border-border"
                    }`}
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-white ${meta.color}`}
                    >
                      <Icon
                        name={meta.icon}
                        size={20}
                        className={job.status === "running" ? "animate-spin" : ""}
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-[14px] font-semibold text-text">
                          {job.type} · {job.id.slice(0, 8)}
                        </div>
                        <div className={`text-[12px] font-semibold ${meta.text}`}>
                          {meta.label}
                          {job.status === "running" ? ` ${percent}%` : ""}
                        </div>
                      </div>
                      <div className="text-[12px] text-text-secondary">
                        {job.progress_current}/{job.progress_total} pages
                        {job.result_id ? ` · gallery ${job.result_id.slice(0, 8)}` : ""}
                        {job.error_message ? ` · ${job.error_message}` : ""}
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-border">
                        <div
                          className={`h-full rounded-full transition-[width] duration-500 ${meta.color}`}
                          style={{ width: `${job.status === "completed" ? 100 : percent}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {job.status === "failed" && (
                        <button
                          onClick={() => retry(job)}
                          className="rounded-md p-1.5 text-text-muted hover:bg-primary-soft hover:text-primary"
                          aria-label="Retry import"
                        >
                          <Icon name="refresh" size={16} />
                        </button>
                      )}
                      {isActive && (
                        <button
                          onClick={() => cancel(job)}
                          className="rounded-md p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger"
                          aria-label="Cancel import"
                        >
                          <Icon name="x" size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="text-[16px] font-bold text-text">Library roots</h2>
            <p className="mt-1 text-[12px] text-text-secondary">
              Only configured roots are scanned or served.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={rootPath}
                onChange={(event) => setRootPath(event.target.value)}
                placeholder="/path/to/manga"
                className="flex-1 rounded-full border border-border bg-bg px-3 py-2 text-[13px] text-text outline-none focus:border-primary placeholder:text-text-muted"
              />
              <Button variant="soft" onClick={addRoot}>
                Add
              </Button>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {roots.map((root) => (
                <div
                  key={root.id}
                  className="flex items-center justify-between rounded-md border border-border bg-bg px-3 py-2 text-[12px]"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-text">{root.path}</div>
                    <div className="text-text-muted">{root.is_enabled ? "Enabled" : "Disabled"}</div>
                  </div>
                  <button
                    onClick={async () => {
                      await api.deleteLibraryRoot(root.id);
                      await refresh();
                    }}
                    className="rounded-md p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger"
                    aria-label="Remove root"
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
