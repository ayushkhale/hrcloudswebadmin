// ─────────────────────────────────────────────────────────────────────────────
// DashboardLayout.jsx — the console chrome: sidebar, top bar, content well.
//
// Structure is unchanged from before; what moved is the palette (red → HR
// Clouds purple), the mark, and the sections. Nav items now come from
// `config/navigation.js` so the sidebar label, the page <h1> and the top-bar
// title are one string — the rule the product holds across its workspaces.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import logo from '../assets/brand/logo.png'
import { LogOut, Bell, Menu, X, Shield } from 'lucide-react'
import { BRAND, roleLabel, can } from '../config/brand'
import { NAV_ITEMS, navItem } from '../config/navigation'

export default function DashboardLayout({
  user,
  activeKey,
  setActiveKey,
  handleSignOut,
  children,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const active = navItem(activeKey)

  // A capability a role lacks is ABSENT, not broken — never render a control
  // that would 403 on press.
  const navItems = NAV_ITEMS.filter((item) => can(user?.role, item.capability))

  return (
    <div
      className="h-screen flex overflow-hidden antialiased"
      style={{ backgroundColor: 'var(--bg-page)' }}
    >
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-[#150c24]/40 z-40 transition-opacity backdrop-blur-xs"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ───────────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-60 bg-white flex flex-col justify-between shrink-0 border-r transition-transform duration-300 ease-in-out
          lg:static lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="min-h-0 flex-1 flex flex-col">
          {/* Brand Header */}
          <div
            className="px-5 py-4 border-b flex justify-between items-center gap-2 shrink-0"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="min-w-0">
              <img
                src={logo}
                alt={BRAND.product}
                className="h-6 w-auto object-contain"
              />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#9333ea] block mt-1.5">
                {BRAND.console}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 text-[#a79db4] hover:text-[#150c24] border border-[#e6e1f0] rounded cursor-pointer text-xs font-bold w-7 h-7 flex items-center justify-center shrink-0"
              aria-label="Close sidebar"
            >
              <X size={16} />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1 overflow-y-auto flex-1 min-h-0">
            <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[#a79db4]">
              Navigation
            </div>
            {navItems.map(({ key, label, icon: Icon, built }) => {
              const isActive = activeKey === key

              return (
                <button
                  key={key}
                  onClick={() => {
                    setActiveKey(key)
                    setSidebarOpen(false)
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer text-left ${
                    isActive
                      ? 'bg-[#9333ea]/10 text-[#9333ea]'
                      : 'text-[#22143a]/70 hover:text-[#150c24] hover:bg-[#f7f5fc]'
                  }`}
                >
                  <span className={isActive ? 'text-[#9333ea]' : 'text-[#a79db4]'}>
                    <Icon size={18} />
                  </span>
                  <span className="truncate flex-1">{label}</span>
                  {/* Says the section is planned, not that it failed. */}
                  {!built && (
                    <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#f7f5fc] text-[#a79db4] border border-[#e6e1f0] shrink-0">
                      Soon
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Footer Area with User Profile & Sign Out */}
        <div
          className="p-3 border-t space-y-2 shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2.5 px-3 py-2 bg-[#f7f5fc] rounded-lg">
            <div className="w-8 h-8 rounded-full bg-[#9333ea] text-white flex items-center justify-center font-black text-xs shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#150c24] truncate leading-tight">
                {user?.name || 'Platform Operator'}
              </p>
              <p className="text-[10px] text-[#a79db4] truncate leading-tight flex items-center gap-1">
                <Shield size={10} className="text-[#9333ea]" />
                {roleLabel(user?.role) || 'Super Admin'}
              </p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold text-[#22143a]/60 hover:text-[#9333ea] hover:bg-[#f7f5fc] transition-all cursor-pointer"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden min-h-0 h-full">
        {/* Top Header Bar */}
        <header
          className="h-16 bg-white border-b flex items-center justify-between px-4 lg:px-8 shrink-0 z-10"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-[#22143a]/70 hover:text-[#150c24] border border-[#e6e1f0] rounded-lg cursor-pointer"
              aria-label="Open sidebar"
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              {/* Same string as the sidebar label and the page <h1>. */}
              <h1 className="text-lg lg:text-xl font-black text-[#150c24] leading-tight truncate">
                {active.label}
              </h1>
              <p className="text-xs text-[#a79db4] font-medium hidden sm:block">
                {BRAND.full}
              </p>
            </div>
          </div>

          {/* Quick Actions / Status */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f7f5fc] border border-[#e6e1f0] text-[#7e22ce] text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-[#9333ea] animate-pulse"></span>
              <span className="hidden sm:inline">All systems operational</span>
            </div>
            <button
              type="button"
              className="w-9 h-9 rounded-lg border border-[#e6e1f0] flex items-center justify-center text-[#22143a]/70 hover:text-[#150c24] hover:bg-[#f7f5fc] transition-colors cursor-pointer"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell size={17} />
            </button>
          </div>
        </header>

        {/* Workspace content wrapper */}
        <main
          className="flex-1 flex flex-col min-w-0 relative overflow-y-auto min-h-0 p-4 lg:p-8"
          style={{ backgroundColor: 'var(--bg-page)' }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
