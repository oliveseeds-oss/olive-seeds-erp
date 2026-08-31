import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../utils/AuthContext';
import { Card, Btn, Input, Select, Textarea, showToast, Modal, Grid, fmt, fmtDate, TableSkeleton } from '../components/UI';
import ConfirmDelete from '../components/ConfirmDelete';
import { buildBillHTML, downloadPDFBlob, fetchLogoBase64, fetchSignatureBase64 } from '../utils/printUtils';
import PrintOptions from '../components/PrintOptions';

export default function QuickBill() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Toggle mode state: 'physical' or 'digital'
  const [mode, setMode] = useState('physical');
  const [activeTab, setActiveTab] = useState(() => user?.role === 'viewer' ? 'history' : 'new'); // 'new' or 'history'
  const [editId, setEditId] = useState(null);

  const [companySettings, setCompanySettings] = useState({});
  const [userSignaturePath, setUserSignaturePath] = useState(null);

  // Fetch company settings and user profile details on mount
  useEffect(() => {
    api.get('/settings')
      .then(res => setCompanySettings(res.data || {}))
      .catch(() => {});
    api.get('/users')
      .then(res => {
        const me = res.data.find(u => u.id === user?.id);
        if (me) setUserSignaturePath(me.signature_path);
      })
      .catch(() => {});
  }, [user]);

  // General products list from backend for dropdown select
  const [products, setProducts] = useState([]);
  useEffect(() => {
    api.get('/products')
      .then(res => setProducts(Array.isArray(res.data) ? res.data : (res.data.products || [])))
      .catch(() => {});
    api.get('/settings')
      .then(res => setCompanySettings(res.data || {}))
      .catch(() => {});
  }, []);

  // ----------------- STATE: MODE 1 (PHYSICAL) -----------------
  const [physForm, setPhysForm] = useState({
    bill_number: '',
    bill_type: 'cash_memo',
    bill_date: new Date().toISOString().split('T')[0],
    bill_time: new Date().toLocaleTimeString('en-US', { hour12: false }).slice(0, 5),
    customer_name: '',
    customer_phone: '',
    customer_gstin: '',
    customer_company: '',
    items: [],
    include_gst: false,
    gst_percent: 18,
    amount_received: 0,
    payment_mode: 'cash',
    upi_reference: '',
    card_last4: '',
    terminal_id: '',
    bank_utr: '',
    bank_name: '',
    internal_notes: ''
  });

  const [physNumberLocked, setPhysNumberLocked] = useState(true);
  const [physSearchQuery, setPhysSearchQuery] = useState('');
  const [physSearchResults, setPhysSearchResults] = useState([]);

  // Auto-generate Bill number for Physical on mount or type change
  const fetchNextPhysNumber = async (type) => {
    try {
      const prefix = type === 'gst_invoice' ? 'PH-2025-' : 'CM-2025-';
      const res = await api.get('/quick-bill/physical');
      const count = (res.data.total !== undefined ? res.data.total : (res.data.bills?.length || 0)) + 1;
      setPhysForm(f => ({ ...f, bill_number: `${prefix}${String(count).padStart(5, '0')}` }));
    } catch (e) {}
  };

  useEffect(() => {
    if (mode === 'physical' && activeTab === 'new') {
      fetchNextPhysNumber(physForm.bill_type);
    }
  }, [mode, physForm.bill_type, activeTab]);

  // Search product handlers
  useEffect(() => {
    if (physSearchQuery.trim().length > 1) {
      const q = physSearchQuery.toLowerCase();
      const filtered = products.filter(p => 
        p.name?.toLowerCase().includes(q) || 
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q)
      );
      setPhysSearchResults(filtered);
    } else {
      setPhysSearchResults([]);
    }
  }, [physSearchQuery, products]);

  const addPhysProduct = (p) => {
    const existing = physForm.items.findIndex(item => item.product_id === p.id);
    if (existing >= 0) {
      const items = [...physForm.items];
      items[existing].quantity += 1;
      items[existing].amount = (items[existing].quantity * items[existing].unit_price) * (1 - items[existing].discount_percent / 100);
      setPhysForm({ ...physForm, items });
    } else {
      setPhysForm({
        ...physForm,
        items: [
          ...physForm.items,
          {
            product_id: p.id,
            product_name: p.name,
            description: p.description || '',
            quantity: 1,
            unit_price: p.selling_price || p.price || 0,
            discount_percent: 0,
            amount: p.selling_price || p.price || 0
          }
        ]
      });
    }
    setPhysSearchQuery('');
    setPhysSearchResults([]);
  };

  const addPhysItemManually = () => {
    setPhysForm({
      ...physForm,
      items: [
        ...physForm.items,
        {
          product_id: null,
          product_name: '',
          description: '',
          quantity: 1,
          unit_price: 0,
          discount_percent: 0,
          amount: 0
        }
      ]
    });
  };

  const updatePhysItem = (idx, key, val) => {
    const items = [...physForm.items];
    items[idx][key] = val;
    const qty = parseFloat(items[idx].quantity) || 0;
    const rate = parseFloat(items[idx].unit_price) || 0;
    const disc = parseFloat(items[idx].discount_percent) || 0;
    items[idx].amount = (qty * rate) * (1 - disc / 100);
    setPhysForm({ ...physForm, items });
  };

  const removePhysItem = (idx) => {
    setPhysForm({ ...physForm, items: physForm.items.filter((_, i) => i !== idx) });
  };

  // Calculations for Physical Form
  const calcPhysTotals = () => {
    const subtotal = physForm.items.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const gstAmount = physForm.include_gst ? (subtotal * (parseFloat(physForm.gst_percent) || 18) / 100) : 0;
    const total = subtotal + gstAmount;
    const amountReceived = parseFloat(physForm.amount_received) || 0;
    const change = amountReceived > total ? amountReceived - total : 0;
    const balance = total > amountReceived ? total - amountReceived : 0;
    return { subtotal, gstAmount, total, change, balance };
  };

  const physTotals = calcPhysTotals();

  // ----------------- STATE: MODE 2 (DIGITAL) -----------------
  const [digForm, setDigForm] = useState({
    bill_number: '',
    bill_type: 'simple_receipt',
    bill_date: new Date().toISOString().split('T')[0],
    bill_time: new Date().toLocaleTimeString('en-US', { hour12: false }).slice(0, 5),
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_gstin: '',
    customer_company: '',
    has_digital_files: true,
    download_link: '',
    link_password: '',
    link_valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    items: [],
    include_gst: false,
    gst_percent: 18,
    amount_received: 0,
    payment_mode: 'upi',
    upi_reference: '',
    card_last4: '',
    terminal_id: '',
    bank_utr: '',
    bank_name: '',
    internal_notes: ''
  });

  const [digNumberLocked, setDigNumberLocked] = useState(true);

  // Auto-generate Bill number for Digital
  const fetchNextDigNumber = async (type) => {
    try {
      const prefix = type === 'gst_invoice' ? 'DG-2025-' : 'DB-2025-';
      const res = await api.get('/quick-bill/digital');
      const count = (res.data.total !== undefined ? res.data.total : (res.data.bills?.length || 0)) + 1;
      setDigForm(f => ({ ...f, bill_number: `${prefix}${String(count).padStart(5, '0')}` }));
    } catch (e) {}
  };

  useEffect(() => {
    if (mode === 'digital' && activeTab === 'new') {
      fetchNextDigNumber(digForm.bill_type);
    }
  }, [mode, digForm.bill_type, activeTab]);

  const addDigItem = () => {
    setDigForm({
      ...digForm,
      items: [
        ...digForm.items,
        {
          item_type: 'Digital File',
          product_name: '',
          description: '',
          file_format: 'ZIP',
          license_type: 'Commercial Use',
          quantity: 1,
          unit_price: 0,
          discount_percent: 0,
          amount: 0
        }
      ]
    });
  };

  const updateDigItem = (idx, key, val) => {
    const items = [...digForm.items];
    items[idx][key] = val;
    const qty = parseFloat(items[idx].quantity) || 0;
    const rate = parseFloat(items[idx].unit_price) || 0;
    const disc = parseFloat(items[idx].discount_percent) || 0;
    items[idx].amount = (qty * rate) * (1 - disc / 100);
    setDigForm({ ...digForm, items });
  };

  const removeDigItem = (idx) => {
    setDigForm({ ...digForm, items: digForm.items.filter((_, i) => i !== idx) });
  };

  // Calculations for Digital Form
  const calcDigTotals = () => {
    const subtotal = digForm.items.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const gstAmount = digForm.include_gst ? (subtotal * (parseFloat(digForm.gst_percent) || 18) / 100) : 0;
    const total = subtotal + gstAmount;
    const amountReceived = parseFloat(digForm.amount_received) || 0;
    const change = amountReceived > total ? amountReceived - total : 0;
    const balance = total > amountReceived ? total - amountReceived : 0;
    return { subtotal, gstAmount, total, change, balance };
  };

  const digTotals = calcDigTotals();

  // Mode Switch Confirm
  const handleModeChange = (newMode) => {
    if (newMode === mode) return;
    if (window.confirm('Switch mode? Current entries will be cleared.')) {
      setMode(newMode);
      setPhysForm(prev => ({ ...prev, items: [], customer_name: '', customer_phone: '' }));
      setDigForm(prev => ({ ...prev, items: [], customer_name: '', customer_email: '' }));
    }
  };

  // Save / Print / PDF Action Trigger
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [activePrintBill, setActivePrintBill] = useState(null);
  const [lastSavedBill, setLastSavedBill] = useState(null);

  const handlePrint = async (billData) => {
    try {
      console.log('Fetching logo and signature for bill...');
      await Promise.all([
        fetchLogoBase64(api),
        fetchSignatureBase64(api, billData.created_by || user?.id)
      ]);
    } catch (err) {
      console.error('Error pre-fetching assets:', err);
    }

    if (!billData.items || billData.items.length === 0) {
      try {
        const res = await api.get(`/quick-bill/${mode}/${billData.id}`);
        setActivePrintBill(res.data);
      } catch (err) {
        showToast('Failed to fetch full bill details for printing', 'error');
        setActivePrintBill(billData);
      }
    } else {
      setActivePrintBill(billData);
    }
    setShowPrintOptions(true);
  };

  const handleDownloadPDF = async (billData) => {
    setDownloading(true);
    try {
      await downloadPDFBlob(api, `/quick-bill/${mode}/${billData.id}/pdf`, `Bill-${billData.bill_number}.pdf`);
      showToast('PDF downloaded', 'success');
    } catch (err) {
      showToast('PDF download failed: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleWhatsApp = (billData) => {
    const customerPhone = billData.customer_phone;
    if (!customerPhone) {
      showToast('No customer phone number entered', 'error');
      return;
    }
    const phone = customerPhone.replace(/[^0-9]/g, '');
    const phoneWithCode = phone.startsWith('91') ? phone : '91' + phone;
    const message = encodeURIComponent(
      `Dear ${billData.customer_name || 'Customer'},\n\n` +
      `Your bill from ${companySettings.company_name || 'Olive Seeds'}:\n` +
      `Bill No: ${billData.bill_number}\n` +
      `Date: ${billData.bill_date || new Date().toISOString().slice(0, 10)}\n` +
      `Total: ₹${billData.total}\n` +
      `Payment: ${billData.payment_mode.toUpperCase()}\n\n` +
      `Thank you for your purchase!\n` +
      `${companySettings.phone || ''}`
    );
    const url = `https://wa.me/${phoneWithCode}?text=${message}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handlePrintClick = async () => {
    if (lastSavedBill) {
      handlePrint(lastSavedBill);
    } else {
      const saved = await saveBill();
      if (saved) handlePrint(saved);
    }
  };

  const handleDownloadPDFClick = async () => {
    if (lastSavedBill) {
      handleDownloadPDF(lastSavedBill);
    } else {
      const saved = await saveBill();
      if (saved) handleDownloadPDF(saved);
    }
  };

  const handleWhatsAppClick = async () => {
    if (lastSavedBill) {
      handleWhatsApp(lastSavedBill);
    } else {
      const saved = await saveBill();
      if (saved) handleWhatsApp(saved);
    }
  };

  const saveBill = async (printSize = null, download = false) => {
    if (mode === 'physical') {
      if (physForm.items.length === 0) {
        showToast('Please add at least one product item', 'error');
        return;
      }
      setSaving(true);
      try {
        const payload = {
          ...physForm,
          subtotal: physTotals.subtotal,
          gst_percent: physForm.include_gst ? physForm.gst_percent : 0,
          gst_amount: physTotals.gstAmount,
          total: physTotals.total,
          amount_received: physForm.amount_received,
          change_amount: physTotals.change,
          balance_due: physTotals.balance
        };
        const res = editId 
          ? await api.put(`/quick-bill/physical/${editId}`, payload)
          : await api.post('/quick-bill/physical', payload);
        const savedBill = { ...payload, id: res.data.id || editId, bill_number: res.data.bill_number || payload.bill_number, bill_date: payload.bill_date || new Date().toISOString().slice(0, 10) };
        setLastSavedBill(savedBill);
        showToast(editId ? `Bill updated successfully` : `Bill ${savedBill.bill_number} saved`, 'success');
        setEditId(null);
        fetchHistory();

        if (printSize) {
          handlePrint(savedBill);
        } else if (download) {
          handleDownloadPDF(savedBill);
        }
        return savedBill;
      } catch (err) {
        showToast(err.response?.data?.error || 'Failed to save physical bill', 'error');
        return null;
      } finally {
        setSaving(false);
      }
    } else {
      // Digital mode save
      if (digForm.items.length === 0) {
        showToast('Please add at least one product item', 'error');
        return null;
      }
      if (!digForm.customer_name.trim() || !digForm.customer_email.trim()) {
        showToast('Name and Email are required for digital bills', 'error');
        return null;
      }
      setSaving(true);
      try {
        const payload = {
          ...digForm,
          subtotal: digTotals.subtotal,
          gst_percent: digForm.include_gst ? digForm.gst_percent : 0,
          gst_amount: digTotals.gstAmount,
          total: digTotals.total,
          amount_received: digForm.amount_received,
          change_amount: digTotals.change,
          balance_due: digTotals.balance
        };
        const res = editId 
          ? await api.put(`/quick-bill/digital/${editId}`, payload)
          : await api.post('/quick-bill/digital', payload);
        const savedBill = { ...payload, id: res.data.id || editId, bill_number: res.data.bill_number || payload.bill_number, bill_date: payload.bill_date || new Date().toISOString().slice(0, 10) };
        setLastSavedBill(savedBill);
        showToast(editId ? `Bill updated successfully` : `Bill ${savedBill.bill_number} saved`, 'success');
        setEditId(null);
        fetchHistory();

        if (download) {
          handleDownloadPDF(savedBill);
        }
        return savedBill;
      } catch (err) {
        showToast(err.response?.data?.error || 'Failed to save digital bill', 'error');
        return null;
      } finally {
        setSaving(false);
      }
    }
  };

  // Reset form helper
  const handleResetForm = () => {
    setEditId(null);
    setLastSavedBill(null);
    if (mode === 'physical') {
      setPhysForm(prev => ({
        ...prev,
        customer_name: '',
        customer_phone: '',
        customer_gstin: '',
        customer_company: '',
        items: [],
        amount_received: 0,
        upi_reference: '',
        card_last4: '',
        terminal_id: '',
        bank_utr: '',
        bank_name: '',
        internal_notes: ''
      }));
      fetchNextPhysNumber(physForm.bill_type);
    } else {
      setDigForm(prev => ({
        ...prev,
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        customer_gstin: '',
        customer_company: '',
        items: [],
        download_link: '',
        link_password: '',
        amount_received: 0,
        upi_reference: '',
        card_last4: '',
        terminal_id: '',
        bank_utr: '',
        bank_name: '',
        internal_notes: ''
      }));
      fetchNextDigNumber(digForm.bill_type);
    }
  };

  // ----------------- BILL HISTORY TAB -----------------
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get(`/quick-bill/${mode}`, {
        params: { page: 1, limit: 50 }
      });
      setHistoryRows(res.data.bills || []);
    } catch (err) {
      showToast('Error loading history', 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [mode, activeTab]);

  const handleEditBill = async (rowId) => {
    try {
      const res = await api.get(`/quick-bill/${mode}/${rowId}`);
      const data = res.data;
      if (mode === 'physical') {
        setPhysForm({
          bill_number: data.bill_number || '',
          bill_type: data.bill_type || 'cash_memo',
          bill_date: data.bill_date ? data.bill_date.split('T')[0] : '',
          bill_time: data.bill_time || '',
          customer_name: data.customer_name || '',
          customer_phone: data.customer_phone || '',
          customer_gstin: data.customer_gstin || '',
          customer_company: data.customer_company || '',
          items: data.items || [],
          include_gst: parseFloat(data.gst_amount) > 0,
          gst_percent: data.gst_percent || 18,
          amount_received: data.amount_received || 0,
          payment_mode: data.payment_mode || 'cash',
          upi_reference: data.upi_reference || '',
          card_last4: data.card_last4 || '',
          terminal_id: data.terminal_id || '',
          bank_utr: data.bank_utr || '',
          bank_name: data.bank_name || '',
          internal_notes: data.internal_notes || ''
        });
        setPhysNumberLocked(true);
      } else {
        setDigForm({
          bill_number: data.bill_number || '',
          bill_type: data.bill_type || 'simple_receipt',
          bill_date: data.bill_date ? data.bill_date.split('T')[0] : '',
          bill_time: data.bill_time || '',
          customer_name: data.customer_name || '',
          customer_email: data.customer_email || '',
          customer_phone: data.customer_phone || '',
          customer_gstin: data.customer_gstin || '',
          customer_company: data.customer_company || '',
          has_digital_files: !!data.has_digital_files,
          download_link: data.download_link || '',
          link_password: data.link_password || '',
          link_valid_until: data.link_valid_until ? data.link_valid_until.split('T')[0] : '',
          items: data.items || [],
          include_gst: parseFloat(data.gst_amount) > 0,
          gst_percent: data.gst_percent || 18,
          amount_received: data.amount_received || 0,
          payment_mode: data.payment_mode || 'upi',
          upi_reference: data.upi_reference || '',
          card_last4: data.card_last4 || '',
          terminal_id: data.terminal_id || '',
          bank_utr: data.bank_utr || '',
          bank_name: data.bank_name || '',
          internal_notes: data.internal_notes || ''
        });
        setDigNumberLocked(true);
      }
      setEditId(rowId);
      setActiveTab('new');
    } catch (err) {
      showToast('Failed to fetch bill details for editing', 'error');
    }
  };

  const handleViewBillDetails = async (rowId) => {
    try {
      const res = await api.get(`/quick-bill/${mode}/${rowId}`);
      handlePrint(res.data, 'A4');
    } catch (err) {
      showToast('Failed to fetch bill details', 'error');
    }
  };

  const confirmDeleteBill = async () => {
    try {
      await api.delete(`/quick-bill/${mode}/${deleteId}`);
      setHistoryRows(prev => prev.filter(item => item.id !== deleteId));
      setDeleteId(null);
      showToast('Deleted successfully', 'success');
    } catch (err) {
      showToast('Delete failed', 'error');
      setDeleteId(null);
    }
  };

  const filteredHistory = historyRows.filter(row => {
    const q = historySearch.toLowerCase();
    return row.bill_number?.toLowerCase().includes(q) || 
           row.customer_name?.toLowerCase().includes(q) ||
           row.customer_phone?.toLowerCase().includes(q);
  });

  // Print popup choices state
  const [showPrintPopup, setShowPrintPopup] = useState(false);
  const [selectedPrintSize, setSelectedPrintSize] = useState('80mm');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Mode Selector and Navigation tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        
        {/* Toggle Mode */}
        <div style={{ display: 'flex', border: '1px solid #D1D5DB', borderRadius: '8px', overflow: 'hidden' }}>
          <button 
            onClick={() => handleModeChange('physical')}
            style={{
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: mode === 'physical' ? '#1A1A2E' : '#FFFFFF',
              color: mode === 'physical' ? '#FFFFFF' : '#374151'
            }}
          >
            📦 Physical Product
          </button>
          <button 
            onClick={() => handleModeChange('digital')}
            style={{
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: mode === 'digital' ? '#1A1A2E' : '#FFFFFF',
              color: mode === 'digital' ? '#FFFFFF' : '#374151'
            }}
          >
            💻 Digital Product / Service
          </button>
        </div>

        {/* Tab selectors */}
        {user?.role !== 'viewer' && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <Btn variant={activeTab === 'new' ? 'primary' : 'outline'} onClick={() => setActiveTab('new')}>
              ⚡ New Bill
            </Btn>
            <Btn variant={activeTab === 'history' ? 'primary' : 'outline'} onClick={() => setActiveTab('history')}>
              📋 Bill History
            </Btn>
          </div>
        )}
      </div>

      {activeTab === 'new' && user?.role !== 'viewer' ? (
        mode === 'physical' ? (
          /* =================================================================
             MODE 1: PHYSICAL PRODUCT FORM
             ================================================================= */
          <>
            {editId && (
              <div style={{ padding: '12px 16px', backgroundColor: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <span style={{ fontWeight: 'bold', color: '#92400E' }}>⚠️ You are currently editing a saved Bill.</span>
                  <span style={{ fontSize: '13px', color: '#B45309', marginLeft: '10px' }}>Saving will update the existing invoice record instead of creating a new one.</span>
                </div>
                <Btn variant="outline" style={{ fontSize: '11px', padding: '4px 10px', color: '#B45309', borderColor: '#FCD34D' }} onClick={handleResetForm}>
                  Cancel Edit
                </Btn>
              </div>
            )}
            {lastSavedBill && (
              <div style={{ padding: '16px', backgroundColor: '#ECFDF3', border: '1px solid #A7F3D0', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <span style={{ fontWeight: 'bold', color: '#065F46' }}>✓ Bill saved successfully as {lastSavedBill.bill_number}!</span>
                  <span style={{ fontSize: '13px', color: '#047857', marginLeft: '10px' }}>You can now print, download PDF or share via WhatsApp.</span>
                </div>
                <Btn variant="outline" style={{ fontSize: '11px', padding: '4px 10px', color: '#065F46', borderColor: '#A7F3D0' }} onClick={handleResetForm}>
                  ➕ New Bill
                </Btn>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 1024 ? '1fr' : '1.2fr 1fr', gap: '20px' }}>
            
            {/* Left Form column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Section A: Bill Info */}
              <Card>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginBottom: '14px' }}>Bill Info</div>
                <Grid cols={3} gap={10}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>Bill Type</label>
                    <div style={{ display: 'flex', border: '1px solid #D1D5DB', borderRadius: '6px', overflow: 'hidden' }}>
                      <button 
                        type="button"
                        onClick={() => setPhysForm({ ...physForm, bill_type: 'cash_memo' })}
                        style={{ padding: '6px 12px', fontSize: '11px', border: 'none', flex: 1, cursor: 'pointer', backgroundColor: physForm.bill_type === 'cash_memo' ? '#1A1A2E' : '#FFFFFF', color: physForm.bill_type === 'cash_memo' ? '#FFFFFF' : '#374151' }}
                      >
                        Cash Memo
                      </button>
                      <button 
                        type="button"
                        onClick={() => setPhysForm({ ...physForm, bill_type: 'gst_invoice' })}
                        style={{ padding: '6px 12px', fontSize: '11px', border: 'none', flex: 1, cursor: 'pointer', backgroundColor: physForm.bill_type === 'gst_invoice' ? '#1A1A2E' : '#FFFFFF', color: physForm.bill_type === 'gst_invoice' ? '#FFFFFF' : '#374151' }}
                      >
                        GST Invoice
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>Bill Number</label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input 
                        type="text" 
                        value={physForm.bill_number} 
                        disabled={physNumberLocked}
                        onChange={(e) => setPhysForm({ ...physForm, bill_number: e.target.value })}
                        style={{ padding: '6px', fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px', flex: 1, backgroundColor: physNumberLocked ? '#F3F4F6' : '#FFFFFF' }}
                      />
                      <button type="button" onClick={() => setPhysNumberLocked(!physNumberLocked)} style={{ fontSize: '11px', cursor: 'pointer', padding: '0 6px', border: '1px solid #D1D5DB', borderRadius: '4px', backgroundColor: '#F9FAFB' }}>
                        {physNumberLocked ? '🔓' : '🔒'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#6B7280', display: 'block' }}>Date & Time</label>
                    <div style={{ fontSize: '12px', padding: '6px 0', fontWeight: '600' }}>{physForm.bill_date} {physForm.bill_time}</div>
                  </div>
                </Grid>
              </Card>

              {/* Section B: Customer */}
              <Card>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>Customer Info</div>
                <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '12px' }}>Customer (Optional — skip for anonymous walk-in)</div>
                <Grid cols={2} gap={10}>
                  <Input placeholder="Customer name (optional)" value={physForm.customer_name} onChange={e => setPhysForm({ ...physForm, customer_name: e.target.value })} />
                  <Input placeholder="Phone (optional)" value={physForm.customer_phone} onChange={e => setPhysForm({ ...physForm, customer_phone: e.target.value })} />
                  {physForm.bill_type === 'gst_invoice' && (
                    <>
                      <Input placeholder="Customer GSTIN" value={physForm.customer_gstin} onChange={e => setPhysForm({ ...physForm, customer_gstin: e.target.value })} />
                      <Input placeholder="Company name (optional)" value={physForm.customer_company} onChange={e => setPhysForm({ ...physForm, customer_company: e.target.value })} />
                    </>
                  )}
                </Grid>
              </Card>

              {/* Section C: Items / Products */}
              <Card>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginBottom: '10px' }}>Products</div>
                <div style={{ position: 'relative', marginBottom: '14px' }}>
                  <input 
                    type="text" 
                    placeholder="Search product name or scan barcode..."
                    value={physSearchQuery} 
                    onChange={e => setPhysSearchQuery(e.target.value)} 
                    style={{ width: '100%', padding: '10px', fontSize: '13px', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                  />
                  {physSearchResults.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', zIndex: 100, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                      {physSearchResults.map(p => (
                        <div 
                          key={p.id} 
                          onClick={() => addPhysProduct(p)} 
                          style={{ padding: '8px 12px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                          <span>{p.name} ({p.sku})</span>
                          <span style={{ fontSize: '11px', color: p.stock > 0 ? '#10B981' : '#EF4444' }}>
                            {p.stock > 0 ? `Stock: ${p.stock}` : 'Out of stock'} | {fmt(p.selling_price)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {physForm.items.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#9CA3AF', fontSize: '13px' }}>No products added yet.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #E5E7EB', textAlign: 'left', color: '#6B7280' }}>
                        <th style={{ padding: '6px 4px' }}>Product</th>
                        <th style={{ padding: '6px 4px', width: '70px' }}>Qty</th>
                        <th style={{ padding: '6px 4px', width: '100px' }}>Rate</th>
                        <th style={{ padding: '6px 4px', width: '80px' }}>Disc%</th>
                        <th style={{ padding: '6px 4px', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '6px 4px', width: '30px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {physForm.items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ padding: '6px 4px' }}>
                            {item.product_id ? (
                              <div>
                                <span style={{ fontWeight: '500' }}>{item.product_name}</span>
                                <input 
                                  type="text" 
                                  value={item.description || ''} 
                                  placeholder="Description"
                                  onChange={e => updatePhysItem(idx, 'description', e.target.value)}
                                  style={{ width: '100%', padding: '4px', border: '1px solid #D1D5DB', borderRadius: '4px', marginTop: '4px', fontSize: '11px' }}
                                />
                              </div>
                            ) : (
                              <div>
                                <input 
                                  type="text" 
                                  value={item.product_name} 
                                  placeholder="Manual Name"
                                  onChange={e => updatePhysItem(idx, 'product_name', e.target.value)}
                                  style={{ width: '100%', padding: '4px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                                />
                                <input 
                                  type="text" 
                                  value={item.description || ''} 
                                  placeholder="Description"
                                  onChange={e => updatePhysItem(idx, 'description', e.target.value)}
                                  style={{ width: '100%', padding: '4px', border: '1px solid #D1D5DB', borderRadius: '4px', marginTop: '4px', fontSize: '11px' }}
                                />
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            <input 
                              type="number" 
                              value={item.quantity} 
                              min="1"
                              onChange={e => updatePhysItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                              style={{ width: '100%', padding: '4px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            <input 
                              type="number" 
                              value={item.unit_price} 
                              onChange={e => updatePhysItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', padding: '4px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            <input 
                              type="number" 
                              value={item.discount_percent} 
                              onChange={e => updatePhysItem(idx, 'discount_percent', parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', padding: '4px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: '600' }}>
                            {fmt(item.amount)}
                          </td>
                          <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                            <button type="button" onClick={() => removePhysItem(idx)} style={{ color: '#EF4444', border: 'none', background: 'none', cursor: 'pointer' }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={addPhysItemManually}>+ Add Item (Manual)</Btn>
                  <span style={{ fontSize: '11px', color: '#6B7280' }}>Items not in your list? Click + Add Item and type manually.</span>
                </div>
              </Card>

            </div>

            {/* Right Totals and Payment Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Section D: Totals */}
              <Card>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginBottom: '14px' }}>Totals</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#4B5563' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subtotal</span>
                    <span>{fmt(physTotals.subtotal)}</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F3F4F6', paddingTop: '8px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={physForm.include_gst} 
                        onChange={e => setPhysForm({ ...physForm, include_gst: e.target.checked })} 
                      />
                      Include GST
                    </label>
                    {physForm.include_gst && (
                      <select 
                        value={physForm.gst_percent} 
                        onChange={e => setPhysForm({ ...physForm, gst_percent: parseFloat(e.target.value) })}
                        style={{ padding: '4px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    )}
                  </div>

                  {physForm.include_gst && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6B7280', fontSize: '12px' }}>
                      <span>GST Amount</span>
                      <span>{fmt(physTotals.gstAmount)}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E5E7EB', paddingTop: '10px', fontSize: '20px', fontWeight: '700', color: '#111827' }}>
                    <span>Total</span>
                    <span>{fmt(physTotals.total)}</span>
                  </div>
                </div>
              </Card>

              {/* Section E: Payment */}
              <Card>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginBottom: '14px' }}>Payment Received</div>
                
                {/* Amount Received Input */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '11px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>Amount Received (₹)</label>
                  <input 
                    type="number" 
                    value={physForm.amount_received} 
                    onChange={e => setPhysForm({ ...physForm, amount_received: parseFloat(e.target.value) || 0 })} 
                    style={{ width: '100%', padding: '10px', fontSize: '18px', fontWeight: '600', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                  />
                  <Btn 
                    variant="outline" 
                    style={{ marginTop: '6px', width: '100%', fontSize: '11px', padding: '4px' }} 
                    onClick={() => setPhysForm({ ...physForm, amount_received: physTotals.total })}
                  >
                    Match Total: {fmt(physTotals.total)}
                  </Btn>
                </div>

                {/* Mode Buttons */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '11px', color: '#6B7280', display: 'block', marginBottom: '6px' }}>Payment Mode</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                    {['cash', 'upi', 'card', 'bank'].map(m => (
                      <button 
                        key={m}
                        type="button"
                        onClick={() => setPhysForm({ ...physForm, payment_mode: m })}
                        style={{
                          padding: '10px 4px',
                          fontSize: '11px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          borderRadius: '6px',
                          border: '1px solid #D1D5DB',
                          backgroundColor: physForm.payment_mode === m ? '#1A1A2E' : '#FFFFFF',
                          color: physForm.payment_mode === m ? '#FFFFFF' : '#374151'
                        }}
                      >
                        {m.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Change / Balance label */}
                <div style={{ padding: '8px', borderRadius: '4px', backgroundColor: '#F9FAFB', marginBottom: '14px', fontSize: '13px', fontWeight: '600' }}>
                  {physTotals.change > 0 && <span style={{ color: '#10B981' }}>Change to return: {fmt(physTotals.change)}</span>}
                  {physTotals.balance > 0 && <span style={{ color: '#EF4444' }}>Balance due: {fmt(physTotals.balance)}</span>}
                  {physTotals.change === 0 && physTotals.balance === 0 && <span style={{ color: '#10B981' }}>✅ Fully paid</span>}
                </div>

                {/* Internal Reference (not on bill) */}
                <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280' }}>Internal Reference (not on bill)</span>
                  
                  {physForm.payment_mode === 'upi' && (
                    <Input 
                      placeholder="UPI transaction ref (optional)" 
                      value={physForm.upi_reference} 
                      onChange={e => setPhysForm({ ...physForm, upi_reference: e.target.value })} 
                    />
                  )}

                  {physForm.payment_mode === 'card' && (
                    <Grid cols={2} gap={6}>
                      <Input 
                        placeholder="Last 4 digits" 
                        value={physForm.card_last4} 
                        onChange={e => setPhysForm({ ...physForm, card_last4: e.target.value.slice(0, 4) })} 
                      />
                      <Input 
                        placeholder="Terminal ID" 
                        value={physForm.terminal_id} 
                        onChange={e => setPhysForm({ ...physForm, terminal_id: e.target.value })} 
                      />
                    </Grid>
                  )}

                  {physForm.payment_mode === 'bank' && (
                    <Grid cols={2} gap={6}>
                      <Input 
                        placeholder="UTR / Ref Number" 
                        value={physForm.bank_utr} 
                        onChange={e => setPhysForm({ ...physForm, bank_utr: e.target.value })} 
                      />
                      <Input 
                        placeholder="Bank Name" 
                        value={physForm.bank_name} 
                        onChange={e => setPhysForm({ ...physForm, bank_name: e.target.value })} 
                      />
                    </Grid>
                  )}

                  <Textarea 
                    placeholder="Internal note for staff (not printed on bill)" 
                    value={physForm.internal_notes} 
                    onChange={e => setPhysForm({ ...physForm, internal_notes: e.target.value })} 
                  />
                </div>
              </Card>

              {/* Section F: Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    onClick={handlePrintClick}
                    style={{ width: '50%', height: '48px', backgroundColor: '#1A1A2E', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    🖨️ Print Options
                  </button>
                  <button 
                    onClick={handleDownloadPDFClick}
                    style={{ width: '50%', height: '48px', backgroundColor: '#FFFFFF', color: '#1A1A2E', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    ⬇️ Download PDF
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <Btn variant="outline" style={{ flex: 1, fontSize: '11px', padding: '6px' }} onClick={() => saveBill(null, false)}>💾 Save Only</Btn>
                  <Btn 
                    variant="outline" 
                    style={{ flex: 1, fontSize: '11px', padding: '6px' }} 
                    onClick={handleWhatsAppClick}
                  >
                    📱 WhatsApp
                  </Btn>
                </div>
              </div>
            </div>
          </div>
        </>
        ) : (
          /* =================================================================
             MODE 2: DIGITAL PRODUCT FORM
             ================================================================= */
          <>
            {editId && (
              <div style={{ padding: '12px 16px', backgroundColor: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <span style={{ fontWeight: 'bold', color: '#92400E' }}>⚠️ You are currently editing a saved Bill.</span>
                  <span style={{ fontSize: '13px', color: '#B45309', marginLeft: '10px' }}>Saving will update the existing invoice record instead of creating a new one.</span>
                </div>
                <Btn variant="outline" style={{ fontSize: '11px', padding: '4px 10px', color: '#B45309', borderColor: '#FCD34D' }} onClick={handleResetForm}>
                  Cancel Edit
                </Btn>
              </div>
            )}
            {lastSavedBill && (
              <div style={{ padding: '16px', backgroundColor: '#ECFDF3', border: '1px solid #A7F3D0', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <span style={{ fontWeight: 'bold', color: '#065F46' }}>✓ Bill saved successfully as {lastSavedBill.bill_number}!</span>
                  <span style={{ fontSize: '13px', color: '#047857', marginLeft: '10px' }}>You can now download PDF or share via WhatsApp.</span>
                </div>
                <Btn variant="outline" style={{ fontSize: '11px', padding: '4px 10px', color: '#065F46', borderColor: '#A7F3D0' }} onClick={handleResetForm}>
                  ➕ New Bill
                </Btn>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 1024 ? '1fr' : '1.2fr 1fr', gap: '20px' }}>
            
            {/* Left Form column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Section A: Bill Info */}
              <Card>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginBottom: '14px' }}>Digital Receipt Info</div>
                <Grid cols={3} gap={10}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>Bill Type</label>
                    <div style={{ display: 'flex', border: '1px solid #D1D5DB', borderRadius: '6px', overflow: 'hidden' }}>
                      <button 
                        type="button"
                        onClick={() => setDigForm({ ...digForm, bill_type: 'simple_receipt' })}
                        style={{ padding: '6px 12px', fontSize: '11px', border: 'none', flex: 1, cursor: 'pointer', backgroundColor: digForm.bill_type === 'simple_receipt' ? '#1A1A2E' : '#FFFFFF', color: digForm.bill_type === 'simple_receipt' ? '#FFFFFF' : '#374151' }}
                      >
                        Receipt
                      </button>
                      <button 
                        type="button"
                        onClick={() => setDigForm({ ...digForm, bill_type: 'gst_invoice' })}
                        style={{ padding: '6px 12px', fontSize: '11px', border: 'none', flex: 1, cursor: 'pointer', backgroundColor: digForm.bill_type === 'gst_invoice' ? '#1A1A2E' : '#FFFFFF', color: digForm.bill_type === 'gst_invoice' ? '#FFFFFF' : '#374151' }}
                      >
                        GST Invoice
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>Invoice Number</label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input 
                        type="text" 
                        value={digForm.bill_number} 
                        disabled={digNumberLocked}
                        onChange={(e) => setDigForm({ ...digForm, bill_number: e.target.value })}
                        style={{ padding: '6px', fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px', flex: 1, backgroundColor: digNumberLocked ? '#F3F4F6' : '#FFFFFF' }}
                      />
                      <button type="button" onClick={() => setDigNumberLocked(!digNumberLocked)} style={{ fontSize: '11px', cursor: 'pointer', padding: '0 6px', border: '1px solid #D1D5DB', borderRadius: '4px', backgroundColor: '#F9FAFB' }}>
                        {digNumberLocked ? '🔓' : '🔒'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#6B7280', display: 'block' }}>Date & Time</label>
                    <div style={{ fontSize: '12px', padding: '6px 0', fontWeight: '600' }}>{digForm.bill_date} {digForm.bill_time}</div>
                  </div>
                </Grid>
              </Card>

              {/* Section B: Customer Details */}
              <Card>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginBottom: '14px' }}>Customer Info (Digital Delivery)</div>
                <Grid cols={3} gap={10}>
                  <Input label="Customer Name *" value={digForm.customer_name} onChange={e => setDigForm({ ...digForm, customer_name: e.target.value })} />
                  <Input label="Customer Email *" type="email" value={digForm.customer_email} onChange={e => setDigForm({ ...digForm, customer_email: e.target.value })} />
                  <Input label="Customer Phone" value={digForm.customer_phone} onChange={e => setDigForm({ ...digForm, customer_phone: e.target.value })} />
                  {digForm.bill_type === 'gst_invoice' && (
                    <>
                      <Input label="GSTIN" value={digForm.customer_gstin} onChange={e => setDigForm({ ...digForm, customer_gstin: e.target.value })} />
                      <Input label="Company Name" value={digForm.customer_company} onChange={e => setDigForm({ ...digForm, customer_company: e.target.value })} />
                    </>
                  )}
                </Grid>
              </Card>

              {/* Section C: Products / Services */}
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: '#111827' }}>Products / Services</span>
                  <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={addDigItem}>+ Add Item</Btn>
                </div>

                {digForm.items.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#9CA3AF', fontSize: '13px' }}>No items added yet. Click + Add Item.</div>
                ) : (
                  digForm.items.map((item, idx) => (
                    <Card key={idx} style={{ padding: '10px', marginBottom: '10px', border: '1px solid #E5E7EB' }}>
                      <Grid cols={3} gap={8}>
                        <Select label="Item Type" value={item.item_type} onChange={e => updateDigItem(idx, 'item_type', e.target.value)}>
                          <option value="Digital File">Digital File</option>
                          <option value="Design Service">Design Service</option>
                          <option value="Consultation">Consultation</option>
                          <option value="Website Work">Website Work</option>
                          <option value="Social Media">Social Media</option>
                          <option value="Other Service">Other Service</option>
                        </Select>
                        
                        <Input label="Item Name *" value={item.product_name} onChange={e => updateDigItem(idx, 'product_name', e.target.value)} />
                        
                        {item.item_type === 'Digital File' ? (
                          <>
                            <Select label="File Format" value={item.file_format || 'ZIP'} onChange={e => updateDigItem(idx, 'file_format', e.target.value)}>
                              {['ZIP', 'SVG', 'AI', 'CDR', 'PSD', 'PDF', 'PNG', 'Other'].map(f => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </Select>
                            <Select label="License" value={item.license_type || 'Commercial Use'} onChange={e => updateDigItem(idx, 'license_type', e.target.value)}>
                              {['Personal Use', 'Commercial Use', 'Extended License', 'Exclusive Rights'].map(l => (
                                <option key={l} value={l}>{l}</option>
                              ))}
                            </Select>
                          </>
                        ) : (
                          <Input label="Description" value={item.description || ''} onChange={e => updateDigItem(idx, 'description', e.target.value)} />
                        )}
                        
                        <Input label="Qty" type="number" value={item.quantity} onChange={e => updateDigItem(idx, 'quantity', parseInt(e.target.value) || 1)} />
                        <Input label="Rate (₹) *" type="number" value={item.unit_price} onChange={e => updateDigItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} />
                        <Input label="Discount %" type="number" value={item.discount_percent} onChange={e => updateDigItem(idx, 'discount_percent', parseFloat(e.target.value) || 0)} />
                        
                        <div>
                          <label style={{ fontSize: '11px', color: '#6B7280', display: 'block' }}>Amount</label>
                          <div style={{ fontWeight: '600', padding: '6px 0' }}>{fmt(item.amount)}</div>
                        </div>

                        <Btn type="button" variant="outline" style={{ alignSelf: 'center', borderColor: '#EF4444', color: '#EF4444', padding: '4px' }} onClick={() => removeDigItem(idx)}>Remove ✕</Btn>
                      </Grid>
                    </Card>
                  ))
                )}
              </Card>

              {/* Section D: Delivery Info */}
              {digForm.items.some(i => i.item_type === 'Digital File') && (
                <Card>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginBottom: '14px' }}>Digital Delivery Details</div>
                  <Grid cols={2} gap={10}>
                    <Input label="Download Link" placeholder="Paste download link (Google Drive, WeTransfer, etc.)" value={digForm.download_link} onChange={e => setDigForm({ ...digForm, download_link: e.target.value })} />
                    <Input label="Link Password" placeholder="Password to access file (if any)" value={digForm.link_password} onChange={e => setDigForm({ ...digForm, link_password: e.target.value })} />
                    <Input label="Valid Until" type="date" value={digForm.link_valid_until} onChange={e => setDigForm({ ...digForm, link_valid_until: e.target.value })} />
                  </Grid>
                </Card>
              )}

            </div>

            {/* Right Totals and Payment Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Section D: Totals */}
              <Card>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginBottom: '14px' }}>Totals</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#4B5563' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subtotal</span>
                    <span>{fmt(digTotals.subtotal)}</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F3F4F6', paddingTop: '8px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={digForm.include_gst} 
                        onChange={e => setDigForm({ ...digForm, include_gst: e.target.checked })} 
                      />
                      Include GST
                    </label>
                    {digForm.include_gst && (
                      <select 
                        value={digForm.gst_percent} 
                        onChange={e => setDigForm({ ...digForm, gst_percent: parseFloat(e.target.value) })}
                        style={{ padding: '4px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    )}
                  </div>

                  {digForm.include_gst && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6B7280', fontSize: '12px' }}>
                      <span>GST Amount</span>
                      <span>{fmt(digTotals.gstAmount)}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E5E7EB', paddingTop: '10px', fontSize: '20px', fontWeight: '700', color: '#111827' }}>
                    <span>Total</span>
                    <span>{fmt(digTotals.total)}</span>
                  </div>
                </div>
              </Card>

              {/* Section E: Payment */}
              <Card>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginBottom: '14px' }}>Payment Received</div>
                
                {/* Amount Received Input */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '11px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>Amount Received (₹)</label>
                  <input 
                    type="number" 
                    value={digForm.amount_received} 
                    onChange={e => setDigForm({ ...digForm, amount_received: parseFloat(e.target.value) || 0 })} 
                    style={{ width: '100%', padding: '10px', fontSize: '18px', fontWeight: '600', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                  />
                  <Btn 
                    variant="outline" 
                    style={{ marginTop: '6px', width: '100%', fontSize: '11px', padding: '4px' }} 
                    onClick={() => setDigForm({ ...digForm, amount_received: digTotals.total })}
                  >
                    Match Total: {fmt(digTotals.total)}
                  </Btn>
                </div>

                {/* Mode Buttons */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '11px', color: '#6B7280', display: 'block', marginBottom: '6px' }}>Payment Mode</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                    {['upi', 'card', 'bank', 'cash'].map(m => (
                      <button 
                        key={m}
                        type="button"
                        onClick={() => setDigForm({ ...digForm, payment_mode: m })}
                        style={{
                          padding: '10px 4px',
                          fontSize: '11px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          borderRadius: '6px',
                          border: '1px solid #D1D5DB',
                          backgroundColor: digForm.payment_mode === m ? '#1A1A2E' : '#FFFFFF',
                          color: digForm.payment_mode === m ? '#FFFFFF' : '#374151'
                        }}
                      >
                        {m.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Change / Balance label */}
                <div style={{ padding: '8px', borderRadius: '4px', backgroundColor: '#F9FAFB', marginBottom: '14px', fontSize: '13px', fontWeight: '600' }}>
                  {digTotals.change > 0 && <span style={{ color: '#10B981' }}>Change to return: {fmt(digTotals.change)}</span>}
                  {digTotals.balance > 0 && <span style={{ color: '#EF4444' }}>Balance due: {fmt(digTotals.balance)}</span>}
                  {digTotals.change === 0 && digTotals.balance === 0 && <span style={{ color: '#10B981' }}>✅ Fully paid</span>}
                </div>

                {/* Internal Fields */}
                <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280' }}>Internal Reference (not on bill)</span>
                  
                  {digForm.payment_mode === 'upi' && (
                    <Input 
                      placeholder="UPI transaction ref (optional)" 
                      value={digForm.upi_reference} 
                      onChange={e => setDigForm({ ...digForm, upi_reference: e.target.value })} 
                    />
                  )}

                  {digForm.payment_mode === 'card' && (
                    <Grid cols={2} gap={6}>
                      <Input 
                        placeholder="Last 4 digits" 
                        value={digForm.card_last4} 
                        onChange={e => setDigForm({ ...digForm, card_last4: e.target.value.slice(0, 4) })} 
                      />
                      <Input 
                        placeholder="Terminal ID" 
                        value={digForm.terminal_id} 
                        onChange={e => setDigForm({ ...digForm, terminal_id: e.target.value })} 
                      />
                    </Grid>
                  )}

                  {digForm.payment_mode === 'bank' && (
                    <Grid cols={2} gap={6}>
                      <Input 
                        placeholder="UTR / Ref Number" 
                        value={digForm.bank_utr} 
                        onChange={e => setDigForm({ ...digForm, bank_utr: e.target.value })} 
                      />
                      <Input 
                        placeholder="Bank Name" 
                        value={digForm.bank_name} 
                        onChange={e => setDigForm({ ...digForm, bank_name: e.target.value })} 
                      />
                    </Grid>
                  )}

                  <Textarea 
                    placeholder="Internal note for staff (not printed on bill)" 
                    value={digForm.internal_notes} 
                    onChange={e => setDigForm({ ...digForm, internal_notes: e.target.value })} 
                  />
                </div>
              </Card>

              {/* Section F: Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    onClick={handleDownloadPDFClick}
                    style={{ width: '100%', height: '48px', backgroundColor: '#FFFFFF', color: '#1A1A2E', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    ⬇️ Download PDF
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <Btn variant="outline" style={{ flex: 1, fontSize: '11px', padding: '6px' }} onClick={() => saveBill(null, false)}>💾 Save Only</Btn>
                  <Btn 
                    variant="outline" 
                    style={{ flex: 1, fontSize: '11px', padding: '6px' }} 
                    onClick={handleWhatsAppClick}
                  >
                    📱 WhatsApp
                  </Btn>
                </div>
              </div>
            </div>
          </div>
        </>
      )
      ) : (
        /* =================================================================
           BILL HISTORY TAB VIEW
           ================================================================= */
        <Card style={{ padding: '0px', overflowX: 'auto' }}>
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', borderBottom: '1px solid #E5E7EB' }}>
            <input 
              type="text" 
              placeholder="Search history by bill no or customer..." 
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              style={{ padding: '8px 12px', fontSize: '13px', border: '1px solid #D1D5DB', borderRadius: '6px', width: '260px' }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '1800px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left', color: '#6B7280' }}>
                  <th style={{ padding: '12px 16px' }}>Sno</th>
                  <th style={{ padding: '12px 16px' }}>Bill No</th>
                  <th style={{ padding: '12px 16px' }}>Type</th>
                  <th style={{ padding: '12px 16px' }}>Date & Time</th>
                  <th style={{ padding: '12px 16px' }}>Customer Name</th>
                  <th style={{ padding: '12px 16px' }}>Phone</th>
                  {mode === 'digital' && <th style={{ padding: '12px 16px' }}>Email</th>}
                  <th style={{ padding: '12px 16px' }}>Company</th>
                  <th style={{ padding: '12px 16px' }}>GSTIN</th>
                  <th style={{ padding: '12px 16px' }}>Subtotal</th>
                  <th style={{ padding: '12px 16px' }}>GST %</th>
                  <th style={{ padding: '12px 16px' }}>GST Amt</th>
                  <th style={{ padding: '12px 16px' }}>Total</th>
                  <th style={{ padding: '12px 16px' }}>Received</th>
                  <th style={{ padding: '12px 16px' }}>Change</th>
                  <th style={{ padding: '12px 16px' }}>Due</th>
                  <th style={{ padding: '12px 16px' }}>Mode</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>UPI Ref</th>
                  <th style={{ padding: '12px 16px' }}>Card Last4</th>
                  <th style={{ padding: '12px 16px' }}>Terminal ID</th>
                  <th style={{ padding: '12px 16px' }}>Bank UTR</th>
                  <th style={{ padding: '12px 16px' }}>Bank Name</th>
                  {mode === 'digital' && <th style={{ padding: '12px 16px' }}>Download Link</th>}
                  <th style={{ padding: '12px 16px' }}>Notes</th>
                  <th style={{ padding: '12px 16px' }}>Staff</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <TableSkeleton cols={mode === 'digital' ? 27 : 25} rows={5} />
                ) : filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={mode === 'digital' ? 27 : 25} style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>No bills found in history.</td>
                  </tr>
                ) : (
                  filteredHistory.map((row, idx) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <td style={{ padding: '12px 16px' }}>{idx + 1}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '600' }}>{row.bill_number}</td>
                      <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>{(row.bill_type || '').replace('_', ' ')}</td>
                      <td style={{ padding: '12px 16px' }}>{row.bill_date} {row.bill_time}</td>
                      <td style={{ padding: '12px 16px' }}>{row.customer_name || 'Walk-in Customer'}</td>
                      <td style={{ padding: '12px 16px' }}>{row.customer_phone || '-'}</td>
                      {mode === 'digital' && <td style={{ padding: '12px 16px' }}>{row.customer_email || '-'}</td>}
                      <td style={{ padding: '12px 16px' }}>{row.customer_company || '-'}</td>
                      <td style={{ padding: '12px 16px' }}>{row.customer_gstin || '-'}</td>
                      <td style={{ padding: '12px 16px' }}>{fmt(row.subtotal)}</td>
                      <td style={{ padding: '12px 16px' }}>{row.gst_percent || 0}%</td>
                      <td style={{ padding: '12px 16px' }}>{fmt(row.gst_amount)}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '700' }}>{fmt(row.total)}</td>
                      <td style={{ padding: '12px 16px' }}>{fmt(row.amount_received)}</td>
                      <td style={{ padding: '12px 16px' }}>{fmt(row.change_amount)}</td>
                      <td style={{ padding: '12px 16px', color: row.balance_due > 0 ? '#DC2626' : 'inherit' }}>{fmt(row.balance_due)}</td>
                      <td style={{ padding: '12px 16px', textTransform: 'uppercase' }}>{row.payment_mode}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className={`badge-status status-${row.payment_status}`}>
                          {row.payment_status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>{row.upi_reference || '-'}</td>
                      <td style={{ padding: '12px 16px' }}>{row.card_last4 || '-'}</td>
                      <td style={{ padding: '12px 16px' }}>{row.terminal_id || '-'}</td>
                      <td style={{ padding: '12px 16px' }}>{row.bank_utr || '-'}</td>
                      <td style={{ padding: '12px 16px' }}>{row.bank_name || '-'}</td>
                      {mode === 'digital' && <td style={{ padding: '12px 16px' }}>{row.download_link ? <a href={row.download_link} target="_blank" rel="noreferrer">Link</a> : '-'}</td>}
                      <td style={{ padding: '12px 16px' }}>{row.internal_notes || '-'}</td>
                      <td style={{ padding: '12px 16px' }}>{row.created_by_name || 'N/A'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handlePrint(row)}>
                            🖨️ Print
                          </Btn>
                          {isAdmin && (
                            <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px', color: '#4F46E5', borderColor: '#C7D2FE' }} onClick={() => handleEditBill(row.id)}>
                              ✏️ Edit
                            </Btn>
                          )}
                          <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleDownloadPDF(row)}>
                            📄 PDF
                          </Btn>
                          <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleWhatsApp(row)}>
                            📱 WA
                          </Btn>
                          {isAdmin && (
                            <Btn 
                              variant="outline" 
                              style={{ padding: '4px 8px', fontSize: '11px', color: '#DC2626', borderColor: '#FECACA' }} 
                              onClick={() => setDeleteId(row.id)}
                            >
                              Delete
                            </Btn>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Reusable Print Popup dialog */}
      <PrintOptions
        open={showPrintOptions}
        onClose={() => {
          setShowPrintOptions(false);
          setActivePrintBill(null);
        }}
        billData={activePrintBill}
        settings={companySettings}
      />

      <ConfirmDelete 
        isOpen={deleteId !== null} 
        onClose={() => setDeleteId(null)} 
        onConfirm={confirmDeleteBill} 
      />
    </div>
  );
}
