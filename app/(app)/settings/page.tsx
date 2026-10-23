"use client";

import { useEffect, useState } from "react";
import { api, type LibraryRoot, type MetadataSource, type Settings } from "@/lib/api";
import { Icon, type IconName } from "@/components/Icon";
import { Skeleton } from "@/components/ui";

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

const selectClass =
  "h-9 max-w-[190px] rounded-xl border border-border bg-surface-soft px-2.5 text-[16px] font-medium text-text outline-none focus:border-primary md:text-[12px]";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [roots, setRoots] = useState<LibraryRoot[]>([]);
  const [sources, setSources] = useState<MetadataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [settingsResponse, rootsResponse, sourcesResponse] = await Promise.all([
        api.getSettings(),
        api.listLibraryRoots(),
        api.listMetadataSources(),
      ]);
      setSettings(settingsResponse);
      setRoots(rootsResponse);
      setSources(sourcesResponse);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const savePreference = async (key: string, value: string) => {
    if (!settings) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await api.saveSettings({ [key]: value });
      setSettings({ ...settings, preferences: response.preferences });
      setMessage("Saved");
      window.setTimeout(() => setMessage(""), 1600);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSaving(false);
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

  return (
    <>
      <header className="flex items-end justify-between gap-4 pt-1 md:pt-0">
        <div>
          <h1 className="text-[34px] font-extrabold leading-none tracking-[-0.045em] text-text md:text-[40px]">
            Settings
          </h1>
          <p className="mt-2 text-[13px] text-text-secondary">Tune the reader and see what is stored.</p>
        </div>
        {message && (
          <span
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
              message === "Saved" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
            }`}
          >
            {message}
            {saving ? "…" : ""}
          </span>
        )}
      </header>

      <Section title="Library" icon="library">
        {roots.map((root) => (
          <Row key={root.id} label="Root folder" value={<span className="block max-w-[180px] truncate" title={root.path}>{root.path}</span>} />
        ))}
        <Row label="Galleries" value={`${stats.galleries} indexed`} />
        <Row label="Pages" value={stats.pages.toLocaleString()} />
        <Row label="Storage used" value={`${(stats.bytes / 1024 / 1024).toFixed(1)} MB`} />
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

      <Section title="Storage" icon="folder">
        {Object.entries(settings.paths || {}).map(([key, value]) => (
          <Row
            key={key}
            label={key.replace(/_/g, " ")}
            value={<span className="block max-w-[220px] truncate" title={value}>{value}</span>}
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
    </>
  );
}
