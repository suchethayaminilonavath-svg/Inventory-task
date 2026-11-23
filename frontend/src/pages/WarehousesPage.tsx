import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Warehouse, Product, WarehouseInventory } from '../types.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Modal } from '../components/Modal.js';
import { useAuth } from '../context/AuthContext.js';
import {
  Warehouse as WarehouseIcon,
  Plus,
  MapPin,
  Mail,
  Phone,
  Boxes,
  Eye,
  ArrowDownToLine,
} from 'lucide-react';

export const WarehousesPage: React.FC = () => {
  const { user } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [warehouseStock, setWarehouseStock] = useState<WarehouseInventory[]>([]);
  const [stockLoading, setStockLoading] = useState(false);

  // Stock Intake Modal
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [intakeProductId, setIntakeProductId] = useState('');
  const [intakeQty, setIntakeQty] = useState(50);
  const [intakeReason, setIntakeReason] = useState('Stock intake');

  // Form states
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canManage = user?.role === 'ADMIN' || user?.role === 'WAREHOUSE_MANAGER';
  const canIntake = canManage || user?.role === 'INVENTORY_OPERATOR';

  const fetchWarehouses = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ warehouses: Warehouse[] }>('/warehouses');
      setWarehouses(res.warehouses);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get<{ products: Product[] }>('/products?limit=100');
      setProducts(res.products);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchWarehouses();
    fetchProducts();
  }, []);

  const openStockViewer = async (w: Warehouse) => {
    setSelectedWarehouse(w);
    setStockLoading(true);
    try {
      const res = await api.get<{ inventories: WarehouseInventory[] }>(`/warehouses/${w.id}/inventory`);
      setWarehouseStock(res.inventories);
    } catch (err) {
      console.error(err);
    } finally {
      setStockLoading(false);
    }
  };

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/warehouses', {
        code,
        name,
        address,
        city,
        state,
        postalCode,
        contactName,
        contactEmail: contactEmail || undefined,
        contactPhone,
      });
      setIsCreateOpen(false);
      fetchWarehouses();
    } catch (err: any) {
      setError(err.message || 'Failed to create warehouse');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStockIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse || !intakeProductId) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/warehouses/${selectedWarehouse.id}/inventory/initialize`, {
        productId: intakeProductId,
        quantity: Number(intakeQty),
        reason: intakeReason,
      });
      setIsIntakeOpen(false);
      openStockViewer(selectedWarehouse);
      fetchWarehouses();
    } catch (err: any) {
      setError(err.message || 'Failed to add stock');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <WarehouseIcon className="w-6 h-6 text-indigo-600" />
            Warehouse Management
          </h1>
          <p className="text-sm text-slate-500">Distribution facilities, regional hubs, and location-specific inventory</p>
        </div>

        {canManage && (
          <button
            onClick={() => {
              setCode('');
              setName('');
              setAddress('');
              setCity('');
              setState('');
              setPostalCode('');
              setContactName('');
              setContactEmail('');
              setContactPhone('');
              setError(null);
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Warehouse
          </button>
        )}
      </div>

      {/* Warehouse Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {warehouses.map((w) => (
          <div
            key={w.id}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-indigo-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {w.code}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-2">{w.name}</h3>
                </div>
                <StatusBadge status={w.isActive ? 'ACTIVE' : 'INACTIVE'} />
              </div>

              <div className="mt-4 space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span>{w.address}, {w.city}{w.state ? `, ${w.state}` : ''}</span>
                </div>
                {w.contactEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{w.contactEmail}</span>
                  </div>
                )}
                {w.contactPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span>{w.contactPhone}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs font-mono">
                <div>
                  <div className="text-slate-400">SKUs</div>
                  <div className="font-bold text-slate-800">{w.skuCount ?? 0}</div>
                </div>
                <div>
                  <div className="text-slate-400">Total Units</div>
                  <div className="font-bold text-indigo-700">{w.totalUnits?.toLocaleString() ?? 0}</div>
                </div>
              </div>

              <button
                onClick={() => openStockViewer(w)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                View Stock
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Warehouse Stock Viewer Modal */}
      <Modal
        isOpen={!!selectedWarehouse}
        onClose={() => setSelectedWarehouse(null)}
        title={`${selectedWarehouse?.name} (${selectedWarehouse?.code}) Stock`}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="text-xs text-slate-500">
              Address: <span className="font-medium text-slate-700">{selectedWarehouse?.address}, {selectedWarehouse?.city}</span>
            </div>

            {canIntake && (
              <button
                onClick={() => {
                  setIntakeProductId(products[0]?.id || '');
                  setIntakeQty(50);
                  setIntakeReason('Warehouse stock intake');
                  setError(null);
                  setIsIntakeOpen(true);
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                Intake Stock
              </button>
            )}
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Min Threshold</th>
                  <th className="py-2.5 px-3 text-right">In-Stock Qty</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {warehouseStock.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono font-bold text-sky-700">{inv.product?.sku}</td>
                    <td className="py-2 px-3 font-medium text-slate-800">{inv.product?.name}</td>
                    <td className="py-2 px-3 text-slate-500">{inv.product?.category?.name || '—'}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-500">{inv.minThreshold}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{inv.quantity}</td>
                    <td className="py-2 px-3">
                      <StatusBadge status={inv.isOutOfStock ? 'OUT_OF_STOCK' : inv.isLowStock ? 'LOW_STOCK' : 'IN_STOCK'} />
                    </td>
                  </tr>
                ))}
                {warehouseStock.length === 0 && !stockLoading && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No inventory records found in this warehouse yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* Stock Intake Modal */}
      <Modal isOpen={isIntakeOpen} onClose={() => setIsIntakeOpen(false)} title="Warehouse Stock Intake">
        <form onSubmit={handleStockIntake} className="space-y-4">
          {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs">{error}</div>}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Product *</label>
            <select
              required
              value={intakeProductId}
              onChange={(e) => setIntakeProductId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              <option value="">Select a product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} - {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Intake Quantity *</label>
            <input
              type="number"
              min="1"
              required
              value={intakeQty}
              onChange={(e) => setIntakeQty(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Movement Note</label>
            <input
              type="text"
              required
              value={intakeReason}
              onChange={(e) => setIntakeReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsIntakeOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Recording...' : 'Record Intake'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Warehouse Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Warehouse">
        <form onSubmit={handleCreateWarehouse} className="space-y-4">
          {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Warehouse Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. WH-SOUTH"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Warehouse Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Austin Regional Depot"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address *</label>
            <input
              type="text"
              required
              placeholder="700 Logistics Way"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">City *</label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
              <input
                type="text"
                placeholder="TX"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Postal Code</label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Name</label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
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
              {submitting ? 'Creating...' : 'Create Warehouse'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
