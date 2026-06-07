import { Sidebar } from "@/components/ui/Sidebar";
import { MobileNav } from "@/components/ui/MobileNav";
import { BYPASS_AUTH, getStudent } from "@/lib/dal";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const student = await getStudent();

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1400px] gap-2 px-2 pb-20 sm:px-4 md:pb-0">
      <Sidebar role={student.role} bypass={BYPASS_AUTH} />
      <main className="flex-1 px-4 py-6 sm:px-6">
        {BYPASS_AUTH && (
          <div className="mb-4 inline-flex items-center gap-2 border border-fg px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-fg">
            <span className="h-1.5 w-1.5 bg-fg animate-pulse" />
            Dev preview · auth bypassed
          </div>
        )}
        {children}
      </main>
      <MobileNav role={student.role} bypass={BYPASS_AUTH} />
    </div>
  );
}
