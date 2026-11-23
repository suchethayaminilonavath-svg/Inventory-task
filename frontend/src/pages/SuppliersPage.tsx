import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Supplier, Product } from '../types.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Modal } from '../components/Modal.js';
import { useAuth } from '../context/AuthContext.js';
import {
  Truck,
  Plus,
  Link,
  History,
  Phone,
  Mail,
  MapPin,
  Search,
} from 'lucide-react';

export const SuppliersPage: React.FC = () => {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAssociateOpen, setIsAssociateOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Association Form
  const [assocProductId, setAssocProductId] = useState('');
  const [assocCostPrice, setAssocCostPrice] = useState(10.0);
  const [assocLeadTime, setAssocLeadTime] = useState(7);
  const [assocSku, setAssocSku] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canManage = user?.role === 'ADMIN' || user?.role === 'WAREHOUSE_MANAGER';

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const url = search ? `/suppliers?search=${encodeURIComponent(search)}` : '/suppliers';
      const res = await api.get<{ suppliers: Supplier[] }>(url);
      setSuppliers(res.suppliers);
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
      if (res.products[0]) setAssocProductId(res.products[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [search]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/suppliers', {
        name,
        code,
        contactName,
        email: email || undefined,
        phone,
        address,
        status: 'ACTIVE',
      });
      setIsCreateOpen(false);
      fetchSuppliers();
    } catch (err: any) {
      setError(err.message || 'Failed to create supplier');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssociateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || !assocProductId) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/suppliers/${selectedSupplier.id}/products`, {
        productId: assocProductId,
        costPrice: Number(assocCostPrice),
        leadTimeDays: Number(assocLeadTime),
        supplierSku: assocSku || undefined,
      });
      setIsAssociateOpen(false);
      fetchSuppliers();
    } catch (err: any) {
      setError(err.message || 'Failed to associate product');
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
            <Truck className="w-6 h-6 text-sky-600" />
            Supplier Directory
          </h1>
          <p className="text-sm text-slate-500">Vendors, contact information, item costs, and purchase history</p>
        </div>

        {canManage && (
          <button
            onClick={() => {
              setName('');
              setCode('');
              setContactName('');
              setEmail('');
              setPhone('');
              setAddress('');
              setError(null);
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Register Supplier
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search suppliers by name, code, contact or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {suppliers.map((s) => (
          <div
            key={s.id}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-sky-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                    {s.code}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-2">{s.name}</h3>
                </div>
                <StatusBadge status={s.status} />
              </div>

              <div className="mt-4 space-y-2 text-xs text-slate-600">
                {s.contactName && (
                  <div className="font-medium text-slate-700">Contact: {s.contactName}</div>
                )}
                {s.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{s.email}</span>
                  </div>
                )}
                {s.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{s.phone}</span>
                  </div>
                )}
                {s.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{s.address}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="text-xs font-mono">
                <span className="text-slate-400">Products: </span>
                <span className="font-bold text-slate-800">{s._count?.supplierProducts ?? 0}</span>
              </div>

              {canManage && (
                <button
                  onClick={() => {
                    setSelectedSupplier(s);
                    setAssocCostPrice(10.0);
                    setAssocLeadTime(7);
                    setAssocSku('');
                    setError(null);
                    setIsAssociateOpen(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Link className="w-3.5 h-3.5 text-slate-400" />
                  Map Product
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Associate Product Modal */}
      <Modal
        isOpen={isAssociateOpen}
        onClose={() => setIsAssociateOpen(false)}
        title={`Associate Product with ${selectedSupplier?.name}`}
      >
        <form onSubmit={handleAssociateProduct} className="space-y-4">
          {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs">{error}</div>}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Catalog Product *</label>
            <select
              required
              value={assocProductId}
              onChange={(e) => setAssocProductId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Cost Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={assocCostPrice}
                onChange={(e) => setAssocCostPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Lead Time (Days)</label>
              <input
                type="number"
                min="1"
                required
                value={assocLeadTime}
                onChange={(e) => setAssocLeadTime(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Part / SKU #</label>
            <input
              type="text"
              placeholder="e.g. VEND-SKU-990"
              value={assocSku}
              onChange={(e) => setAssocSku(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAssociateOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Product Mapping'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Register Supplier Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Register New Supplier">
        <form onSubmit={handleCreateSupplier} className="space-y-4">
          {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. SUP-GLOBAL"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Global Tech Solutions"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
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
              className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
            >
              {submitting ? 'Registering...' : 'Register Supplier'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
