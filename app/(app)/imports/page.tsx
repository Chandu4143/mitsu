"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Imports() {
  const [path, setPath] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState("");

  const refresh = () => api.listImports().then(setJobs).catch(() => {});

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, []);

  const doImport = async () => {
    if (!path.trim()) return;
    setImporting(true);
    setMsg("");
    try {
      await api.startImport(path.trim());
      setMsg("Import queued.");
      setPath("");
      refresh();
    } catch (e: any) {
      setMsg(e.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const filters = ["All", "Running", "Completed", "Failed"];

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-[32px] font-extrabold tracking-[-0.02em] text-text">Imports</h1>
      </div>

      <div className="flex gap-2 items-center">
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="Path to CBZ/ZIP or folder"
          className="flex-1 px-4 py-2.5 bg-surface border border-border rounded-full text-[14px] text-text"
        />
        <button
          onClick={doImport}
          disabled={importing}
          className="px-4 py-2.5 bg-primary text-white rounded-full text-[14px] font-semibold disabled:opacity-50"
        >
          {importing ? "Importing…" : "+ Import"}
        </button>
      </div>
      {msg && <div className="text-[12px] text-text-muted">{msg}</div>}

      <div className="flex gap-2">
        {filters.map((f, i) => (
          <span
            key={f}
            className={`px-3 py-1.5 rounded-full text-[12px] font-semibold cursor-pointer ${
              i === 0 ? "bg-primary text-white" : "bg-surface text-text-secondary border border-border"
            }`}
          >
            {f}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {jobs.map((j) => {
          const color =
            j.status === "completed"
              ? "bg-success"
              : j.status === "failed"
              ? "bg-danger"
              : j.status === "running"
              ? "bg-primary"
              : "bg-text-muted";
          const textcolor =
            j.status === "completed"
              ? "text-success"
              : j.status === "failed"
              ? "text-danger"
              : j.status === "running"
              ? "text-primary"
              : "text-text-muted";
          return (
            <div key={j.id} className="flex items-center gap-4 p-4 bg-surface border border-border rounded-lg">
              <div className={`w-11 h-11 ${color} rounded-md shrink-0`} />
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex items-center justify-between">
                  <div className="text-[14px] font-semibold text-text">{j.type} · {j.id.slice(0, 8)}</div>
                  <div className={`text-[12px] font-semibold ${textcolor}`}>{j.status}</div>
                </div>
                <div className="text-[12px] text-text-secondary">
                  {j.progress_current}/{j.progress_total}
                  {j.error_message ? " · " + j.error_message : ""}
                </div>
                <div className="mt-1 h-1.5 bg-border rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full`} style={{ width: `${j.progress_total ? (j.progress_current / j.progress_total) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          );
        })}
        {jobs.length === 0 && <div className="text-text-muted text-[13px]">No import jobs yet.</div>}
      </div>
    </>
  );
}
