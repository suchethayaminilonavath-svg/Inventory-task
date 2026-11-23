import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { StockTransfer, Warehouse, Product } from '../types.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Modal } from '../components/Modal.js';
import { useAuth } from '../context/AuthContext.js';
import {
  ArrowLeftRight,
  Plus,
  CheckCircle,
  Truck,
  PackageCheck,
  XCircle,
  Send,
  Eye,
  AlertCircle,
} from 'lucide-react';

export const TransfersPage: React.FC = () => {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewTransfer, setViewTransfer] = useState<StockTransfer[] | null>(null);
  const [activeTransfer, setActiveTransfer] = useState<StockTransfer | null>(null);

  // Form states
  const [sourceId, setSourceId] = useState('');
  const [destId, setDestId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<{ productId: string; quantityRequested: number }[]>([
    { productId: '', quantityRequested: 10 },
  ]);
  const [sourceStockMap, setSourceStockMap] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canApprove = user?.role === 'ADMIN' || user?.role === 'WAREHOUSE_MANAGER';
  const canOperate = canApprove || user?.role === 'INVENTORY_OPERATOR';

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const url = statusFilter ? `/transfers?status=${statusFilter}` : '/transfers';
      const res = await api.get<{ transfers: StockTransfer[] }>(url);
      setTransfers(res.transfers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehousesAndProducts = async () => {
    try {
      const [wRes, pRes] = await Promise.all([
        api.get<{ warehouses: Warehouse[] }>('/warehouses'),
        api.get<{ products: Product[] }>('/products?limit=100'),
      ]);
      setWarehouses(wRes.warehouses);
      setProducts(pRes.products);
      if (wRes.warehouses.length >= 2) {
        setSourceId(wRes.warehouses[0].id);
        setDestId(wRes.warehouses[1].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, [statusFilter]);

  useEffect(() => {
    fetchWarehousesAndProducts();
  }, []);

  // Update available source stock when sourceId changes
  useEffect(() => {
    async function loadSourceStock() {
      if (!sourceId) return;
      try {
        const res = await api.get<{ inventories: any[] }>(`/warehouses/${sourceId}/inventory`);
        const map: Record<string, number> = {};
        res.inventories.forEach((inv) => {
          map[inv.productId] = inv.quantity;
        });
        setSourceStockMap(map);
      } catch (err) {
        console.error(err);
      }
    }
    loadSourceStock();
  }, [sourceId]);

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (sourceId === destId) {
      setError('Source and destination warehouses cannot be the same');
      setSubmitting(false);
      return;
    }

    try {
      await api.post('/transfers', {
        sourceWarehouseId: sourceId,
        destinationWarehouseId: destId,
        notes,
        items,
      });
      setIsCreateOpen(false);
      fetchTransfers();
    } catch (err: any) {
      setError(err.message || 'Failed to create transfer');
    } finally {
      setSubmitting(false);
    }
  };

  // Workflow actions
  const handleWorkflowAction = async (action: string, transferId: string) => {
    if (!window.confirm(`Are you sure you want to proceed with action: ${action.toUpperCase()}?`)) return;
    try {
      await api.post(`/transfers/${transferId}/${action}`);
      fetchTransfers();
      if (activeTransfer) {
        const updated = await api.get<{ transfer: StockTransfer }>(`/transfers/${transferId}`);
        setActiveTransfer(updated.transfer);
      }
    } catch (err: any) {
      alert(err.message || `Action failed`);
    }
  };

  const addItemRow = () => {
    setItems([...items, { productId: products[0]?.id || '', quantityRequested: 10 }]);
  };

  const removeItemRow = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const statusTabs = [
    { label: 'All', value: '' },
    { label: 'Draft', value: 'DRAFT' },
    { label: 'Requested', value: 'REQUESTED' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'In Transit', value: 'IN_TRANSIT' },
    { label: 'Received', value: 'RECEIVED' },
    { label: 'Cancelled', value: 'CANCELLED' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6 text-indigo-600" />
            Stock Transfers
          </h1>
          <p className="text-sm text-slate-500">
            Multi-warehouse movement workflow: Draft → Requested → Approved → In Transit → Received
          </p>
        </div>

        {canOperate && (
          <button
            onClick={() => {
              setItems([{ productId: products[0]?.id || '', quantityRequested: 10 }]);
              setNotes('');
              setError(null);
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Transfer Request
          </button>
        )}
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
        {statusTabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setStatusFilter(t.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === t.value
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Transfers List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
              <tr>
                <th className="py-3 px-4">Transfer #</th>
                <th className="py-3 px-4">Source Warehouse</th>
                <th className="py-3 px-4">Destination</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Requested By</th>
                <th className="py-3 px-4 text-right">Workflow Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transfers.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-indigo-700 text-xs">
                    {t.transferNumber}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800">{t.sourceWarehouse?.name}</div>
                    <div className="text-xs text-slate-400 font-mono">{t.sourceWarehouse?.code}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800">{t.destinationWarehouse?.name}</div>
                    <div className="text-xs text-slate-400 font-mono">{t.destinationWarehouse?.code}</div>
                  </td>
                  <td className="py-3 px-4 text-center font-mono">
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-xs text-slate-700">
                      {t.items?.length || 0} items
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600">
                    <div>{t.requestedBy?.name}</div>
                    <div className="text-[10px] text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setActiveTransfer(t)}
                        title="View Details"
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Workflow Buttons according to state */}
                      {t.status === 'DRAFT' && canOperate && (
                        <button
                          onClick={() => handleWorkflowAction('request', t.id)}
                          className="px-2.5 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded text-xs font-semibold flex items-center gap-1 border border-sky-200"
                        >
                          <Send className="w-3 h-3" />
                          Request
                        </button>
                      )}

                      {t.status === 'REQUESTED' && canApprove && (
                        <>
                          <button
                            onClick={() => handleWorkflowAction('approve', t.id)}
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-semibold flex items-center gap-1 border border-emerald-200"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleWorkflowAction('reject', t.id)}
                            className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded text-xs font-medium"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {t.status === 'APPROVED' && canOperate && (
                        <button
                          onClick={() => handleWorkflowAction('dispatch', t.id)}
                          className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-xs font-semibold flex items-center gap-1 border border-indigo-200"
                        >
                          <Truck className="w-3 h-3" />
                          Dispatch
                        </button>
                      )}

                      {t.status === 'IN_TRANSIT' && canOperate && (
                        <button
                          onClick={() => handleWorkflowAction('receive', t.id)}
                          className="px-2.5 py-1 bg-emerald-600 text-white hover:bg-emerald-700 rounded text-xs font-semibold flex items-center gap-1 shadow-sm"
                        >
                          <PackageCheck className="w-3 h-3" />
                          Receive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {transfers.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No stock transfers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transfer Detail Modal */}
      <Modal
        isOpen={!!activeTransfer}
        onClose={() => setActiveTransfer(null)}
        title={`Transfer ${activeTransfer?.transferNumber}`}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs text-slate-500">Status: </span>
              <StatusBadge status={activeTransfer?.status || ''} />
            </div>
            <div className="text-xs text-slate-500">
              Created: <span className="font-mono text-slate-700">{activeTransfer && new Date(activeTransfer.createdAt).toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg text-xs">
            <div>
              <div className="text-slate-400 font-semibold uppercase">Source Warehouse</div>
              <div className="font-bold text-slate-800 text-sm mt-0.5">{activeTransfer?.sourceWarehouse?.name}</div>
              <div className="text-slate-500 font-mono">{activeTransfer?.sourceWarehouse?.code}</div>
            </div>
            <div>
              <div className="text-slate-400 font-semibold uppercase">Destination Warehouse</div>
              <div className="font-bold text-slate-800 text-sm mt-0.5">{activeTransfer?.destinationWarehouse?.name}</div>
              <div className="text-slate-500 font-mono">{activeTransfer?.destinationWarehouse?.code}</div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase text-slate-600 mb-2">Transferred Items</h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2 px-3">SKU</th>
                    <th className="py-2 px-3">Product Name</th>
                    <th className="py-2 px-3 text-right">Requested</th>
                    <th className="py-2 px-3 text-right">Transferred</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeTransfer?.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2 px-3 font-mono font-bold text-sky-700">{item.product?.sku}</td>
                      <td className="py-2 px-3 font-medium text-slate-800">{item.product?.name}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{item.quantityRequested}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600">{item.quantityTransferred}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {activeTransfer?.notes && (
            <div className="text-xs text-slate-600 bg-amber-50/50 p-2.5 rounded border border-amber-200/60">
              <span className="font-semibold text-amber-800">Notes / Audit Trail: </span>
              {activeTransfer.notes}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              onClick={() => setActiveTransfer(null)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Transfer Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Stock Transfer">
        <form onSubmit={handleCreateTransfer} className="space-y-4">
          {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Source Warehouse (Deduct)</label>
              <select
                required
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.code} - {w.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Warehouse (Receive)</label>
              <select
                required
                value={destId}
                onChange={(e) => setDestId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.code} - {w.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700">Transfer Items</label>
              <button
                type="button"
                onClick={addItemRow}
                className="text-xs text-indigo-600 font-semibold hover:underline"
              >
                + Add Another Product
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => {
                const availableStock = sourceStockMap[item.productId] ?? 0;
                const isOverStock = item.quantityRequested > availableStock;

                return (
                  <div key={idx} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex-1">
                      <select
                        required
                        value={item.productId}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].productId = e.target.value;
                          setItems(updated);
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs bg-white"
                      >
                        <option value="">Select product...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.sku} - {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-28 text-center text-[11px] text-slate-500 font-mono">
                      Avail: <span className="font-bold text-slate-800">{availableStock}</span>
                    </div>

                    <div className="w-24">
                      <input
                        type="number"
                        min="1"
                        required
                        placeholder="Qty"
                        value={item.quantityRequested}
                        onChange={(e) => {
                          const updated = [...items];
                          updated[idx].quantityRequested = parseInt(e.target.value) || 0;
                          setItems(updated);
                        }}
                        className={`w-full px-2.5 py-1.5 border rounded text-xs font-mono text-right ${
                          isOverStock ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-200'
                        }`}
                      />
                    </div>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        className="text-rose-500 hover:text-rose-700 text-xs px-2"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Transfer Notes</label>
            <textarea
              rows={2}
              placeholder="Reason for transfer, priority dispatch instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Transfer Draft'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
