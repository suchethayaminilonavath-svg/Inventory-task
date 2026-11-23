import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { StockAudit, Warehouse, Product } from '../types.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Modal } from '../components/Modal.js';
import { useAuth } from '../context/AuthContext.js';
import {
  ClipboardCheck,
  Plus,
  CheckCircle,
  Eye,
  Send,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';

export const StockAuditPage: React.FC = () => {
  const { user } = useAuth();
  const [audits, setAudits] = useState<StockAudit[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeAudit, setActiveAudit] = useState<StockAudit | null>(null);
  const [isCountSheetOpen, setIsCountSheetOpen] = useState(false);

  // Form states
  const [warehouseId, setWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Count Sheet states
  const [countInputs, setCountInputs] = useState<Record<string, { qty: number; reason: string }>>({});

  const canApprove = user?.role === 'ADMIN' || user?.role === 'WAREHOUSE_MANAGER';
  const canOperate = canApprove || user?.role === 'INVENTORY_OPERATOR';

  const fetchAudits = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ audits: StockAudit[] }>('/audits');
      setAudits(res.audits);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await api.get<{ warehouses: Warehouse[] }>('/warehouses');
      setWarehouses(res.warehouses);
      if (res.warehouses[0]) setWarehouseId(res.warehouses[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAudits();
    fetchWarehouses();
  }, []);

  const handleCreateAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/audits', {
        warehouseId,
        notes,
      });
      setIsCreateOpen(false);
      fetchAudits();
    } catch (err: any) {
      setError(err.message || 'Failed to create audit');
    } finally {
      setSubmitting(false);
    }
  };

  const openCountSheet = (audit: StockAudit) => {
    setActiveAudit(audit);
    const initial: Record<string, { qty: number; reason: string }> = {};
    audit.items.forEach((item) => {
      initial[item.productId] = {
        qty: item.physicalQuantity ?? item.systemQuantity,
        reason: item.reason || '',
      };
    });
    setCountInputs(initial);
    setIsCountSheetOpen(true);
  };

  const handleSaveCounts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAudit) return;
    setSubmitting(true);
    setError(null);

    const countsPayload = Object.entries(countInputs).map(([productId, val]) => ({
      productId,
      physicalQuantity: Number(val.qty),
      reason: val.reason,
    }));

    try {
      await api.post(`/audits/${activeAudit.id}/counts`, {
        counts: countsPayload,
      });
      setIsCountSheetOpen(false);
      fetchAudits();
      const updated = await api.get<{ audit: StockAudit }>(`/audits/${activeAudit.id}`);
      setActiveAudit(updated.audit);
    } catch (err: any) {
      setError(err.message || 'Failed to save counts');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (action: string, id: string) => {
    if (!window.confirm(`Proceed with action: ${action.toUpperCase()}?`)) return;
    try {
      await api.post(`/audits/${id}/${action}`);
      fetchAudits();
      if (activeAudit) {
        const updated = await api.get<{ audit: StockAudit }>(`/audits/${id}`);
        setActiveAudit(updated.audit);
      }
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-emerald-600" />
            Stock Audit & Reconciliation
          </h1>
          <p className="text-sm text-slate-500">
            Periodic physical count verification, discrepancy detection, and approved balance reconciliation
          </p>
        </div>

        {canOperate && (
          <button
            onClick={() => {
              setError(null);
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Audit Session
          </button>
        )}
      </div>

      {/* Audits Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
              <tr>
                <th className="py-3 px-4">Audit #</th>
                <th className="py-3 px-4">Warehouse</th>
                <th className="py-3 px-4 text-center">Items Audited</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Conducted By</th>
                <th className="py-3 px-4">Approved By</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {audits.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-emerald-700 text-xs">{a.auditNumber}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{a.warehouse?.name}</td>
                  <td className="py-3 px-4 text-center font-mono">
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-xs text-slate-700">
                      {a.items?.length || 0} products
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600">
                    <div>{a.conductedBy?.name}</div>
                    <div className="text-[10px] text-slate-400">{new Date(a.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600">
                    {a.approvedBy ? a.approvedBy.name : <span className="text-slate-400 italic">Pending</span>}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setActiveAudit(a)}
                        title="View Details"
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {(a.status === 'DRAFT' || a.status === 'IN_PROGRESS') && canOperate && (
                        <>
                          <button
                            onClick={() => openCountSheet(a)}
                            className="px-2.5 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded text-xs font-semibold flex items-center gap-1 border border-sky-200"
                          >
                            <FileSpreadsheet className="w-3 h-3" />
                            Record Counts
                          </button>
                          <button
                            onClick={() => handleAction('submit', a.id)}
                            className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-xs font-semibold flex items-center gap-1 border border-indigo-200"
                          >
                            <Send className="w-3 h-3" />
                            Submit
                          </button>
                        </>
                      )}

                      {a.status === 'SUBMITTED' && canApprove && (
                        <>
                          <button
                            onClick={() => handleAction('approve', a.id)}
                            className="px-2.5 py-1 bg-emerald-600 text-white hover:bg-emerald-700 rounded text-xs font-semibold flex items-center gap-1 shadow-sm"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Approve Adjustments
                          </button>
                          <button
                            onClick={() => handleAction('reject', a.id)}
                            className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded text-xs font-medium"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {audits.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No stock audit sessions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Detail Modal */}
      <Modal isOpen={!!activeAudit && !isCountSheetOpen} onClose={() => setActiveAudit(null)} title={`Stock Audit ${activeAudit?.auditNumber}`} maxWidth="max-w-4xl">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs text-slate-500 mr-2">Status:</span>
              <StatusBadge status={activeAudit?.status || ''} />
            </div>
            <div className="text-xs text-slate-500">
              Warehouse: <span className="font-bold text-slate-800">{activeAudit?.warehouse?.name}</span>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3 text-right">System Snapshot</th>
                  <th className="py-2.5 px-3 text-right">Physical Count</th>
                  <th className="py-2.5 px-3 text-right">Discrepancy</th>
                  <th className="py-2.5 px-3">Variance Reason</th>
                  <th className="py-2.5 px-3 text-center">Adjusted?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeAudit?.items?.map((item) => {
                  const hasDiscrepancy = item.discrepancyQuantity !== 0;
                  return (
                    <tr key={item.id}>
                      <td className="py-2 px-3 font-mono font-bold text-sky-700">{item.product?.sku}</td>
                      <td className="py-2 px-3 font-medium text-slate-800">{item.product?.name}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600">{item.systemQuantity}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {item.physicalQuantity !== null ? item.physicalQuantity : <span className="text-slate-400 italic">Not counted</span>}
                      </td>
                      <td className={`py-2 px-3 text-right font-mono font-bold ${
                        item.discrepancyQuantity < 0 ? 'text-rose-600' : item.discrepancyQuantity > 0 ? 'text-emerald-600' : 'text-slate-400'
                      }`}>
                        {item.discrepancyQuantity > 0 ? `+${item.discrepancyQuantity}` : item.discrepancyQuantity}
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {item.reason || (hasDiscrepancy ? <span className="text-rose-500 font-semibold">Missing Reason</span> : '—')}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <StatusBadge status={item.isAdjusted ? 'YES' : 'NO'} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* Record Physical Counts Sheet Modal */}
      <Modal isOpen={isCountSheetOpen} onClose={() => setIsCountSheetOpen(false)} title={`Count Sheet - ${activeAudit?.auditNumber}`} maxWidth="max-w-4xl">
        <form onSubmit={handleSaveCounts} className="space-y-4">
          <p className="text-xs text-slate-500">
            Record physical inventory counts. If there is a discrepancy with the system snapshot, a valid variance reason is strictly required before submission.
          </p>

          {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs">{error}</div>}

          <div className="border border-slate-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0">
                <tr>
                  <th className="py-2 px-3">Product / SKU</th>
                  <th className="py-2 px-3 text-right">System Qty</th>
                  <th className="py-2 px-3 text-right">Physical Count</th>
                  <th className="py-2 px-3 text-right">Discrepancy</th>
                  <th className="py-2 px-3">Mandatory Reason for Discrepancy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeAudit?.items?.map((item) => {
                  const currentInput = countInputs[item.productId] || { qty: item.systemQuantity, reason: '' };
                  const discrepancy = currentInput.qty - item.systemQuantity;
                  const isDiscrepant = discrepancy !== 0;

                  return (
                    <tr key={item.id}>
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-800">{item.product?.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.product?.sku}</div>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600">{item.systemQuantity}</td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          value={currentInput.qty}
                          onChange={(e) => {
                            setCountInputs({
                              ...countInputs,
                              [item.productId]: {
                                ...currentInput,
                                qty: parseInt(e.target.value) || 0,
                              },
                            });
                          }}
                          className="w-20 px-2 py-1 border border-slate-200 rounded text-right font-mono text-xs"
                        />
                      </td>
                      <td className={`py-2 px-3 text-right font-mono font-bold ${
                        discrepancy < 0 ? 'text-rose-600' : discrepancy > 0 ? 'text-emerald-600' : 'text-slate-400'
                      }`}>
                        {discrepancy > 0 ? `+${discrepancy}` : discrepancy}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          placeholder={isDiscrepant ? 'Required: damaged, lost, miscount...' : 'Optional'}
                          value={currentInput.reason}
                          onChange={(e) => {
                            setCountInputs({
                              ...countInputs,
                              [item.productId]: {
                                ...currentInput,
                                reason: e.target.value,
                              },
                            });
                          }}
                          className={`w-full px-2 py-1 border rounded text-xs ${
                            isDiscrepant && !currentInput.reason.trim()
                              ? 'border-rose-300 bg-rose-50/50'
                              : 'border-slate-200'
                          }`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCountSheetOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Physical Counts'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Audit Session Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Initialize Stock Audit Session">
        <form onSubmit={handleCreateAudit} className="space-y-4">
          {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs">{error}</div>}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Audit Facility / Warehouse *</label>
            <select
              required
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Session Scope / Purpose</label>
            <textarea
              rows={2}
              placeholder="e.g. Q4 Cycle Count Audit, annual physical inventory verification..."
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
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Snapshot Inventory & Start Audit'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
