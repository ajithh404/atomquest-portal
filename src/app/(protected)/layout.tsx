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
        <SidebarInset className="bg-[#0D1117]">
          <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-white/10 bg-[#0D1117]/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-[#0D1117]/75">
            <SidebarTrigger className="-ml-1 text-white/70 hover:bg-white/10 hover:text-white" />
            <Separator orientation="vertical" className="mr-2 h-4 bg-white/10" />
          </header>
          <main className="flex-1 bg-[#0D1117] p-6 text-white">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
      <Toaster richColors position="top-right" />
    </ProfileProvider>
  );
}
