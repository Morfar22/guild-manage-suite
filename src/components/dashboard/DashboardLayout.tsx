import { Outlet, Navigate } from 'react-router-dom';
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
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      <MobileSidebarTrigger />
      <main className="lg:pl-64">
        <div className="p-4 pt-16 lg:p-8 lg:pt-8">
          <Breadcrumbs />
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
}
