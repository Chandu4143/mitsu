import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg">
      <Suspense fallback={<div className="w-[240px] shrink-0 bg-surface border-r border-border" />}>
        <Sidebar />
      </Suspense>
      <main className="flex-1 px-4 py-6 md:px-10 md:py-8 flex flex-col gap-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
