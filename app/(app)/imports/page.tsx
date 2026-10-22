"use client";

import { useEffect, useState } from "react";
import { api, type Job, type LibraryRoot } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { Button, EmptyState, Skeleton } from "@/components/ui";

const filters = ["All", "Running", "Completed", "Failed"];

export default function Imports() {
  const [path, setPath] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [roots, setRoots] = useState<LibraryRoot[]>([]);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All");

  const refresh = async () => {
    try {
      setJobs(await api.listImports());
      setRoots(await api.listLibraryRoots());
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 1500);
    return () => clearInterval(timer);
  }, []);

  const doImport = async () => {
    if (!path.trim()) return;
    setImporting(true);
    setMsg("");
    setError("");
    try {
      const job = await api.startImport({ path: path.trim() });
      setMsg(`Import queued: ${job.id.slice(0, 8)}`);
      setPath("");
      await refresh();
    } catch (err) {
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
            {importing ? "Importing…" : "Import"}
          </Button>
        </div>
        {msg && <div className="text-[12px] text-text-muted">{msg}</div>}
        {error && <div className="text-[12px] text-danger">{error}</div>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
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
                const color =
                  job.status === "completed"
                    ? "bg-success"
                    : job.status === "failed"
                    ? "bg-danger"
                    : job.status === "cancelled"
                    ? "bg-text-muted"
                    : "bg-primary";
                const textColor =
                  job.status === "completed"
                    ? "text-success"
                    : job.status === "failed"
                    ? "text-danger"
                    : job.status === "cancelled"
                    ? "text-text-muted"
                    : "text-primary";
                const percent = job.progress_total
                  ? Math.round((job.progress_current / job.progress_total) * 100)
                  : 0;
                return (
                  <div
                    key={job.id}
                    className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4"
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-white ${color}`}
                    >
                      <Icon
                        name={
                          job.status === "completed"
                            ? "check"
                            : job.status === "failed"
                            ? "alert"
                            : "clock"
                        }
                        size={20}
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-[14px] font-semibold text-text">
                          {job.type} · {job.id.slice(0, 8)}
                        </div>
                        <div className={`text-[12px] font-semibold ${textColor}`}>{job.status}</div>
                      </div>
                      <div className="text-[12px] text-text-secondary">
                        {job.progress_current}/{job.progress_total}
                        {job.result_id ? ` · gallery ${job.result_id.slice(0, 8)}` : ""}
                        {job.error_message ? ` · ${job.error_message}` : ""}
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-border">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
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
                      {(job.status === "queued" || job.status === "running") && (
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
