"use client";

import { useState, type ReactNode } from "react";
import { AuthGate } from "@/components/auth-gate";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <AuthGate>
      <div className="min-h-screen bg-slate-50">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        {sidebarOpen && (
          <button
            className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          />
        )}
        <div className="lg:pl-64">
          <Topbar onMenu={() => setSidebarOpen(true)} />
          <main className="p-4 lg:p-7">{children}</main>
        </div>
      </div>
    </AuthGate>
  );
}
