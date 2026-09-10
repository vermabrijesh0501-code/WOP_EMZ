import React, { useState } from 'react';
import {
  LayoutDashboard,
  Truck,
  RotateCcw,
  Scan,
  Layers,
  BarChart3,
  LogOut,
  Users,
} from 'lucide-react';
import { User, ModuleId } from '../types';
import { hasModulePermission, isSuperAdmin } from '../utils/rbac';

export type ActiveTab =
  | 'dashboard'
  | 'inward'
  | 'grn'
  | 'returns_rto'
  | 'returns_b2b'
  | 'clients'
  | 'couriers'
  | 'locations'
  | 'reports'
  | 'notifications'
  | 'masters'
  | 'user_management';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  openBatchCount: number;
  pendingGateEntriesCount: number;
  activeWarehouseCode?: string;
  activeWarehouseName?: string;
  currentUser?: User;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onLogout?: () => void;
  onOpenUniversalSearch?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  openBatchCount,
  pendingGateEntriesCount,
  currentUser,
  onLogout,
}) => {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  const navItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'inward' as ActiveTab,
      label: 'Vehicle Gate Entry',
      icon: Truck,
      badge: pendingGateEntriesCount > 0 ? String(pendingGateEntriesCount) : null,
      badgeBg: '#F59E0B',
    },
    {
      id: 'returns_rto' as ActiveTab,
      label: 'RTO / B2C Returns',
      icon: RotateCcw,
      badge: openBatchCount > 0 ? String(openBatchCount) : null,
      badgeBg: '#8B5CF6',
    },
    {
      id: 'masters' as ActiveTab,
      label: 'Master Data & Inventory',
      icon: Layers,
      badge: null,
    },
    ...(isSuperAdmin(currentUser)
      ? [
          {
            id: 'user_management' as ActiveTab,
            label: 'User & Role Management',
            icon: Users,
            badge: null,
            badgeBg: '#8B5CF6',
          },
        ]
      : []),
    {
      id: 'reports' as ActiveTab,
      label: 'Reports & Manifests',
      icon: BarChart3,
      badge: null,
    },
  ];

  const isItemActive = (itemId: ActiveTab): boolean => {
    if (activeTab === itemId) return true;
    if (activeTab === 'inward' && itemId === 'grn') return false;
    if (activeTab === 'user_management' && itemId === 'user_management') return true;
    if (
      activeTab === 'masters' &&
      (itemId === 'clients' ||
        itemId === 'couriers' ||
        itemId === 'locations')
    )
      return activeTab === itemId;
    return false;
  };

  const visibleItems = navItems.filter((item) => {
    if (item.id === 'user_management') {
      return isSuperAdmin(currentUser);
    }
    return hasModulePermission(currentUser, item.id as ModuleId, 'view');
  });

  return (
    <>
      {/* DESKTOP FIXED 72PX SIDEBAR */}
      <aside
        id="app-fixed-sidebar"
        className="hidden lg:flex fixed top-0 left-0 z-40 h-screen w-[72px] bg-card border-r border-theme flex-col items-center justify-between py-5 select-none transition-colors duration-200"
      >
        {/* Top Logo / App Icon */}
        <div className="flex flex-col items-center gap-6 w-full">
          <button
            type="button"
            onClick={() => onSelectTab('dashboard')}
            className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#7C3AED] to-[#8B5CF6] text-white flex items-center justify-center font-bold text-lg shadow-md hover:scale-105 transition-transform cursor-pointer"
            title="WOP-Emiza"
          >
            W
          </button>

          {/* Nav Icons Stack */}
          <nav className="flex flex-col items-center gap-3 w-full px-2">
            {visibleItems.map((item) => {
              const active = isItemActive(item.id);
              const Icon = item.icon;

              return (
                <div key={item.id} className="relative group flex items-center justify-center w-full">
                  <button
                    id={`nav-icon-${item.id}`}
                    type="button"
                    onClick={() => onSelectTab(item.id)}
                    onMouseEnter={() => setHoveredTab(item.id)}
                    onMouseLeave={() => setHoveredTab(null)}
                    className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 cursor-pointer ${
                      active
                        ? 'bg-slate-100 dark:bg-[#3B2D54] text-slate-900 dark:text-[#A78BFA] border border-slate-200/80 dark:border-transparent shadow-2xs font-bold'
                        : 'text-slate-400 hover:text-slate-800 dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] hover:bg-slate-100/70 dark:hover:bg-[#152238]'
                    }`}
                  >
                    <Icon className={`w-6 h-6 transition-transform ${active ? 'scale-105' : 'group-hover:scale-110'}`} />

                    {item.badge && (
                      <span
                        className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center border-2 border-card"
                        style={{ backgroundColor: item.badgeBg || '#8B5CF6' }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>

                  {/* Tooltip on Hover */}
                  <div
                    className="absolute left-[76px] px-3 py-1.5 rounded-xl bg-[#1E293B] text-white text-xs font-semibold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 shadow-xl z-50 flex items-center gap-1.5"
                    style={{
                      transform: hoveredTab === item.id ? 'translateX(0)' : 'translateX(-4px)',
                    }}
                  >
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono">
                        {item.badge}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Actions: Sign Out */}
        <div className="flex flex-col items-center gap-3">
          {onLogout && (
            <div className="relative group">
              <button
                type="button"
                onClick={onLogout}
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-[#94A3B8] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
              <div className="absolute left-[76px] px-3 py-1.5 rounded-xl bg-[#1E293B] text-white text-xs font-semibold whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 shadow-xl z-50">
                Sign Out
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-theme flex items-center justify-around px-2 z-40 select-none shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        {visibleItems.slice(0, 5).map((item) => {
          const active = isItemActive(item.id);
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 relative transition-colors cursor-pointer ${
                active ? 'text-[#8B5CF6] font-bold' : 'text-[#94A3B8] hover:text-[#64748B]'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${active ? 'bg-[#F3E8FF] dark:bg-[#3B2D54]' : ''}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] truncate max-w-[60px]">{item.label.split(' ')[0]}</span>

              {item.badge && (
                <span
                  className="absolute top-2 right-1/4 w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                  style={{ backgroundColor: item.badgeBg || '#8B5CF6' }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
};
