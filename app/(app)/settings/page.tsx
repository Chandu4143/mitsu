"use client";

import { useEffect, useState } from "react";
import { api, type Settings } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { Button, Skeleton } from "@/components/ui";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-[18px] font-bold text-text">{title}</h2>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border py-3 first:border-t-0">
      <span className="text-[14px] text-text">{label}</span>
      <span className="text-[13px] text-text-secondary">{value}</span>
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [roots, setRoots] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
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
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const preferences = settings.preferences || {};
  const stats = settings.stats;

  return (
    <>
      <h1 className="text-[32px] font-extrabold tracking-[-0.02em] text-text">Settings</h1>

      <Section title="Library root">
        {roots.map((root) => (
          <Row key={root.id} label="Path" value={root.path} />
        ))}
        <Row label="Status" value={`${stats.galleries} galleries indexed`} />
        <Row label="Storage used" value={`${(stats.bytes / 1024 / 1024).toFixed(1)} MB`} />
        <Row label="Manage roots" value="Use the Imports page to add or remove roots" />
      </Section>

      <Section title="Reader">
        <Row
          label="Default mode"
          value={
            <select
              value={preferences.reader_mode || "single"}
              onChange={(event) => savePreference("reader_mode", event.target.value)}
              className="rounded-md border border-border bg-bg px-2 py-1 text-[13px] outline-none focus:border-primary"
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
              className="rounded-md border border-border bg-bg px-2 py-1 text-[13px] outline-none focus:border-primary"
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
              className="rounded-md border border-border bg-bg px-2 py-1 text-[13px] outline-none focus:border-primary"
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
              className="rounded-md border border-border bg-bg px-2 py-1 text-[13px] outline-none focus:border-primary"
            >
              <option value="dark">Dark</option>
              <option value="warm">Warm</option>
              <option value="black">Black</option>
            </select>
          }
        />
      </Section>

      <Section title="Metadata sources">
        {sources.map((source) => (
          <Row
            key={source.id}
            label={source.name}
            value={
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  source.enabled ? "bg-success/10 text-success" : "bg-border text-text-muted"
                }`}
              >
                {source.enabled ? "Enabled" : "Disabled"}
              </span>
            }
          />
        ))}
        <Row label="Provenance" value="Shown on gallery detail" />
      </Section>

      <Section title="Storage">
        {Object.entries(settings.paths || {}).map(([key, value]) => (
          <Row key={key} label={key} value={value} />
        ))}
        <Row label="Thumbnails" value={`${stats.pages} pages cached on demand`} />
      </Section>

      <div className="flex flex-col gap-3 rounded-lg border border-danger/30 bg-surface p-5">
        <h2 className="text-[18px] font-bold text-danger">Danger zone</h2>
        <div className="flex items-center justify-between border-t border-border py-3">
          <div>
            <div className="text-[14px] text-text">Remove a gallery from index</div>
            <div className="text-[12px] text-text-secondary">
              Use the Remove action on a gallery detail page. Original files stay on disk.
            </div>
          </div>
          <Icon name="alert" size={18} className="text-danger" />
        </div>
      </div>

      {message && (
        <div className="rounded-md border border-border bg-surface px-4 py-2 text-[12px] text-text-secondary">
          {message}
          {saving && "…"}
        </div>
      )}
    </>
  );
}
