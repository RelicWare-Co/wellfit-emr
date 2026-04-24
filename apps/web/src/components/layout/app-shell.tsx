import { Outlet } from "@tanstack/react-router";

import { Sidebar } from "./sidebar";

export function AppShell() {
  return (
    <div className="flex h-svh">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-background">
        <Outlet />
      </main>
    </div>
  );
}
