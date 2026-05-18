import { ProfileProvider } from '@/components/profile-provider';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Toaster } from '@/components/ui/sonner';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProfileProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-[#F1F4F8] dark:bg-[#0D1117]">
          <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-slate-200/80 bg-[#F1F4F8]/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-[#F1F4F8]/75 dark:border-white/10 dark:bg-[#0D1117]/90 dark:supports-[backdrop-filter]:bg-[#0D1117]/75">
            <SidebarTrigger className="-ml-1 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white" />
            <Separator orientation="vertical" className="mr-2 h-4 bg-slate-200 dark:bg-white/10" />
          </header>
          <main className="flex-1 bg-[#F1F4F8] p-6 text-slate-950 dark:bg-[#0D1117] dark:text-white">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
      <Toaster richColors position="top-right" />
    </ProfileProvider>
  );
}
