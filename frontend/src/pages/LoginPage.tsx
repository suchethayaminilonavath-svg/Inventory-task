import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Role } from '../types.js';
import { Box, Lock, Mail, User, Shield, CheckCircle } from 'lucide-react';
import { api } from '../api/client.js';

export const LoginPage: React.FC = () => {
  const { login, loginAsRole } = useAuth();
  const [isRegister, setIsRegister] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('INVENTORY_OPERATOR');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isRegister) {
        const res = await api.post<{ token: string; user: any }>('/auth/register', {
          email,
          password,
          name,
          role,
        });
        login(res.token, res.user);
      } else {
        const res = await api.post<{ token: string; user: any }>('/auth/login', {
          email,
          password,
        });
        login(res.token, res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const demoRoles: { role: Role; label: string; desc: string; email: string }[] = [
    {
      role: 'ADMIN',
      label: 'Administrator',
      desc: 'Full system privileges: catalog, warehouses, approvals, settings',
      email: 'admin@stockpilot.io',
    },
    {
      role: 'WAREHOUSE_MANAGER',
      label: 'Warehouse Manager',
      desc: 'Approves/rejects transfers, PO approvals, stock audit reconciliations',
      email: 'manager@stockpilot.io',
    },
    {
      role: 'INVENTORY_OPERATOR',
      label: 'Inventory Operator',
      desc: 'Receives stock, dispatches transfers, enters physical counts',
      email: 'operator@stockpilot.io',
    },
    {
      role: 'AUDITOR',
      label: 'Read-only Auditor',
      desc: 'Read-only access to movements ledger, valuation reports, CSV export',
      email: 'auditor@stockpilot.io',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-slate-800">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-sky-600 flex items-center justify-center text-white shadow-lg shadow-sky-600/30 mb-3">
            <Box className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">StockPilot</h1>
          <p className="text-xs text-slate-500 mt-1">Smart Inventory and Warehouse Management Platform</p>
        </div>

        {/* 1-Click Demo Logins */}
        <div className="mb-6 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-sky-600" />
            Instant Demo Sign-In
          </div>
          <div className="grid grid-cols-2 gap-2">
            {demoRoles.map((dr) => (
              <button
                key={dr.role}
                type="button"
                onClick={() => loginAsRole(dr.role)}
                className="text-left p-2 rounded-lg bg-white border border-slate-200 hover:border-sky-500 hover:bg-sky-50/50 transition-all group"
              >
                <div className="text-xs font-bold text-slate-800 group-hover:text-sky-700">{dr.label}</div>
                <div className="text-[10px] text-slate-400 font-mono">{dr.email}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-slate-400">or sign in manually</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">{error}</div>
          )}

          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Alex Mercer"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="email"
                required
                placeholder="user@stockpilot.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Platform Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="INVENTORY_OPERATOR">Inventory Operator</option>
                <option value="WAREHOUSE_MANAGER">Warehouse Manager</option>
                <option value="AUDITOR">Read-only Auditor</option>
                <option value="ADMIN">Administrator</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 shadow-md shadow-sky-600/20 transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="text-xs text-sky-600 hover:underline font-semibold"
          >
            {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    </div>
  );
};
