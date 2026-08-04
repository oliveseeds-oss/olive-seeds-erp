import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './utils/AuthContext';
import { syncOfflineQueue } from './utils/api';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import NewOrder from './pages/NewOrder';
import OrderDetail from './pages/OrderDetail';
import Customers from './pages/Customers';
import Products from './pages/Products';
import Invoices from './pages/Invoices';
import Inventory from './pages/Inventory';
import Suppliers from './pages/Suppliers';
import Payments from './pages/Payments';
import Expenses from './pages/Expenses';
import GSTReports from './pages/GSTReports';
import Reports from './pages/Reports';
import BulkOrders from './pages/BulkOrders';
import Shipping from './pages/Shipping';
import Settings from './pages/Settings';
import Users from './pages/Users';
import ChangeRequests from './pages/ChangeRequests';

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
};

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

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/new" element={<NewOrder />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="customers" element={<Customers />} />
          <Route path="products" element={<Products />} />
          <Route path="invoices" element={<Invoices />} />
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
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
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
