import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { DashboardMetrics } from '../types.js';
import { StatusBadge } from '../components/StatusBadge.js';
import {
  Package,
  Warehouse,
  Boxes,
  AlertTriangle,
  XCircle,
  ShoppingCart,
  ArrowLeftRight,
  TrendingUp,
  RefreshCw,
  PlusCircle,
} from 'lucide-react';
import { NavTab } from '../components/Sidebar.js';

interface DashboardPageProps {
  onNavigate: (tab: NavTab) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<DashboardMetrics>('/reports/dashboard');
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
        <div className="font-bold mb-1">Failed to load dashboard</div>
        <p className="text-sm">{error}</p>
        <button
          onClick={fetchMetrics}
          className="mt-3 px-3 py-1.5 bg-rose-600 text-white rounded text-xs font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Operations Dashboard</h1>
          <p className="text-sm text-slate-500">Live operational inventory tracking and warehouse throughput</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchMetrics}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm"
          >
            <RefreshCw className="w-4 h-4 text-slate-400" />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigate('products')}
          className="cursor-pointer bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-sky-300 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Products</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{metrics?.totalProducts || 0}</div>
          <span className="text-xs text-slate-500">Active catalog SKUs</span>
        </div>

        <div
          onClick={() => onNavigate('warehouses')}
          className="cursor-pointer bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-sky-300 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Warehouses</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Warehouse className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{metrics?.totalWarehouses || 0}</div>
          <span className="text-xs text-slate-500">Fulfillment locations</span>
        </div>

        <div
          onClick={() => onNavigate('movements')}
          className="cursor-pointer bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-sky-300 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Stock Units</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {metrics?.totalInventoryQuantity?.toLocaleString() || 0}
          </div>
          <span className="text-xs text-slate-500">Across all warehouses</span>
        </div>

        <div
          onClick={() => onNavigate('reports')}
          className="cursor-pointer bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-amber-300 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Stock Alerts</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600">{metrics?.lowStockProducts || 0}</span>
            <span className="text-xs text-slate-400">low</span>
            <span className="text-slate-300">/</span>
            <span className="text-2xl font-bold text-rose-600">{metrics?.outOfStockProducts || 0}</span>
            <span className="text-xs text-slate-400">out</span>
          </div>
          <span className="text-xs text-slate-500">Requires restocking</span>
        </div>
      </div>

      {/* Pending Actions & Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-sky-600" />
            Pending Action Workflows
          </h2>
          <div className="space-y-3">
            <div
              onClick={() => onNavigate('purchase-orders')}
              className="cursor-pointer p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-sky-50/50 hover:border-sky-200 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-4 h-4 text-sky-600" />
                <div>
                  <div className="text-sm font-semibold text-slate-800">Pending Purchase Orders</div>
                  <div className="text-xs text-slate-500">Orders submitted or approved awaiting delivery</div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800">
                {metrics?.pendingPurchaseOrders || 0}
              </span>
            </div>

            <div
              onClick={() => onNavigate('transfers')}
              className="cursor-pointer p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-sky-50/50 hover:border-sky-200 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-3">
                <ArrowLeftRight className="w-4 h-4 text-indigo-600" />
                <div>
                  <div className="text-sm font-semibold text-slate-800">Pending Warehouse Transfers</div>
                  <div className="text-xs text-slate-500">Transfers requested, approved, or in-transit</div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                {metrics?.pendingWarehouseTransfers || 0}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-semibold uppercase text-slate-400 mb-2">Quick Shortcuts</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onNavigate('transfers')}
                className="text-xs font-medium p-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-center transition-colors"
              >
                + New Transfer
              </button>
              <button
                onClick={() => onNavigate('purchase-orders')}
                className="text-xs font-medium p-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-center transition-colors"
              >
                + Create PO
              </button>
              <button
                onClick={() => onNavigate('audits')}
                className="text-xs font-medium p-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-center transition-colors"
              >
                + Start Stock Audit
              </button>
              <button
                onClick={() => onNavigate('products')}
                className="text-xs font-medium p-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-center transition-colors"
              >
                + Add Product
              </button>
            </div>
          </div>
        </div>

        {/* Live Recent Movements */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Boxes className="w-4 h-4 text-emerald-600" />
                Recent Inventory Ledger Movements
              </h2>
              <button
                onClick={() => onNavigate('movements')}
                className="text-xs text-sky-600 font-semibold hover:underline"
              >
                View Full Ledger →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold">
                    <th className="pb-2">Time</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Product / SKU</th>
                    <th className="pb-2">Warehouse</th>
                    <th className="pb-2 text-right">Change</th>
                    <th className="pb-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metrics?.recentMovements?.map((m) => {
                    const isPositive = m.quantity > 0;
                    return (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="py-2.5 text-slate-500 font-mono">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2.5">
                          <StatusBadge status={m.movementType} />
                        </td>
                        <td className="py-2.5">
                          <div className="font-semibold text-slate-800">{m.product?.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{m.product?.sku}</div>
                        </td>
                        <td className="py-2.5 text-slate-600">{m.warehouse?.code}</td>
                        <td className={`py-2.5 text-right font-mono font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isPositive ? `+${m.quantity}` : m.quantity}
                        </td>
                        <td className="py-2.5 text-right font-mono text-slate-700">{m.newBalance}</td>
                      </tr>
                    );
                  })}
                  {(!metrics?.recentMovements || metrics.recentMovements.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No recent movements recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
