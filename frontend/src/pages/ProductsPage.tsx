import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Product, Category } from '../types.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { Modal } from '../components/Modal.js';
import { useAuth } from '../context/AuthContext.js';
import {
  Package,
  Plus,
  Search,
  Download,
  Upload,
  Archive,
  Edit2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export const ProductsPage: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states
  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formUom, setFormUom] = useState('units');
  const [formMinThreshold, setFormMinThreshold] = useState(10);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // CSV Import state
  const [csvText, setCsvText] = useState('');
  const [importResult, setImportResult] = useState<string | null>(null);

  const canManage = user?.role === 'ADMIN' || user?.role === 'WAREHOUSE_MANAGER';

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
      });
      if (search) params.append('search', search);
      if (selectedCategory) params.append('categoryId', selectedCategory);

      const res = await api.get<{ products: Product[]; pagination: { totalPages: number } }>(
        `/products?${params.toString()}`
      );
      setProducts(res.products);
      setTotalPages(res.pagination.totalPages);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get<{ categories: Category[] }>('/categories');
      setCategories(res.categories);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page, search, selectedCategory]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCreateModal = () => {
    setFormSku('');
    setFormName('');
    setFormDescription('');
    setFormCategoryId('');
    setFormUom('units');
    setFormMinThreshold(10);
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    try {
      await api.post('/products', {
        sku: formSku || undefined,
        name: formName,
        description: formDescription || undefined,
        categoryId: formCategoryId || null,
        uom: formUom,
        minStockThreshold: Number(formMinThreshold),
      });
      setIsCreateOpen(false);
      fetchProducts();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create product');
    } finally {
      setFormSubmitting(false);
    }
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormSku(p.sku);
    setFormName(p.name);
    setFormDescription(p.description || '');
    setFormCategoryId(p.categoryId || '');
    setFormUom(p.uom);
    setFormMinThreshold(p.minStockThreshold);
    setFormError(null);
    setIsEditOpen(true);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setFormSubmitting(true);
    setFormError(null);
    try {
      await api.put(`/products/${editingProduct.id}`, {
        sku: formSku,
        name: formName,
        description: formDescription,
        categoryId: formCategoryId || null,
        uom: formUom,
        minStockThreshold: Number(formMinThreshold),
      });
      setIsEditOpen(false);
      fetchProducts();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update product');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleArchive = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to archive product '${name}'?`)) return;
    try {
      await api.delete(`/products/${id}`);
      fetchProducts();
    } catch (err: any) {
      alert(err.message || 'Failed to archive');
    }
  };

  const handleExportCSV = () => {
    window.open('/api/products/export/csv', '_blank');
  };

  const handleImportCSV = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    setImportResult(null);
    try {
      const res = await api.post<{ message: string; imported: number; skipped: number; errors: string[] }>(
        '/products/import/csv',
        { csv: csvText }
      );
      setImportResult(`Successfully imported ${res.imported} products. Skipped ${res.skipped}.`);
      fetchProducts();
    } catch (err: any) {
      setFormError(err.message || 'Failed to import CSV');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-sky-600" />
            Product Management
          </h1>
          <p className="text-sm text-slate-500">Catalog items, SKU validation, thresholds, and CSV synchronization</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm"
          >
            <Download className="w-4 h-4 text-slate-400" />
            Export CSV
          </button>

          {canManage && (
            <>
              <button
                onClick={() => {
                  setCsvText('');
                  setFormError(null);
                  setImportResult(null);
                  setIsImportOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm"
              >
                <Upload className="w-4 h-4 text-slate-400" />
                Import CSV
              </button>

              <button
                onClick={openCreateModal}
                className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Product
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by product name, SKU, or description..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => {
            setSelectedCategory(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
              <tr>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">UOM</th>
                <th className="py-3 px-4 text-right">Min Threshold</th>
                <th className="py-3 px-4 text-right">Total Stock</th>
                <th className="py-3 px-4">Status</th>
                {canManage && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => {
                let status = 'IN_STOCK';
                if (p.isOutOfStock) status = 'OUT_OF_STOCK';
                else if (p.isLowStock) status = 'LOW_STOCK';

                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-sky-700 text-xs">{p.sku}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{p.name}</div>
                      {p.description && <div className="text-xs text-slate-400 line-clamp-1">{p.description}</div>}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{p.category?.name || '—'}</td>
                    <td className="py-3 px-4 text-slate-600 text-xs font-mono">{p.uom}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">{p.minStockThreshold}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{p.totalStock ?? 0}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={status} />
                    </td>
                    {canManage && (
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(p)}
                            title="Edit"
                            className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleArchive(p.id, p.name)}
                            title="Archive"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {products.length === 0 && !loading && (
                <tr>
                  <td colSpan={canManage ? 8 : 7} className="py-12 text-center text-slate-400">
                    No products matching search criteria.
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

      {/* Create Product Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New Product">
        <form onSubmit={handleCreateProduct} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs">{formError}</div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">SKU Code (Unique)</label>
              <span className="text-[11px] text-slate-400">Leave blank to auto-generate</span>
            </div>
            <input
              type="text"
              placeholder="e.g. ELEC-MCU-32"
              value={formSku}
              onChange={(e) => setFormSku(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. ARM Cortex-M4 Microcontroller"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Unit of Measurement (UOM)</label>
              <input
                type="text"
                placeholder="units, pcs, box, kg..."
                value={formUom}
                onChange={(e) => setFormUom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Minimum Stock Alert Threshold</label>
            <input
              type="number"
              min="0"
              value={formMinThreshold}
              onChange={(e) => setFormMinThreshold(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Technical specifications, packaging info..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
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
              disabled={formSubmitting}
              className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
            >
              {formSubmitting ? 'Creating...' : 'Create Product'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Product Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Product">
        <form onSubmit={handleUpdateProduct} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs">{formError}</div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">SKU Code (Unique)</label>
            <input
              type="text"
              required
              value={formSku}
              onChange={(e) => setFormSku(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name</label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">UOM</label>
              <input
                type="text"
                value={formUom}
                onChange={(e) => setFormUom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Minimum Stock Threshold</label>
            <input
              type="number"
              min="0"
              value={formMinThreshold}
              onChange={(e) => setFormMinThreshold(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
            >
              {formSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CSV Import Modal */}
      <Modal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} title="Import Products from CSV">
        <form onSubmit={handleImportCSV} className="space-y-4">
          <p className="text-xs text-slate-500">
            Paste CSV text with headers: <code className="bg-slate-100 px-1 py-0.5 rounded">SKU,Product Name,Category,UOM,Min Stock Threshold,Description</code>.
            Duplicate SKUs will be safely skipped.
          </p>

          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs">{formError}</div>
          )}
          {importResult && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-xs">{importResult}</div>
          )}

          <textarea
            rows={8}
            required
            placeholder={`"SKU","Product Name","Category","UOM","Min Stock Threshold","Description"\n"IMP-001","Sample Bolt M6","Industrial Hardware","pcs","50","Stainless steel hex bolt"`}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsImportOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
            >
              {formSubmitting ? 'Importing...' : 'Run Import'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
