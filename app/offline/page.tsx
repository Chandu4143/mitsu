import Link from "next/link";
import { Icon } from "@/components/Icon";

export const metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon name="info" size={26} />
      </div>
      <div>
        <h1 className="text-[24px] font-extrabold tracking-[-0.04em]">You are offline</h1>
        <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-text-secondary">
          Mitsu lives on your machine, but this page needs the local server. Start it again
          and your shelves will be right where you left them.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-[13px] font-semibold text-white"
      >
        Try again
        <Icon name="refresh" size={15} />
      </Link>
    </main>
  );
}
