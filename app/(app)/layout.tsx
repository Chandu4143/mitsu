import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      <main className="mx-auto w-full max-w-[1500px] px-4 pb-28 pt-[calc(3.75rem+env(safe-area-inset-top))] md:py-9 md:pb-12 md:pl-[296px] md:pr-10">
        {/* Pages read their id from the query string so the bundle can be exported statically. */}
        <Suspense fallback={null}>
          <div className="page-enter flex flex-col gap-7 md:gap-9">{children}</div>
        </Suspense>
      </main>
    </div>
  );
}
