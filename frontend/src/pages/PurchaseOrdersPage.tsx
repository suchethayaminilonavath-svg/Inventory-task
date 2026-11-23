import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { PurchaseOrder, Supplier, Warehouse, Product } from '../types.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Modal } from '../components/Modal.js';
import { useAuth } from '../context/AuthContext.js';
import {
  ShoppingCart,
  Plus,
  CheckCircle,
  PackagePlus,
  Eye,
  Send,
  XCircle,
} from 'lucide-react';

export const PurchaseOrdersPage: React.FC = () => {
  const { user } = useAuth();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activePO, setActivePO] = useState<PurchaseOrder | null>(null);
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);

  // Create PO Form
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [taxRate, setTaxRate] = useState(0.05);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<{ productId: string; quantity: number; unitPrice: number }[]>([
    { productId: '', quantity: 10, unitPrice: 15.0 },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Receiving state
  const [receiveInputs, setReceiveInputs] = useState<Record<string, number>>({});

  const canApprove = user?.role === 'ADMIN' || user?.role === 'WAREHOUSE_MANAGER';
  const canOperate = canApprove || user?.role === 'INVENTORY_OPERATOR';

  const fetchPOs = async () => {
    setLoading(true);
    try {
      const url = statusFilter ? `/purchase-orders?status=${statusFilter}` : '/purchase-orders';
      const res = await api.get<{ purchaseOrders: PurchaseOrder[] }>(url);
      setPurchaseOrders(res.purchaseOrders);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      const [sRes, wRes, pRes] = await Promise.all([
        api.get<{ suppliers: Supplier[] }>('/suppliers?status=ACTIVE'),
        api.get<{ warehouses: Warehouse[] }>('/warehouses'),
        api.get<{ products: Product[] }>('/products?limit=100'),
      ]);
      setSuppliers(sRes.suppliers);
      setWarehouses(wRes.warehouses);
      setProducts(pRes.products);
      if (sRes.suppliers[0]) setSupplierId(sRes.suppliers[0].id);
      if (wRes.warehouses[0]) setWarehouseId(wRes.warehouses[0].id);
      if (pRes.products[0]) setItems([{ productId: pRes.products[0].id, quantity: 10, unitPrice: 10 }]);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPOs();
  }, [statusFilter]);

  useEffect(() => {
    fetchDependencies();
  }, []);

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/purchase-orders', {
        supplierId,
        warehouseId,
        taxRate: Number(taxRate),
        notes,
        items,
      });
      setIsCreateOpen(false);
      fetchPOs();
    } catch (err: any) {
      setError(err.message || 'Failed to create PO');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (action: string, id: string) => {
    if (!window.confirm(`Confirm action: ${action.toUpperCase()}?`)) return;
    try {
      await api.post(`/purchase-orders/${id}/${action}`);
      fetchPOs();
      if (activePO) {
        const updated = await api.get<{ purchaseOrder: PurchaseOrder }>(`/purchase-orders/${id}`);
        setActivePO(updated.purchaseOrder);
      }
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  const openReceiveModal = (po: PurchaseOrder) => {
    setActivePO(po);
    const initial: Record<string, number> = {};
    po.items.forEach((item) => {
      const pending = Math.max(0, item.quantity - item.receivedQuantity);
      initial[item.productId] = pending;
    });
    setReceiveInputs(initial);
    setIsReceiveOpen(true);
  };

  const handleReceiveGoods = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePO) return;
    setSubmitting(true);
    setError(null);

    const receivingPayload = Object.entries(receiveInputs)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, quantityReceived]) => ({
        productId,
        quantityReceived: Number(quantityReceived),
      }));

    if (receivingPayload.length === 0) {
      setError('Please specify at least one quantity to receive');
      setSubmitting(false);
      return;
    }

    try {
      await api.post(`/purchase-orders/${activePO.id}/receive`, {
        items: receivingPayload,
      });
      setIsReceiveOpen(false);
      fetchPOs();
      const updated = await api.get<{ purchaseOrder: PurchaseOrder }>(`/purchase-orders/${activePO.id}`);
      setActivePO(updated.purchaseOrder);
    } catch (err: any) {
      setError(err.message || 'Failed to record receipt');
    } finally {
      setSubmitting(false);
    }
  };

  // Subtotal calculation
  const calculatedSubtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice || 0), 0);
  const calculatedTax = calculatedSubtotal * taxRate;
  const calculatedTotal = calculatedSubtotal + calculatedTax;

  const addItemRow = () => {
    setItems([...items, { productId: products[0]?.id || '', quantity: 10, unitPrice: 10 }]);
  };

  const removeItemRow = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-sky-600" />
            Purchase Orders
          </h1>
          <p className="text-sm text-slate-500">
            Vendor procurement workflow: Draft → Submitted → Approved → Partially Received → Received
          </p>
        </div>

        {canOperate && (
          <button
            onClick={() => {
              setError(null);
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Purchase Order
          </button>
        )}
      </div>

      {/* PO List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
              <tr>
                <th className="py-3 px-4">PO #</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Destination Warehouse</th>
                <th className="py-3 px-4 text-right">Subtotal</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchaseOrders.map((po) => (
                <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-sky-700 text-xs">{po.orderNumber}</td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800">{po.supplier?.name}</div>
                    <div className="text-xs text-slate-400 font-mono">{po.supplier?.code}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-700">{po.warehouse?.name}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-600">${po.subtotal.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">${po.total.toFixed(2)}</td>
                  <td className="py-3 px-4">
                    <StatusBadge status={po.status} />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setActivePO(po)}
                        title="View Details"
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {po.status === 'DRAFT' && canOperate && (
                        <button
                          onClick={() => handleAction('submit', po.id)}
                          className="px-2.5 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded text-xs font-semibold flex items-center gap-1 border border-sky-200"
                        >
                          <Send className="w-3 h-3" />
                          Submit
                        </button>
                      )}

                      {po.status === 'SUBMITTED' && canApprove && (
                        <>
                          <button
                            onClick={() => handleAction('approve', po.id)}
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-semibold flex items-center gap-1 border border-emerald-200"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleAction('reject', po.id)}
                            className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded text-xs font-medium"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {(po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED') && canOperate && (
                        <button
                          onClick={() => openReceiveModal(po)}
                          className="px-2.5 py-1 bg-emerald-600 text-white hover:bg-emerald-700 rounded text-xs font-semibold flex items-center gap-1 shadow-sm"
                        >
                          <PackagePlus className="w-3 h-3" />
                          Receive Goods
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {purchaseOrders.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No purchase orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PO Details Modal */}
      <Modal isOpen={!!activePO && !isReceiveOpen} onClose={() => setActivePO(null)} title={`Purchase Order ${activePO?.orderNumber}`}>
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs text-slate-500 mr-2">Status:</span>
              <StatusBadge status={activePO?.status || ''} />
            </div>
            <div className="text-xs text-slate-500">
              Created: <span className="font-mono text-slate-700">{activePO && new Date(activePO.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg text-xs">
            <div>
              <div className="text-slate-400 font-semibold uppercase">Supplier</div>
              <div className="font-bold text-slate-800 text-sm mt-0.5">{activePO?.supplier?.name}</div>
              <div className="text-slate-500">{activePO?.supplier?.contactName} | {activePO?.supplier?.email}</div>
            </div>
            <div>
              <div className="text-slate-400 font-semibold uppercase">Destination Warehouse</div>
              <div className="font-bold text-slate-800 text-sm mt-0.5">{activePO?.warehouse?.name}</div>
              <div className="text-slate-500">{activePO?.warehouse?.address}, {activePO?.warehouse?.city}</div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase text-slate-600 mb-2">Order Line Items</h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2 px-3">SKU</th>
                    <th className="py-2 px-3">Product Name</th>
                    <th className="py-2 px-3 text-right">Ordered</th>
                    <th className="py-2 px-3 text-right">Received</th>
                    <th className="py-2 px-3 text-right">Unit Price</th>
                    <th className="py-2 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activePO?.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2 px-3 font-mono font-bold text-sky-700">{item.product?.sku}</td>
                      <td className="py-2 px-3 font-medium text-slate-800">{item.product?.name}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{item.quantity}</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-600 font-semibold">{item.receivedQuantity}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600">${item.unitPrice.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">${item.subtotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="w-48 space-y-1 text-xs text-right">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span className="font-mono">${activePO?.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tax:</span>
                <span className="font-mono">${activePO?.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
                <span>Total:</span>
                <span className="font-mono text-sky-700">${activePO?.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Receive Goods Modal (Partial / Full) */}
      <Modal isOpen={isReceiveOpen} onClose={() => setIsReceiveOpen(false)} title={`Receive Goods - ${activePO?.orderNumber}`}>
        <form onSubmit={handleReceiveGoods} className="space-y-4">
          <p className="text-xs text-slate-500">
            Specify the incoming delivery quantity for each product. Inventory balances in warehouse <span className="font-bold text-slate-700">{activePO?.warehouse?.name}</span> will be updated immediately via the movement engine.
          </p>

          {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs">{error}</div>}

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2 px-3">Product</th>
                  <th className="py-2 px-3 text-right">Ordered</th>
                  <th className="py-2 px-3 text-right">Already Received</th>
                  <th className="py-2 px-3 text-right">Pending</th>
                  <th className="py-2 px-3 text-right">Receive Now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activePO?.items?.map((item) => {
                  const pending = Math.max(0, item.quantity - item.receivedQuantity);
                  return (
                    <tr key={item.id}>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">{item.product?.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.product?.sku}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">{item.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">{item.receivedQuantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700">{pending}</td>
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          max={pending}
                          value={receiveInputs[item.productId] ?? 0}
                          onChange={(e) => {
                            setReceiveInputs({
                              ...receiveInputs,
                              [item.productId]: parseInt(e.target.value) || 0,
                            });
                          }}
                          className="w-20 px-2 py-1 border border-slate-200 rounded text-right font-mono text-xs focus:ring-2 focus:ring-emerald-500"
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
              onClick={() => setIsReceiveOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? 'Recording Receipt...' : 'Confirm Receipt & Update Stock'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create PO Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Purchase Order" maxWidth="max-w-3xl">
        <form onSubmit={handleCreatePO} className="space-y-4">
          {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Supplier *</label>
              <select
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Receiving Warehouse *</label>
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
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700">Order Line Items</label>
              <button
                type="button"
                onClick={addItemRow}
                className="text-xs text-sky-600 font-semibold hover:underline"
              >
                + Add Item
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex-1">
                    <select
                      required
                      value={item.productId}
                      onChange={(e) => {
                        const copy = [...items];
                        copy[idx].productId = e.target.value;
                        setItems(copy);
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs bg-white"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => {
                        const copy = [...items];
                        copy[idx].quantity = parseInt(e.target.value) || 0;
                        setItems(copy);
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs text-right font-mono"
                    />
                  </div>

                  <div className="w-28">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="Unit Price $"
                      value={item.unitPrice}
                      onChange={(e) => {
                        const copy = [...items];
                        copy[idx].unitPrice = parseFloat(e.target.value) || 0;
                        setItems(copy);
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs text-right font-mono"
                    />
                  </div>

                  <div className="w-24 text-right text-xs font-mono font-bold text-slate-800">
                    ${(item.quantity * item.unitPrice).toFixed(2)}
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
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <div className="w-56 space-y-1 text-xs text-right">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold">${calculatedSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tax (5%):</span>
                <span className="font-mono font-semibold">${calculatedTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
                <span>Estimated Total:</span>
                <span className="font-mono text-sky-700">${calculatedTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
            <textarea
              rows={2}
              placeholder="Delivery terms, vendor reference..."
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
              className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Purchase Order Draft'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
