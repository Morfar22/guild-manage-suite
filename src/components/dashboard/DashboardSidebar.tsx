import { DashboardSidebarContent } from './DashboardSidebarContent';

export function DashboardSidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-sidebar-border bg-sidebar lg:block">
      <DashboardSidebarContent />
    </aside>
  );
}
