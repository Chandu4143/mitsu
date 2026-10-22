function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 p-5 bg-surface border border-border rounded-lg">
      <h2 className="text-[18px] font-bold text-text">{title}</h2>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-t border-border">
      <span className="text-[14px] text-text">{label}</span>
      <span className="text-[13px] text-text-secondary">{value}</span>
    </div>
  );
}

export default function Settings() {
  return (
    <>
      <h1 className="text-[32px] font-extrabold tracking-[-0.02em] text-text">Settings</h1>

      <Section title="Library root">
        <Row label="Path" value="/home/user/manga" />
        <Row label="Status" value="Connected · 1,240 galleries" />
        <Row label="Rescan" value="Last: 2 hours ago" />
      </Section>

      <Section title="Reader">
        <Row label="Default mode" value="Single page" />
        <Row label="Reading direction" value="Left to right" />
        <Row label="Reader background" value="Dark" />
        <Row label="Fit mode" value="Fit width" />
      </Section>

      <Section title="Metadata sources">
        <Row label="Local embedded" value="Enabled" />
        <Row label="Remote lookup" value="Disabled" />
        <Row label="Provenance" value="Shown on gallery detail" />
      </Section>

      <Section title="Storage">
        <Row label="Database" value="/data/mitsu.db" />
        <Row label="Thumbnails" value="/data/thumbnails" />
        <Row label="Cache" value="/data/cache" />
      </Section>

      <div className="flex flex-col gap-3 p-5 bg-surface border border-border rounded-lg">
        <h2 className="text-[18px] font-bold text-danger">Danger zone</h2>
        <div className="flex items-center justify-between py-3 border-t border-border">
          <span className="text-[14px] text-danger">Remove gallery from index</span>
          <button className="px-3 py-1.5 bg-danger text-white rounded-full text-[12px] font-semibold">
            Confirm
          </button>
        </div>
      </div>
    </>
  );
}
