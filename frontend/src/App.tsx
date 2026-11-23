import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
import { Sidebar, NavTab } from './components/Sidebar.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ProductsPage } from './pages/ProductsPage.js';
import { WarehousesPage } from './pages/WarehousesPage.js';
import { TransfersPage } from './pages/TransfersPage.js';
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage.js';
import { SuppliersPage } from './pages/SuppliersPage.js';
import { StockAuditPage } from './pages/StockAuditPage.js';
import { MovementsPage } from './pages/MovementsPage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { RefreshCw } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} />
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto max-w-7xl">
          {currentTab === 'dashboard' && <DashboardPage onNavigate={setCurrentTab} />}
          {currentTab === 'products' && <ProductsPage />}
          {currentTab === 'warehouses' && <WarehousesPage />}
          {currentTab === 'transfers' && <TransfersPage />}
          {currentTab === 'suppliers' && <SuppliersPage />}
          {currentTab === 'purchase-orders' && <PurchaseOrdersPage />}
          {currentTab === 'audits' && <StockAuditPage />}
          {currentTab === 'movements' && <MovementsPage />}
          {currentTab === 'reports' && <ReportsPage />}
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
};

export default App;
