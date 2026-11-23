import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Download, BarChart3, AlertTriangle, FileSpreadsheet, DollarSign, Warehouse } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [valuationData, setValuationData] = useState<any>(null);
  const [lowStockData, setLowStockData] = useState<any>(null);
  const [warehouseReports, setWarehouseReports] = useState<any[]>([]);
  const [auditDiscrepancies, setAuditDiscrepancies] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'valuation' | 'low-stock' | 'warehouses' | 'audits'>('valuation');
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [vRes, lsRes, whRes, adRes] = await Promise.all([
        api.get<any>('/reports/valuation'),
        api.get<any>('/reports/low-stock'),
        api.get<any>('/reports/warehouse-stock'),
        api.get<any>('/reports/audit-discrepancies'),
      ]);
      setValuationData(vRes);
      setLowStockData(lsRes);
      setWarehouseReports(whRes.warehouses || []);
      setAuditDiscrepancies(adRes.discrepancies || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const downloadCSV = (endpoint: string) => {
    window.open(`/api/reports/${endpoint}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-sky-600" />
            Inventory Reports & Analytics
          </h1>
          <p className="text-sm text-slate-500">Live stock valuation, deficit analysis, warehouse distribution, and CSV data exports</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <button
          onClick={() => setActiveTab('valuation')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'valuation' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          Stock Valuation
        </button>

        <button
          onClick={() => setActiveTab('low-stock')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'low-stock' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Low Stock Deficit
        </button>

        <button
          onClick={() => setActiveTab('warehouses')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'warehouses' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Warehouse className="w-3.5 h-3.5" />
          Warehouse Distribution
        </button>

        <button
          onClick={() => setActiveTab('audits')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'audits' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Audit Discrepancies
        </button>
      </div>

      {/* 1. Valuation Report */}
      {activeTab === 'valuation' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              <div>
                <div className="text-xs text-slate-400 font-semibold uppercase">Total Valuation</div>
                <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                  ${valuationData?.summary?.totalValuation?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 font-semibold uppercase">Total Units</div>
                <div className="text-2xl font-bold text-sky-700 mt-1 font-mono">
                  {valuationData?.summary?.totalInventoryCount?.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 font-semibold uppercase">Products Monitored</div>
                <div className="text-2xl font-bold text-slate-800 mt-1 font-mono">
                  {valuationData?.summary?.uniqueProducts}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 font-semibold uppercase">Facilities</div>
                <div className="text-2xl font-bold text-slate-800 mt-1 font-mono">
                  {valuationData?.summary?.warehousesCovered}
                </div>
              </div>
            </div>

            <button
              onClick={() => downloadCSV('valuation/csv')}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Warehouse</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">In-Stock Qty</th>
                  <th className="py-3 px-4 text-right">Unit Cost ($)</th>
                  <th className="py-3 px-4 text-right">Total Value ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {valuationData?.data?.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono text-slate-600">{row.warehouseCode}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-sky-700">{row.sku}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">{row.productName}</td>
                    <td className="py-2.5 px-4 text-slate-500">{row.category}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-800">{row.quantity}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-600">${row.unitCost.toFixed(2)}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">${row.totalValue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Low Stock Report */}
      {activeTab === 'low-stock' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-xs text-slate-400 font-semibold uppercase">Items Below Threshold</div>
                <div className="text-2xl font-bold text-amber-600 mt-1 font-mono">
                  {lowStockData?.summary?.totalLowStockItems || 0}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 font-semibold uppercase">Critical Out of Stock</div>
                <div className="text-2xl font-bold text-rose-600 mt-1 font-mono">
                  {lowStockData?.summary?.outOfStockCount || 0}
                </div>
              </div>
            </div>

            <button
              onClick={() => downloadCSV('low-stock/csv')}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download Low Stock CSV
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Warehouse</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4 text-right">Current Stock</th>
                  <th className="py-3 px-4 text-right">Min Threshold</th>
                  <th className="py-3 px-4 text-right">Deficit</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lowStockData?.data?.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono text-slate-600">{row.warehouseCode}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-sky-700">{row.sku}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">{row.productName}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">{row.currentQuantity}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-500">{row.minThreshold}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600">-{row.deficit}</td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        row.status === 'OUT_OF_STOCK' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {row.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!lowStockData?.data || lowStockData.data.length === 0) && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      All inventory balances are currently healthy above minimum thresholds.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Warehouse Distribution */}
      {activeTab === 'warehouses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {warehouseReports.map((w: any) => (
            <div key={w.warehouseId} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {w.warehouseCode}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-2">{w.warehouseName}</h3>
                  <div className="text-xs text-slate-400">{w.city}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-slate-900 font-mono">{w.totalUnits.toLocaleString()}</div>
                  <div className="text-[11px] text-slate-400">Total Units</div>
                </div>
              </div>

              <div className="border border-slate-100 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0">
                    <tr>
                      <th className="py-1.5 px-2.5">Product</th>
                      <th className="py-1.5 px-2.5 text-right">In Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {w.items?.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td className="py-1.5 px-2.5 text-slate-700 truncate max-w-[140px]">{item.productName}</td>
                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900">{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. Audit Discrepancies */}
      {activeTab === 'audits' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-semibold uppercase">Total Discrepancies Detected</div>
              <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                {auditDiscrepancies.length}
              </div>
            </div>

            <button
              onClick={() => downloadCSV('audit-discrepancies/csv')}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download Discrepancies CSV
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Audit #</th>
                  <th className="py-3 px-4">Warehouse</th>
                  <th className="py-3 px-4">SKU / Product</th>
                  <th className="py-3 px-4 text-right">System Qty</th>
                  <th className="py-3 px-4 text-right">Physical Count</th>
                  <th className="py-3 px-4 text-right">Variance</th>
                  <th className="py-3 px-4">Variance Reason</th>
                  <th className="py-3 px-4">Adjusted?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditDiscrepancies.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono font-bold text-indigo-700">{row.auditNumber}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-600">{row.warehouseCode}</td>
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-800">{row.productName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{row.sku}</div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-600">{row.systemQuantity}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">{row.physicalQuantity}</td>
                    <td className={`py-2.5 px-4 text-right font-mono font-bold ${
                      row.discrepancyQuantity < 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}>
                      {row.discrepancyQuantity > 0 ? `+${row.discrepancyQuantity}` : row.discrepancyQuantity}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{row.reason}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-700">{row.isAdjusted}</td>
                  </tr>
                ))}
                {auditDiscrepancies.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No stock count discrepancies recorded in approved audit sessions.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
