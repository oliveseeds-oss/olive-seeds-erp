import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { downloadPDFBlob } from '../utils/printUtils';
import { Card, PageHeader, Btn, Grid, Input, Select, Textarea, TableSkeleton, fmt, fmtDate } from '../components/UI';
import ConfirmDelete from '../components/ConfirmDelete';
import PrintOptions from '../components/PrintOptions';
import { useAuth } from '../utils/AuthContext';
import toast from 'react-hot-toast';

export default function Invoices() {
  const { user, isAdmin, isEmployee } = useAuth();
  
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modals state
  const [deleteId, setDeleteId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editInvoiceId, setEditInvoiceId] = useState(null);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);

  // Edit form state
  const [form, setForm] = useState({
    invoice_date: '',
    due_date: '',
    customer_id: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_gstin: '',
    billing_address: '',
    shipping_address: '',
    shipping_country: 'India',
    subtotal: 0,
    discount: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    total_tax: 0,
    shipping_cost: 0,
    total: 0,
    currency: 'INR',
    exchange_rate: 1,
    payment_status: 'unpaid',
    paid_amount: 0,
    payment_mode: '',
    notes: '',
    terms: '',
    internal_notes: '',
    is_gst_invoice: true,
    is_international: false,
    order_id: null,
    items: []
  });

  // Pay form state
  const [payForm, setPayForm] = useState({
    invoice_number: '',
    customer_name: '',
    total: 0,
    paid_amount: 0,
    balance: 0,
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'cash',
    transaction_id: '',
    bank_name: '',
    cheque_number: '',
    clearing_date: '',
    notes: ''
  });

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (filterType) params.type = filterType;
      if (filterStatus) params.payment_status = filterStatus;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      params.page = page;
      params.limit = 50;

      const res = await api.get('/invoices', { params });
      // Handle both response formats
      const invoices = res.data.invoices || res.data || [];
      const total = res.data.total || invoices.length;
      setInvoices(invoices);
      setTotal(total);
    } catch (err) {
      console.error('Invoice fetch error:', err);
      toast.error('Failed to load invoices: ' + (err.response?.data?.error || err.message));
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [page, filterType, filterStatus, dateFrom, dateTo]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(fetchInvoices, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Edit Invoice flow
  const handleEdit = async (inv) => {
    try {
      const res = await api.get(`/invoices/${inv.id}`);
      const data = res.data;
      setForm({
        invoice_date: data.invoice_date ? data.invoice_date.slice(0, 10) : '',
        due_date: data.due_date ? data.due_date.slice(0, 10) : '',
        customer_id: data.customer_id || '',
        customer_name: data.customer_name || '',
        customer_email: data.customer_email || '',
        customer_phone: data.customer_phone || '',
        customer_gstin: data.customer_gstin || '',
        billing_address: data.billing_address || '',
        shipping_address: data.shipping_address || '',
        shipping_country: data.shipping_country || 'India',
        subtotal: parseFloat(data.subtotal || 0),
        discount: parseFloat(data.discount || 0),
        cgst: parseFloat(data.cgst || 0),
        sgst: parseFloat(data.sgst || 0),
        igst: parseFloat(data.igst || 0),
        total_tax: parseFloat(data.total_tax || 0),
        shipping_cost: parseFloat(data.shipping_cost || 0),
        total: parseFloat(data.total || 0),
        currency: data.currency || 'INR',
        exchange_rate: parseFloat(data.exchange_rate || 1),
        payment_status: data.payment_status || 'unpaid',
        paid_amount: parseFloat(data.paid_amount || 0),
        payment_mode: data.payment_mode || '',
        notes: data.notes || '',
        terms: data.terms || '',
        internal_notes: data.internal_notes || '',
        is_gst_invoice: data.is_gst_invoice ?? true,
        is_international: data.is_international ?? false,
        order_id: data.order_id || null,
        items: data.invoice_items || []
      });
      setEditInvoiceId(data.id);
      setShowEditModal(true);
    } catch (err) {
      toast.error('Failed to fetch invoice details');
    }
  };

  const calculateTotals = (updatedItems, shipping = form.shipping_cost, discountVal = form.discount, isGst = form.is_gst_invoice, isInter = form.is_international) => {
    let sub = 0;
    updatedItems.forEach(item => {
      sub += (parseInt(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
    });

    const disc = parseFloat(discountVal) || 0;
    const taxable = Math.max(0, sub - disc);

    let taxTotal = 0;
    let cgstVal = 0;
    let sgstVal = 0;
    let igstVal = 0;

    updatedItems.forEach(item => {
      const itemSub = (parseInt(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
      const itemDisc = disc > 0 ? (itemSub / sub) * disc : 0;
      const itemTaxable = Math.max(0, itemSub - itemDisc);
      const rate = parseFloat(item.gst_percent) || 0;

      if (isGst) {
        const itemTax = itemTaxable * (rate / 100);
        taxTotal += itemTax;
        if (isInter) {
          item.igst_amount = itemTax;
          item.cgst_amount = 0;
          item.sgst_amount = 0;
          igstVal += itemTax;
        } else {
          item.igst_amount = 0;
          item.cgst_amount = itemTax / 2;
          item.sgst_amount = itemTax / 2;
          cgstVal += itemTax / 2;
          sgstVal += itemTax / 2;
        }
      } else {
        item.igst_amount = 0;
        item.cgst_amount = 0;
        item.sgst_amount = 0;
      }
      item.total = itemTaxable + (isGst ? itemTaxable * (rate / 100) : 0);
    });

    const totalVal = taxable + (isGst ? taxTotal : 0) + (parseFloat(shipping) || 0);

    setForm(prev => ({
      ...prev,
      items: updatedItems,
      subtotal: sub,
      cgst: cgstVal,
      sgst: sgstVal,
      igst: igstVal,
      total_tax: taxTotal,
      total: totalVal
    }));
  };

  const handleItemChange = (index, field, val) => {
    const updated = [...form.items];
    updated[index][field] = val;
    calculateTotals(updated);
  };

  const handleAddItem = () => {
    const newItem = {
      product_name: '',
      hsn_code: '',
      quantity: 1,
      unit_price: 0,
      discount_percent: 0,
      gst_percent: 18,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total: 0
    };
    calculateTotals([...form.items, newItem]);
  };

  const handleRemoveItem = (index) => {
    const updated = form.items.filter((_, idx) => idx !== index);
    calculateTotals(updated);
  };

  const handleSaveEdit = async () => {
    const payload = {
      ...form,
      customer_id: form.customer_id ? parseInt(form.customer_id) : null
    };
    try {
      await api.put(`/invoices/${editInvoiceId}`, payload);
      toast.success('Invoice updated successfully');
      setShowEditModal(false);
      fetchInvoices();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update invoice');
    }
  };

  // Standalone Delete
  const confirmDelete = async () => {
    try {
      await api.delete(`/invoices/${deleteId}`);
      toast.success('Invoice deleted successfully');
      setDeleteId(null);
      fetchInvoices();
    } catch (err) {
      toast.error('Failed to delete invoice');
      setDeleteId(null);
    }
  };

  // PDF Download
  const handleDownloadPDF = async (inv) => {
    try {
      await downloadPDFBlob(api, `/invoices/${inv.id}/pdf`, `Invoice-${inv.invoice_number}.pdf`);
      toast.success('PDF downloaded');
    } catch (err) {
      toast.error('Download failed: ' + err.message);
    }
  };

  const handlePrintClick = async (inv) => {
    try {
      const res = await api.get(`/invoices/${inv.id}`);
      setSelectedInvoice(res.data);
      setShowPrintOptions(true);
    } catch (err) {
      setSelectedInvoice(inv);
      setShowPrintOptions(true);
    }
  };

  const handleViewClick = async (inv) => {
    try {
      const res = await api.get(`/invoices/${inv.id}`);
      setSelectedInvoice(res.data);
      setShowViewModal(true);
    } catch (err) {
      setSelectedInvoice(inv);
      setShowViewModal(true);
    }
  };

  // Duplicate Invoice
  const handleDuplicate = async (inv) => {
    try {
      const res = await api.get(`/invoices/${inv.id}`);
      const payload = { ...res.data, invoice_number: undefined, id: undefined, created_at: undefined };
      payload.items = res.data.invoice_items || [];
      await api.post('/invoices', payload);
      toast.success('Invoice duplicated successfully');
      fetchInvoices();
    } catch (err) {
      toast.error('Duplicate failed');
    }
  };

  // WhatsApp
  const handleWhatsApp = (inv) => {
    if (!inv.customer_phone) {
      toast.error('Customer phone number not available');
      return;
    }
    const phone = inv.customer_phone.replace(/[^0-9]/g, '');
    const phoneWithCode = phone.startsWith('91') ? phone : '91' + phone;
    const message = encodeURIComponent(
      `Dear ${inv.customer_name},\n\nYour Invoice from Olive Seeds:\nInvoice No: ${inv.invoice_number}\nDate: ${fmtDate(inv.invoice_date)}\nTotal: ₹${inv.total}\nPayment Status: ${inv.payment_status.toUpperCase()}\n\nThank you!`
    );
    window.open(`https://wa.me/${phoneWithCode}?text=${message}`, '_blank');
  };

  // Email
  const handleEmail = (inv) => {
    if (!inv.customer_email) {
      toast.error('Customer email not available');
      return;
    }
    const subject = encodeURIComponent(`Invoice ${inv.invoice_number} from Olive Seeds`);
    const body = encodeURIComponent(`Dear ${inv.customer_name},\n\nPlease find the invoice summary below:\nInvoice: ${inv.invoice_number}\nTotal: ₹${inv.total}\n\nThank you!`);
    window.open(`mailto:${inv.customer_email}?subject=${subject}&body=${body}`);
  };

  // Record Payment trigger
  const handleOpenPay = (inv) => {
    const bal = parseFloat(inv.total) - parseFloat(inv.paid_amount || 0);
    setPayForm({
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      customer_name: inv.customer_name,
      total: inv.total,
      paid_amount: inv.paid_amount || 0,
      balance: bal,
      amount: bal,
      payment_date: new Date().toISOString().split('T')[0],
      payment_mode: 'cash',
      transaction_id: '',
      bank_name: '',
      cheque_number: '',
      clearing_date: '',
      notes: ''
    });
    setShowPayModal(true);
  };

  const handleSavePayment = async () => {
    try {
      await api.post('/payments', payForm);
      toast.success('Payment recorded successfully');
      setShowPayModal(false);
      fetchInvoices();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Recording payment failed');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px' }}>
      <PageHeader title="Invoices Management" />

      {/* Filter Row */}
      <Card>
        <Grid cols={6} gap={15}>
          <Input 
            placeholder="Search invoice number or customer..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
          <Select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All Invoice Types</option>
            <option value="tax">Tax Invoice</option>
            <option value="retail">Retail Invoice</option>
            <option value="quotation">Quotation</option>
          </Select>
          <Select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Payment Statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </Select>
          <Input 
            type="date"
            placeholder="From Date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input 
            type="date"
            placeholder="To Date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Btn variant="primary" onClick={fetchInvoices} style={{ width: '100%' }}>🔄 Refresh</Btn>
          </div>
        </Grid>
      </Card>

      {/* Invoices List Table */}
      <Card style={{ padding: '0px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', color: '#6B7280', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Invoice No</th>
              <th style={{ padding: '12px 16px' }}>Linked Order</th>
              <th style={{ padding: '12px 16px' }}>Customer Name</th>
              <th style={{ padding: '12px 16px' }}>Billing State</th>
              <th style={{ padding: '12px 16px' }}>Date</th>
              <th style={{ padding: '12px 16px' }}>Total Amount</th>
              <th style={{ padding: '12px 16px' }}>Paid</th>
              <th style={{ padding: '12px 16px' }}>Balance</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={10} rows={5} />
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>No invoices found.</td>
              </tr>
            ) : (
              invoices.map(row => {
                const balance = row.total - (row.paid_amount || 0);
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.invoice_number}</td>
                    <td style={{ padding: '12px 16px' }}>{row.linked_order_id || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>{row.display_customer_name || row.customer_name || 'Walk-in'}</td>
                    <td style={{ padding: '12px 16px' }}>{row.billing_state || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>{fmtDate(row.invoice_date)}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '700' }}>{fmt(row.total)}</td>
                    <td style={{ padding: '12px 16px' }}>{fmt(row.paid_amount || 0)}</td>
                    <td style={{ padding: '12px 16px', color: balance > 0 ? '#DC2626' : 'inherit' }}>{fmt(balance)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`badge-status status-${String(row.payment_status || '').toLowerCase()}`}>
                        {row.payment_status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <Btn variant="outline" style={{ padding: '3px 6px', fontSize: '10px' }} onClick={() => handleViewClick(row)}>View</Btn>
                        
                        {isAdmin && (
                          <Btn variant="outline" style={{ padding: '3px 6px', fontSize: '10px' }} onClick={() => handleEdit(row)}>Edit</Btn>
                        )}
                        {isAdmin && (
                          <Btn variant="outline" style={{ padding: '3px 6px', fontSize: '10px', color: '#DC2626', borderColor: '#FCA5A5' }} onClick={() => setDeleteId(row.id)}>Delete</Btn>
                        )}

                        <Btn variant="outline" style={{ padding: '3px 6px', fontSize: '10px' }} onClick={() => handlePrintClick(row)}>Print</Btn>
                        <Btn variant="outline" style={{ padding: '3px 6px', fontSize: '10px' }} onClick={() => handleDownloadPDF(row)}>PDF</Btn>
                        
                        {balance > 0 && !isEmployee && !user?.role?.includes('viewer') && (
                          <Btn variant="primary" style={{ padding: '3px 6px', fontSize: '10px' }} onClick={() => handleOpenPay(row)}>Pay</Btn>
                        )}

                        <Btn variant="outline" style={{ padding: '3px 6px', fontSize: '10px' }} onClick={() => handleDuplicate(row)}>Duplicate</Btn>
                        <Btn variant="outline" style={{ padding: '3px 6px', fontSize: '10px' }} onClick={() => handleWhatsApp(row)}>WA</Btn>
                        <Btn variant="outline" style={{ padding: '3px 6px', fontSize: '10px' }} onClick={() => handleEmail(row)}>Email</Btn>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      {/* Edit Modal */}
      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#FFF', borderRadius: '8px', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700 }}>Edit Standalone Invoice</h3>

            {form.order_id && (
              <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', color: '#1E40AF', marginBottom: '16px' }}>
                ℹ️ This invoice is linked to Order [ID: {form.order_id}]. Editing totals here will also update the order's totals.
              </div>
            )}

            <Grid cols={3} gap={15}>
              <Input label="Invoice Date *" type="date" value={form.invoice_date} onChange={e => setForm({ ...form, invoice_date: e.target.value })} />
              <Input label="Due Date" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
              <Input label="Customer ID" value={form.customer_id} readOnly />
              <Input label="Customer Name" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} />
              <Input label="Customer Email" value={form.customer_email} onChange={e => setForm({ ...form, customer_email: e.target.value })} />
              <Input label="Customer Phone" value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} />
              <Input label="Customer GSTIN" value={form.customer_gstin} onChange={e => setForm({ ...form, customer_gstin: e.target.value })} />
              <Input label="Billing Address" value={form.billing_address} onChange={e => setForm({ ...form, billing_address: e.target.value })} />
              <Input label="Shipping Address" value={form.shipping_address} onChange={e => setForm({ ...form, shipping_address: e.target.value })} />
              <Input label="Shipping Country" value={form.shipping_country} onChange={e => setForm({ ...form, shipping_country: e.target.value })} />
              <Input label="Currency" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} />
              <Input label="Exchange Rate" type="number" value={form.exchange_rate} onChange={e => setForm({ ...form, exchange_rate: parseFloat(e.target.value) || 1 })} />
              <Select label="Payment Status" value={form.payment_status} onChange={e => setForm({ ...form, payment_status: e.target.value })}>
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </Select>
              <Input label="Paid Amount" type="number" value={form.paid_amount} onChange={e => setForm({ ...form, paid_amount: parseFloat(e.target.value) || 0 })} />
              <Input label="Payment Mode" value={form.payment_mode} onChange={e => setForm({ ...form, payment_mode: e.target.value })} />
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginTop: '30px', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_gst_invoice} onChange={e => { setForm({ ...form, is_gst_invoice: e.target.checked }); calculateTotals(form.items, form.shipping_cost, form.discount, e.target.checked, form.is_international); }} />
                GST Invoice
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginTop: '30px', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_international} onChange={e => { setForm({ ...form, is_international: e.target.checked }); calculateTotals(form.items, form.shipping_cost, form.discount, form.is_gst_invoice, e.target.checked); }} />
                International
              </label>
            </Grid>

            {/* Line Items Table */}
            <div style={{ marginTop: '20px', borderTop: '1px solid #E5E7EB', paddingTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Invoice Line Items</h4>
                <Btn variant="outline" onClick={handleAddItem}>+ Add Item</Btn>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Product Name</th>
                    <th style={{ padding: '8px' }}>HSN</th>
                    <th style={{ padding: '8px' }}>Qty</th>
                    <th style={{ padding: '8px' }}>Rate</th>
                    <th style={{ padding: '8px' }}>GST %</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <td style={{ padding: '8px' }}>
                        <input value={item.product_name} onChange={e => handleItemChange(idx, 'product_name', e.target.value)} style={{ width: '100%', padding: '6px', border: '1px solid #D1D5DB', borderRadius: '4px' }} />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input value={item.hsn_code} onChange={e => handleItemChange(idx, 'hsn_code', e.target.value)} style={{ width: '60px', padding: '6px', border: '1px solid #D1D5DB', borderRadius: '4px' }} />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input type="number" value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)} style={{ width: '50px', padding: '6px', border: '1px solid #D1D5DB', borderRadius: '4px' }} />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input type="number" value={item.unit_price} onChange={e => handleItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)} style={{ width: '70px', padding: '6px', border: '1px solid #D1D5DB', borderRadius: '4px' }} />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input type="number" value={item.gst_percent} onChange={e => handleItemChange(idx, 'gst_percent', parseFloat(e.target.value) || 0)} style={{ width: '50px', padding: '6px', border: '1px solid #D1D5DB', borderRadius: '4px' }} />
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>
                        {fmt(item.total)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <button onClick={() => handleRemoveItem(idx)} style={{ color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Recalculation */}
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #E5E7EB', paddingTop: '20px' }}>
              <div style={{ width: '250px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>Subtotal:</span>
                  <span>{fmt(form.subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', alignItems: 'center' }}>
                  <span>Discount:</span>
                  <input type="number" value={form.discount} onChange={e => { setForm({ ...form, discount: parseFloat(e.target.value) || 0 }); calculateTotals(form.items, form.shipping_cost, parseFloat(e.target.value) || 0); }} style={{ width: '80px', padding: '4px', border: '1px solid #D1D5DB', borderRadius: '4px', textAlign: 'right' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', alignItems: 'center' }}>
                  <span>Shipping Cost:</span>
                  <input type="number" value={form.shipping_cost} onChange={e => { setForm({ ...form, shipping_cost: parseFloat(e.target.value) || 0 }); calculateTotals(form.items, parseFloat(e.target.value) || 0, form.discount); }} style={{ width: '80px', padding: '4px', border: '1px solid #D1D5DB', borderRadius: '4px', textAlign: 'right' }} />
                </div>
                {form.is_gst_invoice && (
                  <>
                    {form.cgst > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>CGST:</span><span>{fmt(form.cgst)}</span></div>}
                    {form.sgst > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>SGST:</span><span>{fmt(form.sgst)}</span></div>}
                    {form.igst > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>IGST:</span><span>{fmt(form.igst)}</span></div>}
                  </>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontWeight: '700', borderTop: '1px solid #D1D5DB', marginTop: '6px' }}>
                  <span>TOTAL:</span>
                  <span>{fmt(form.total)}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <Btn variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={handleSaveEdit}>Save Changes</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPayModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#FFF', borderRadius: '8px', width: '100%', maxWidth: '500px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 700 }}>Record Payment</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', marginBottom: '20px' }}>
              <div>Invoice No: <strong>{payForm.invoice_number}</strong></div>
              <div>Customer: <strong>{payForm.customer_name}</strong></div>
              <div>Invoice Total: <strong>{fmt(payForm.total)}</strong></div>
              <div>Already Paid: <strong>{fmt(payForm.paid_amount)}</strong></div>
              <div style={{ color: '#DC2626', fontWeight: 700 }}>Balance Due: {fmt(payForm.balance)}</div>
            </div>
            
            <Grid cols={1} gap={12}>
              <Input label="Amount *" type="number" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: parseFloat(e.target.value) || 0 })} />
              <Input label="Payment Date *" type="date" value={payForm.payment_date} onChange={e => setPayForm({ ...payForm, payment_date: e.target.value })} />
              <Select label="Payment Mode *" value={payForm.payment_mode} onChange={e => setPayForm({ ...payForm, payment_mode: e.target.value })}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank / NEFT</option>
                <option value="cheque">Cheque</option>
              </Select>

              {payForm.payment_mode === 'upi' && (
                <Input label="Transaction/UTR Reference" value={payForm.transaction_id} onChange={e => setPayForm({ ...payForm, transaction_id: e.target.value })} />
              )}
              {payForm.payment_mode === 'card' && (
                <Grid cols={2} gap={10}>
                  <Input label="Last 4 Digits" maxLength="4" value={payForm.transaction_id} onChange={e => setPayForm({ ...payForm, transaction_id: e.target.value })} />
                  <Input label="Terminal ID" value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} />
                </Grid>
              )}
              {payForm.payment_mode === 'bank_transfer' && (
                <Grid cols={2} gap={10}>
                  <Input label="UTR Number" value={payForm.transaction_id} onChange={e => setPayForm({ ...payForm, transaction_id: e.target.value })} />
                  <Input label="Bank Name" value={payForm.bank_name} onChange={e => setPayForm({ ...payForm, bank_name: e.target.value })} />
                </Grid>
              )}
              {payForm.payment_mode === 'cheque' && (
                <Grid cols={3} gap={10}>
                  <Input label="Cheque Number" value={payForm.cheque_number} onChange={e => setPayForm({ ...payForm, cheque_number: e.target.value })} />
                  <Input label="Bank Name" value={payForm.bank_name} onChange={e => setPayForm({ ...payForm, bank_name: e.target.value })} />
                  <Input label="Clearing Date" type="date" value={payForm.clearing_date} onChange={e => setPayForm({ ...payForm, clearing_date: e.target.value })} />
                </Grid>
              )}
              <Textarea label="Notes" value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} />
            </Grid>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <Btn variant="secondary" onClick={() => setShowPayModal(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={handleSavePayment}>Save Payment</Btn>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {showViewModal && selectedInvoice && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#FFF', borderRadius: '8px', width: '100%', maxWidth: '600px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 700 }}>Invoice Details: {selectedInvoice.invoice_number}</h3>
            <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: '1.5' }}>
              <div>Customer Name: <strong>{selectedInvoice.customer_name}</strong></div>
              <div>Customer Email: <strong>{selectedInvoice.customer_email || '-'}</strong></div>
              <div>Customer Phone: <strong>{selectedInvoice.customer_phone || '-'}</strong></div>
              <div>Billing State: <strong>{selectedInvoice.billing_state || '-'}</strong></div>
              <div>Date: <strong>{fmtDate(selectedInvoice.invoice_date)}</strong></div>
              <div>Subtotal: <strong>{fmt(selectedInvoice.subtotal)}</strong></div>
              <div>Total Tax (GST): <strong>{fmt(selectedInvoice.total_tax)}</strong></div>
              <div>Shipping Cost: <strong>{fmt(selectedInvoice.shipping_cost)}</strong></div>
              <div style={{ fontSize: '15px', fontWeight: 'bold' }}>Total Invoice Amount: {fmt(selectedInvoice.total)}</div>
              <div style={{ color: '#16A34A', fontWeight: 'bold' }}>Paid Amount: {fmt(selectedInvoice.paid_amount || 0)}</div>
              <div style={{ color: '#DC2626', fontWeight: 'bold' }}>Balance Due: {fmt(selectedInvoice.total - (selectedInvoice.paid_amount || 0))}</div>
              <div>Payment Status: <strong>{selectedInvoice.payment_status.toUpperCase()}</strong></div>
              {selectedInvoice.notes && <div>Notes: {selectedInvoice.notes}</div>}
              {selectedInvoice.terms && <div>Terms: {selectedInvoice.terms}</div>}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <Btn variant="primary" onClick={() => setShowViewModal(false)}>Close</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Print Options */}
      <PrintOptions 
        open={showPrintOptions} 
        onClose={() => { setShowPrintOptions(false); setSelectedInvoice(null); }} 
        billData={selectedInvoice} 
        settings={{}} 
      />

      <ConfirmDelete 
        isOpen={deleteId !== null} 
        onClose={() => setDeleteId(null)} 
        onConfirm={confirmDelete} 
      />
    </div>
  );
}
