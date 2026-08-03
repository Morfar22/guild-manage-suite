import { DashboardSidebarContent } from './DashboardSidebarContent';

export function DashboardSidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl lg:block">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-primary/30 to-transparent" aria-hidden />
      <DashboardSidebarContent />

    </aside>
  );
}
