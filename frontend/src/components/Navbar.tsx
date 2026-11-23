import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Role } from '../types.js';
import { Box, User, LogOut, Shield } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout, loginAsRole } = useAuth();

  const roles: { role: Role; label: string; bg: string }[] = [
    { role: 'ADMIN', label: 'Admin', bg: 'bg-purple-100 text-purple-800 border-purple-300' },
    { role: 'WAREHOUSE_MANAGER', label: 'Manager', bg: 'bg-blue-100 text-blue-800 border-blue-300' },
    { role: 'INVENTORY_OPERATOR', label: 'Operator', bg: 'bg-amber-100 text-amber-800 border-amber-300' },
    { role: 'AUDITOR', label: 'Auditor', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  ];

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-sky-600 flex items-center justify-center text-white shadow-md shadow-sky-600/20">
          <Box className="w-6 h-6" />
        </div>
        <div>
          <div className="font-bold text-slate-900 tracking-tight text-lg flex items-center gap-1.5">
            StockPilot
            <span className="text-xs px-2 py-0.5 rounded font-mono font-medium bg-sky-100 text-sky-700">v1.0</span>
          </div>
          <p className="text-xs text-slate-500">Smart Inventory & Warehouse Engine</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Quick Demo Role Switcher */}
        <div className="hidden lg:flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <span className="text-xs text-slate-500 font-medium px-2 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            Switch Demo Role:
          </span>
          {roles.map((r) => {
            const isActive = user?.role === r.role;
            return (
              <button
                key={r.role}
                onClick={() => loginAsRole(r.role)}
                className={`text-xs px-2.5 py-1 rounded font-medium transition-all ${
                  isActive
                    ? 'bg-white shadow text-slate-900 border border-slate-200 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {/* Current User */}
        {user && (
          <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
            <div className="text-right">
              <div className="text-sm font-semibold text-slate-800 leading-tight">{user.name}</div>
              <div className="text-xs font-mono text-slate-500 capitalize">
                {user.role.replace(/_/g, ' ').toLowerCase()}
              </div>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm">
              <User className="w-4 h-4" />
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
