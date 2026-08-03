import { Outlet, Navigate } from '@tanstack/react-router';
import { useAuth } from '@/contexts/AuthContext';
import { useGuild } from '@/contexts/GuildContext';
import { DashboardSidebar } from './DashboardSidebar';
import { MobileSidebarTrigger } from './MobileSidebarTrigger';
import { Breadcrumbs } from './Breadcrumbs';
import { Loader2 } from 'lucide-react';
import { ReactNode } from 'react';

interface DashboardLayoutProps {
  children?: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, loading } = useAuth();
  const { selectedGuild } = useGuild();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <><Navigate to="/auth" replace /></>;
  }

  if (!selectedGuild) {
    return <><Navigate to="/guilds" replace /></>;
  }

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 grid-backdrop opacity-60" aria-hidden />
      <div className="pointer-events-none fixed left-1/3 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]" aria-hidden />
      <DashboardSidebar />
      <MobileSidebarTrigger />
      <main className="relative lg:pl-64">
        <div className="mx-auto w-full max-w-[1600px] p-4 pt-16 lg:p-8 lg:pt-8">
          <Breadcrumbs />
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
}

