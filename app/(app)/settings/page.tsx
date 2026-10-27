"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  api,
  type BackupInfo,
  type DuplicateGroup,
  type Job,
  type LibraryRoot,
  type MetadataSource,
  type Settings,
} from "@/lib/api";
import { Icon, type IconName } from "@/components/Icon";
import { Button, Modal, Skeleton } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";

function Section({
  title,
  icon,
  children,
  tone,
}: {
  title: string;
  icon: IconName;
  children: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-border/80 bg-surface">
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full ${
            tone === "danger" ? "bg-danger/10 text-danger" : "bg-primary-soft text-primary"
          }`}
        >
          <Icon name={icon} size={15} />
        </span>
        <h2
          className={`text-[14px] font-bold tracking-[-0.02em] ${
            tone === "danger" ? "text-danger" : "text-text"
          }`}
        >
          {title}
        </h2>
      </div>
      <div className="px-4">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 border-b border-border/60 py-2.5 last:border-b-0">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-text">{label}</div>
        {detail && <div className="mt-0.5 text-[11px] leading-snug text-text-muted">{detail}</div>}
      </div>
      <div className="shrink-0 text-right text-[12px] text-text-secondary">{value}</div>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const selectClass =
  "h-9 max-w-[190px] rounded-xl border border-border bg-surface-soft px-2.5 text-[16px] font-medium text-text outline-none focus:border-primary md:text-[12px]";

const actionButton =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full px-3 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null);
  const [roots, setRoots] = useState<LibraryRoot[]>([]);
  const [sources, setSources] = useState<MetadataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [coverJob, setCoverJob] = useState<Job | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[] | null>(null);
  const [duplicatesBusy, setDuplicatesBusy] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreLibrary, setRestoreLibrary] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const notify = (text: string, tone: "ok" | "error" = "ok") => {
    setNotice({ text, tone });
    if (tone === "ok") {
      window.setTimeout(() => {
        setNotice((current) => (current?.text === text ? null : current));
      }, 2800);
    }
  };

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [settingsResponse, rootsResponse, sourcesResponse, backupResponse] =
        await Promise.all([
          api.getSettings(),
          api.listLibraryRoots(),
          api.listMetadataSources(),
          api.getBackupInfo().catch(() => null),
        ]);
      setSettings(settingsResponse);
      setRoots(rootsResponse);
      setSources(sourcesResponse);
      setBackupInfo(backupResponse);
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const coverRunning = Boolean(
    coverJob && (coverJob.status === "queued" || coverJob.status === "running")
  );

  useEffect(() => {
    if (!coverJob || !coverRunning) return;
    const timer = window.setInterval(async () => {
      try {
        const jobs = await api.listJobs("thumbnail");
        const latest = jobs.find((job) => job.id === coverJob.id) || jobs[0];
        if (!latest) return;
        setCoverJob(latest);
        if (latest.status === "completed") {
          notify(latest.error_message || "Covers rebuilt");
          load(true);
        } else if (latest.status === "failed" || latest.status === "cancelled") {
          notify(latest.error_message || "Cover rebuild failed", "error");
        }
      } catch {
        // Keep polling; a transient error should not stop the job.
      }
    }, 1200);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverJob, coverRunning]);

  const savePreference = async (key: string, value: string) => {
    if (!settings) return;
    try {
      const response = await api.saveSettings({ [key]: value });
      setSettings({ ...settings, preferences: response.preferences });
      notify("Saved");
    } catch (err) {
      notify((err as Error).message, "error");
    }
  };

  const rebuildCovers = async () => {
    setCoverBusy(true);
    try {
      const job = await api.regenerateThumbnails();
      setCoverJob(job);
      notify("Rebuilding covers…");
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setCoverBusy(false);
    }
  };

  const scanDuplicates = async () => {
    setDuplicatesBusy(true);
    try {
      const response = await api.findDuplicates();
      setDuplicates(response.groups);
      notify(
        response.total_groups === 0
          ? "No duplicates found"
          : `${response.total_groups} duplicate ${
              response.total_groups === 1 ? "group" : "groups"
            } found`
      );
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setDuplicatesBusy(false);
    }
  };

  const restore = async () => {
    if (!restoreFile) return;
    setRestoring(true);
    setRestoreError("");
    try {
      const result = await api.restoreBackup(restoreFile, restoreLibrary);
      setRestoreFile(null);
      notify(`Restored ${result.stats.galleries} galleries`);
      await load(true);
      // The backend replaced the database; reload so every panel sees it.
      window.setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setRestoreError((err as Error).message);
    } finally {
      setRestoring(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-40 rounded-full" />
        <Skeleton className="h-52 w-full rounded-[24px]" />
        <Skeleton className="h-64 w-full rounded-[24px]" />
      </div>
    );
  }

  const preferences = settings.preferences || {};
  const stats = settings.stats;
  const coverPercent =
    coverJob && coverJob.progress_total > 0
      ? Math.round((coverJob.progress_current / coverJob.progress_total) * 100)
      : 0;

  return (
    <>
      <header className="flex items-end justify-between gap-4 pt-1 md:pt-0">
        <div>
          <h1 className="text-[34px] font-extrabold leading-none tracking-[-0.045em] text-text md:text-[40px]">
            Settings
          </h1>
          <p className="mt-2 text-[13px] text-text-secondary">
            Tune the reader, keep a backup, and see what is stored.
          </p>
        </div>
        {notice && (
          <span
            className={`max-w-[46%] truncate rounded-full px-3 py-1.5 text-[11px] font-semibold ${
              notice.tone === "ok" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
            }`}
            title={notice.text}
          >
            {notice.text}
          </span>
        )}
      </header>

      <Section title="Appearance" icon="sun">
        <Row
          label="Theme"
          detail="System follows your device setting."
          value={<ThemeToggle />}
        />
      </Section>

      <Section title="Library" icon="library">
        {roots.map((root) => (
          <Row
            key={root.id}
            label="Root folder"
            value={
              <span className="block max-w-[180px] truncate" title={root.path}>
                {root.path}
              </span>
            }
          />
        ))}
        <Row label="Galleries" value={`${stats.galleries} indexed`} />
        <Row label="Pages" value={stats.pages.toLocaleString()} />
        <Row
          label="Reading"
          value={`${stats.reading} in progress · ${stats.completed} finished`}
        />
        <Row label="Bookmarks" value={stats.bookmarks} />
        <Row label="Storage used" value={formatBytes(stats.bytes)} />
        <Row
          label="Manage roots"
          value="Imports"
          detail="Add or remove folders from the Imports page."
        />
      </Section>

      <Section title="Reader" icon="sliders">
        <Row
          label="Default mode"
          value={
            <select
              value={preferences.reader_mode || "single"}
              onChange={(event) => savePreference("reader_mode", event.target.value)}
              className={selectClass}
              aria-label="Default reader mode"
            >
              <option value="single">Single page</option>
              <option value="continuous">Continuous scroll</option>
            </select>
          }
        />
        <Row
          label="Pages per view"
          detail="Single page mode only."
          value={
            <select
              value={preferences.reader_spread || "single"}
              onChange={(event) => savePreference("reader_spread", event.target.value)}
              className={selectClass}
              aria-label="Pages per view"
            >
              <option value="single">One page</option>
              <option value="double">Two pages</option>
            </select>
          }
        />
        <Row
          label="Reading direction"
          value={
            <select
              value={preferences.reading_direction || "ltr"}
              onChange={(event) => savePreference("reading_direction", event.target.value)}
              className={selectClass}
              aria-label="Reading direction"
            >
              <option value="ltr">Left to right</option>
              <option value="rtl">Right to left</option>
            </select>
          }
        />
        <Row
          label="Fit mode"
          value={
            <select
              value={preferences.fit_mode || "width"}
              onChange={(event) => savePreference("fit_mode", event.target.value)}
              className={selectClass}
              aria-label="Reader fit mode"
            >
              <option value="width">Fit width</option>
              <option value="screen">Fit screen</option>
            </select>
          }
        />
        <Row
          label="Reader background"
          value={
            <select
              value={preferences.reader_background || "dark"}
              onChange={(event) => savePreference("reader_background", event.target.value)}
              className={selectClass}
              aria-label="Reader background"
            >
              <option value="dark">Dark</option>
              <option value="warm">Warm</option>
              <option value="black">Black</option>
            </select>
          }
        />
      </Section>

      <Section title="Metadata sources" icon="discover">
        {sources.map((source) => (
          <Row
            key={source.id}
            label={source.name}
            detail={source.description}
            value={
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                  source.enabled ? "bg-success/10 text-success" : "bg-border/60 text-text-muted"
                }`}
              >
                {source.enabled ? "Enabled" : "Disabled"}
              </span>
            }
          />
        ))}
        <Row label="Provenance" value="On gallery detail" />
      </Section>

      <Section title="Backup & restore" icon="download">
        {backupInfo ? (
          <>
            <Row label="App version" value={backupInfo.version} />
            <Row label="Database" value={formatBytes(backupInfo.database_bytes)} />
            <Row
              label="Managed library"
              detail={
                backupInfo.library_available
                  ? backupInfo.library_path
                  : "No managed library folder yet."
              }
              value={formatBytes(backupInfo.library_bytes)}
            />
            <div className="flex flex-col gap-2 border-b border-border/60 py-3">
              <div className="text-[12px] leading-relaxed text-text-muted">
                A backup is a portable zip with the index and, optionally, the files
                Mitsu manages for you. Covers are included with the library.
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={api.backupExportUrl(true)}
                  className={`${actionButton} bg-primary text-white hover:bg-primary-hover`}
                >
                  <Icon name="download" size={13} />
                  Download full backup
                </a>
                <a
                  href={api.backupExportUrl(false)}
                  className={`${actionButton} bg-primary-soft text-primary hover:bg-primary-soft-hover`}
                >
                  <Icon name="download" size={13} />
                  Index only
                </a>
              </div>
              <div className="text-[11px] text-text-muted">
                Estimated size {formatBytes(backupInfo.backup_bytes)}.
              </div>
            </div>
            <div className="flex flex-col gap-2 py-3">
              <div className="text-[12px] leading-relaxed text-text-muted">
                Restoring replaces the current index. Mitsu writes a timestamped
                safety copy first, so a mistaken restore is recoverable.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`${actionButton} border border-border bg-surface-soft text-text-secondary hover:text-text`}
                >
                  <Icon name="upload" size={13} />
                  Restore from file
                </button>
                <label className="inline-flex items-center gap-2 text-[11px] text-text-secondary">
                  <input
                    type="checkbox"
                    checked={restoreLibrary}
                    onChange={(event) => setRestoreLibrary(event.target.checked)}
                    className="h-3.5 w-3.5 accent-[#b35f86]"
                  />
                  Include managed library
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,application/zip"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setRestoreError("");
                    setRestoreFile(file);
                    event.target.value = "";
                  }}
                />
              </div>
            </div>
          </>
        ) : (
          <Row label="Backup information" value="Unavailable" />
        )}
      </Section>

      <Section title="Maintenance" icon="refresh">
        <div className="flex flex-col gap-2 border-b border-border/60 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[13px] font-medium text-text">Rebuild covers</div>
              <div className="mt-0.5 text-[11px] leading-snug text-text-muted">
                Rebuilds every cover from its chosen page, or the first page.
              </div>
            </div>
            <button
              type="button"
              onClick={rebuildCovers}
              disabled={coverBusy || coverRunning}
              className={`${actionButton} shrink-0 bg-primary-soft text-primary hover:bg-primary-soft-hover`}
            >
              <Icon name="refresh" size={13} />
              {coverRunning ? "Running…" : "Rebuild"}
            </button>
          </div>
          {coverJob && (
            <div className="mt-1">
              <div className="flex items-center justify-between gap-3 text-[11px] text-text-muted">
                <span>
                  {coverJob.status === "completed"
                    ? coverJob.error_message || "Covers rebuilt"
                    : coverJob.status === "failed"
                    ? coverJob.error_message || "Could not rebuild covers"
                    : `Rebuilding ${coverJob.progress_current} / ${coverJob.progress_total || "?"}`}
                </span>
                <span className="tabular-nums">{coverPercent}%</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-border">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ${
                    coverJob.status === "failed" ? "bg-danger" : "bg-primary"
                  }`}
                  style={{ width: `${coverPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[13px] font-medium text-text">Find duplicates</div>
              <div className="mt-0.5 text-[11px] leading-snug text-text-muted">
                Groups galleries that share an identical content fingerprint.
              </div>
            </div>
            <button
              type="button"
              onClick={scanDuplicates}
              disabled={duplicatesBusy}
              className={`${actionButton} shrink-0 border border-border bg-surface-soft text-text-secondary hover:text-text`}
            >
              <Icon name="search" size={13} />
              {duplicatesBusy ? "Scanning…" : "Scan"}
            </button>
          </div>
          {duplicates && duplicates.length > 0 && (
            <div className="mt-1 flex flex-col gap-1.5">
              {duplicates.map((group) => (
                <div
                  key={group.content_hash}
                  className="rounded-2xl border border-border/70 bg-surface-soft p-2.5"
                >
                  <div className="text-[11px] font-semibold text-text">
                    {group.count} copies
                  </div>
                  <div className="mt-1 flex flex-col gap-1">
                    {group.items.map((item) => (
                      <Link
                        key={item.id}
                        href={`/gallery/${item.id}`}
                        className="line-clamp-1 text-[11px] text-text-secondary transition hover:text-primary"
                      >
                        {item.title}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {duplicates && duplicates.length === 0 && (
            <div className="rounded-2xl bg-surface-soft px-3 py-2 text-[11px] text-text-muted">
              No duplicate fingerprints in the library.
            </div>
          )}
        </div>
      </Section>

      <Section title="Storage" icon="folder">
        {Object.entries(settings.paths || {}).map(([key, value]) => (
          <Row
            key={key}
            label={key.replace(/_/g, " ")}
            value={
              <span className="block max-w-[220px] truncate" title={value}>
                {value}
              </span>
            }
          />
        ))}
        <Row label="Thumbnails" value="Generated on demand" />
      </Section>

      <Section title="Remove a gallery" icon="alert" tone="danger">
        <Row
          label="Index only"
          value="Detail page"
          detail="Removing a gallery never deletes the original files on disk."
        />
      </Section>

      <p className="pb-2 text-center text-[11px] text-text-muted">
        Mitsu runs on your machine. No accounts, no telemetry.
      </p>

      {restoreFile && (
        <Modal
          title="Restore backup?"
          onClose={() => {
            if (!restoring) setRestoreFile(null);
          }}
        >
          <div className="flex flex-col gap-4">
            <p className="text-[13px] leading-relaxed text-text-secondary">
              Restoring <span className="font-semibold text-text">{restoreFile.name}</span>{" "}
              replaces the current index. Mitsu saves a timestamped safety copy of the
              database before anything changes.
            </p>
            <label className="flex items-center gap-2 text-[12px] text-text-secondary">
              <input
                type="checkbox"
                checked={restoreLibrary}
                onChange={(event) => setRestoreLibrary(event.target.checked)}
                className="h-4 w-4 accent-[#b35f86]"
              />
              Restore managed library files too
            </label>
            {restoreError && <div className="text-[12px] text-danger">{restoreError}</div>}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setRestoreFile(null)}
                disabled={restoring}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={restore} disabled={restoring}>
                {restoring ? "Restoring…" : "Replace and restore"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
