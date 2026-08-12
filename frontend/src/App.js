import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './utils/AuthContext';
import { syncOfflineQueue } from './utils/api';
import Layout from './components/Layout';
import { Spinner } from './components/UI';

// Lazy loaded page components
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Orders = lazy(() => import('./pages/Orders'));
const NewOrder = lazy(() => import('./pages/NewOrder'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const Customers = lazy(() => import('./pages/Customers'));
const Products = lazy(() => import('./pages/Products'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Payments = lazy(() => import('./pages/Payments'));
const Expenses = lazy(() => import('./pages/Expenses'));
const GSTReports = lazy(() => import('./pages/GSTReports'));
const Reports = lazy(() => import('./pages/Reports'));
const BulkOrders = lazy(() => import('./pages/BulkOrders'));
const Shipping = lazy(() => import('./pages/Shipping'));
const Settings = lazy(() => import('./pages/Settings'));
const Users = lazy(() => import('./pages/Users'));
const ChangeRequests = lazy(() => import('./pages/ChangeRequests'));
const QuickBill = lazy(() => import('./pages/QuickBill'));
const ImportExport = lazy(() => import('./pages/ImportExport'));
const DigitalInvoices = lazy(() => import('./pages/DigitalInvoices'));
const Quotations = lazy(() => import('./pages/Quotations'));
const Backup = lazy(() => import('./pages/Backup'));

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
};

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
    <Spinner />
  </div>
);

const AppInner = () => {
  const { user } = useAuth();

  useEffect(() => {
    const sync = async () => {
      if (navigator.onLine && user) {
        const synced = await syncOfflineQueue();
        if (synced > 0) console.log(`Synced ${synced} offline requests`);
      }
    };
    window.addEventListener('online', sync);
    sync();
    return () => window.removeEventListener('online', sync);
  }, [user]);

  // Bind Ctrl+B Keyboard Shortcut to open Quick Bill page
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        window.location.href = '/quickbill';
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="quickbill" element={<QuickBill />} />
            <Route path="import-export" element={<ImportExport />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/new" element={<NewOrder />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="customers" element={<Customers />} />
            <Route path="products" element={<Products />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="digital-invoices" element={<DigitalInvoices />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="payments" element={<Payments />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="gst" element={<GSTReports />} />
            <Route path="reports" element={<Reports />} />
            <Route path="bulk" element={<BulkOrders />} />
            <Route path="shipping" element={<Shipping />} />
            <Route path="settings" element={<Settings />} />
            <Route path="users" element={<Users />} />
            <Route path="changes" element={<ChangeRequests />} />
            <Route path="quotations" element={<Quotations />} />
            <Route path="backup" element={<Backup />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
