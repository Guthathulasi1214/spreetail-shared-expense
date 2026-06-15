/**
 * components/layout/Layout.jsx
 *
 * Shell wrapper for all protected pages.
 * Renders the sidebar + a scrollable main content area.
 *
 * Passes `sidebarOpen` state down to Sidebar so the mobile
 * hamburger button in the topbar can toggle it.
 *
 * Usage:
 *   <Layout>
 *     <GroupDetail />
 *   </Layout>
 */

import { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile topbar — hamburger + title */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-4 border-b border-zinc-800 bg-zinc-950 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-base font-bold text-white">
            Split<span className="text-brand-400">Ease</span>
          </span>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
