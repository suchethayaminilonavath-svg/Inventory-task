import React from 'react';
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ArrowLeftRight,
  Truck,
  ShoppingCart,
  ClipboardCheck,
  History,
  BarChart3,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'products'
  | 'warehouses'
  | 'transfers'
  | 'suppliers'
  | 'purchase-orders'
  | 'audits'
  | 'movements'
  | 'reports';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const navItems: { tab: NavTab; label: string; icon: React.ElementType }[] = [
    { tab: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { tab: 'products', label: 'Products', icon: Package },
    { tab: 'warehouses', label: 'Warehouses', icon: Warehouse },
    { tab: 'transfers', label: 'Stock Transfers', icon: ArrowLeftRight },
    { tab: 'suppliers', label: 'Suppliers', icon: Truck },
    { tab: 'purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
    { tab: 'audits', label: 'Stock Audits', icon: ClipboardCheck },
    { tab: 'movements', label: 'Movement Ledger', icon: History },
    { tab: 'reports', label: 'Reports & CSV', icon: BarChart3 },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 min-h-[calc(100vh-4rem)]">
      <div className="p-4 space-y-1 flex-1">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Management
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.tab;
          return (
            <button
              key={item.tab}
              onClick={() => onSelectTab(item.tab)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                isActive
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'hover:bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">
        StockPilot Inventory v1.0.0
      </div>
    </aside>
  );
};
