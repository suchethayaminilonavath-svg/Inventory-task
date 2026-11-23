import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { InventoryMovement, Warehouse, Product } from '../types.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Modal } from '../components/Modal.js';
import { useAuth } from '../context/AuthContext.js';
import {
  History,
  Plus,
  Filter,
  Download,
  Calendar,
  Layers,
} from 'lucide-react';

export const MovementsPage: React.FC = () => {
  const { user } = useAuth();
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [warehouseId, setWarehouseId] = useState('');
  const [movementType, setMovementType] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [manualProdId, setManualProdId] = useState('');
  const [manualWhId, setManualWhId] = useState('');
  const [manualType, setManualType] = useState('MANUAL_ADJUSTMENT');
  const [manualQty, setManualQty] = useState(10);
  const [manualReason, setManualReason] = useState('Stock count adjustment');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canOperate = user?.role === 'ADMIN' || user?.role === 'WAREHOUSE_MANAGER' || user?.role === 'INVENTORY_OPERATOR';

  const fetchMovements = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (warehouseId) params.append('warehouseId', warehouseId);
      if (movementType) params.append('movementType', movementType);

      const res = await api.get<{ movements: InventoryMovement[]; pagination: { totalPages: number } }>(
        `/movements?${params.toString()}`
      );
      setMovements(res.movements);
      setTotalPages(res.pagination.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      const [wRes, pRes] = await Promise.all([
        api.get<{ warehouses: Warehouse[] }>('/warehouses'),
        api.get<{ products: Product[] }>('/products?limit=100'),
      ]);
      setWarehouses(wRes.warehouses);
      setProducts(pRes.products);
      if (wRes.warehouses[0]) setManualWhId(wRes.warehouses[0].id);
      if (pRes.products[0]) setManualProdId(pRes.products[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [page, warehouseId, movementType]);

  useEffect(() => {
    fetchDependencies();
  }, []);

  const handleManualMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/movements/manual', {
        productId: manualProdId,
        warehouseId: manualWhId,
        movementType: manualType,
        quantity: Number(manualQty),
        reason: manualReason,
      });
      setIsManualOpen(false);
      fetchMovements();
    } catch (err: any) {
      setError(err.message || 'Failed to record movement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (warehouseId) params.append('warehouseId', warehouseId);
    if (movementType) params.append('movementType', movementType);
    window.open(`/api/reports/movements/csv?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-sky-600" />
            Inventory Movement Ledger
          </h1>
          <p className="text-sm text-slate-500">
            Immutable, append-only transaction ledger recording every stock debit, credit, and transfer
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm"
          >
            <Download className="w-4 h-4 text-slate-400" />
            Export Ledger CSV
          </button>

          {canOperate && (
            <button
              onClick={() => {
                setError(null);
                setIsManualOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Record Stock Adjustment
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3">
        <select
          value={warehouseId}
          onChange={(e) => {
            setWarehouseId(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
        >
          <option value="">All Warehouses</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.code} - {w.name}</option>
          ))}
        </select>

        <select
          value={movementType}
          onChange={(e) => {
            setMovementType(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
        >
          <option value="">All Movement Types</option>
          <option value="STOCK_RECEIVED">Stock Received (+)</option>
          <option value="STOCK_ISSUED">Stock Issued (-)</option>
          <option value="TRANSFER_OUT">Transfer Out (-)</option>
          <option value="TRANSFER_IN">Transfer In (+)</option>
          <option value="MANUAL_ADJUSTMENT">Manual Adjustment</option>
          <option value="DAMAGED_STOCK">Damaged Stock (-)</option>
          <option value="RETURNED_STOCK">Returned Stock (+)</option>
        </select>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Product / SKU</th>
                <th className="py-3 px-4">Warehouse</th>
                <th className="py-3 px-4 text-right">Change</th>
                <th className="py-3 px-4 text-right">Prev Balance</th>
                <th className="py-3 px-4 text-right">New Balance</th>
                <th className="py-3 px-4">Performed By</th>
                <th className="py-3 px-4">Reason / Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movements.map((m) => {
                const isPositive = m.quantity > 0;
                return (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {new Date(m.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusBadge status={m.movementType} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{m.product?.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{m.product?.sku}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">{m.warehouse?.code}</td>
                    <td className={`py-3 px-4 text-right font-mono font-bold ${
                      isPositive ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {isPositive ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-500">{m.previousBalance}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{m.newBalance}</td>
                    <td className="py-3 px-4 text-slate-600">{m.user?.name || 'System'}</td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={m.reason}>
                      {m.reason}
                    </td>
                  </tr>
                );
              })}
              {movements.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No inventory ledger records found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>Page {page} of {totalPages || 1}</div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Manual Movement Modal */}
      <Modal isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} title="Record Manual Stock Movement">
        <form onSubmit={handleManualMovement} className="space-y-4">
          <p className="text-xs text-slate-500">
            Records an auditable transaction directly in the ledger and updates warehouse inventory balances.
          </p>

          {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Warehouse *</label>
              <select
                required
                value={manualWhId}
                onChange={(e) => setManualWhId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.code} - {w.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Movement Type *</label>
              <select
                required
                value={manualType}
                onChange={(e) => setManualType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="MANUAL_ADJUSTMENT">Manual Adjustment (Positive or Negative)</option>
                <option value="STOCK_RECEIVED">Stock Received (Addition)</option>
                <option value="STOCK_ISSUED">Stock Issued (Deduction)</option>
                <option value="DAMAGED_STOCK">Damaged Stock (Deduction)</option>
                <option value="RETURNED_STOCK">Returned Stock (Addition)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product *</label>
            <select
              required
              value={manualProdId}
              onChange={(e) => setManualProdId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Delta Quantity (Units) *</label>
            <input
              type="number"
              required
              value={manualQty}
              onChange={(e) => setManualQty(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Auditable Reason *</label>
            <input
              type="text"
              required
              placeholder="e.g. Scrapped defective component batch #40"
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsManualOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
            >
              {submitting ? 'Recording...' : 'Record Movement'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
