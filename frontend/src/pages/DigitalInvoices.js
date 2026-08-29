import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../utils/AuthContext';
import { Card, PageHeader, Btn, Input, Select, Textarea, TableSkeleton, fmt, fmtDate, showToast, Modal, Grid } from '../components/UI';
import ConfirmDelete from '../components/ConfirmDelete';

const EMPTY_ITEM = {
  product_name: '',
  item_type: 'File Download',
  description: '',
  file_format: 'ZIP',
  license_type: 'Commercial Use',
  quantity: 1,
  unit_price: 0,
  discount_percent: 0,
  gst_percent: 18,
  amount: 0
};

const EMPTY_FORM = {
  invoice_date: new Date().toISOString().split('T')[0],
  due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  customer_id: '',
  customer_name: '',
  customer_email: '',
  customer_phone: '',
  customer_gstin: '',
  billing_address: '',
  delivery_method: 'Instant Download',
  download_link: '',
  download_password: '',
  link_expiry: '',
  download_limit: 5,
  file_size: '',
  version_number: '',
  items: [EMPTY_ITEM],
  payment_mode: 'UPI',
  payment_status: 'unpaid',
  notes: '',
  internal_notes: '',
  status: 'draft',
  remark: ''
};

export default function DigitalInvoices() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [customers, setCustomers] = useState([]);

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Delete State
  const [deleteId, setDeleteId] = useState(null);

  const fetchDigitalInvoices = async () => {
    setLoading(true);
    try {
      const res = await api.get('/digital-invoices');
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      showToast('Failed to load digital invoices', 'error');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/digital-invoices/${deleteId}`);
      showToast('Digital invoice deleted successfully', 'success');
      setDeleteId(null);
      fetchDigitalInvoices();
    } catch (err) {
      showToast('Failed to delete digital invoice', 'error');
    }
  };

  useEffect(() => {
    fetchDigitalInvoices();

    api.get('/customers')
      .then(res => setCustomers(Array.isArray(res.data) ? res.data : (res.data.customers || [])))
      .catch(() => {});
  }, []);

  const selectCustomer = (cid) => {
    const c = customers.find(x => x.id === parseInt(cid));
    if (c) {
      setForm(prev => ({
        ...prev,
        customer_id: cid,
        customer_name: c.name,
        customer_email: c.email || '',
        customer_phone: c.phone || '',
        customer_gstin: c.gstin || '',
        billing_address: c.billing_address || ''
      }));
    }
  };

  const setItemField = (idx, key, val) => {
    const items = [...form.items];
    items[idx][key] = val;

    // Recalculate amount
    const qty = parseFloat(items[idx].quantity) || 0;
    const rate = parseFloat(items[idx].unit_price) || 0;
    const disc = parseFloat(items[idx].discount_percent) || 0;
    items[idx].amount = (qty * rate) - ((qty * rate * disc) / 100);

    setForm({ ...form, items });
  };

  const addRow = () => {
    setForm({ ...form, items: [...form.items, { ...EMPTY_ITEM }] });
  };

  const removeRow = (idx) => {
    setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  };

  const calcFormTotals = () => {
    let subtotal = 0;
    let tax = 0;
    form.items.forEach(item => {
      const amt = parseFloat(item.amount) || 0;
      subtotal += amt;
      tax += amt * (parseFloat(item.gst_percent) || 0) / 100;
    });
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const { subtotal, tax, total } = calcFormTotals();

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.customer_name.trim()) {
      showToast('Customer Name is required', 'error');
      return;
    }
    if (!form.customer_email.trim()) {
      showToast('Customer Email is required for delivery', 'error');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/digital-invoices/${form.id}`, form);
        showToast('Digital Invoice updated successfully', 'success');
      } else {
        await api.post('/digital-invoices', form);
        showToast('Digital Invoice created successfully', 'success');
      }
      setShowFormModal(false);
      fetchDigitalInvoices();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save digital invoice', 'error');
    } finally {
      setSaving(false);
    }
  };

  const triggerEdit = async (inv) => {
    try {
      const res = await api.get(`/digital-invoices/${inv.id}`);
      setForm(res.data);
      setIsEdit(true);
      setErrors({});
      setShowFormModal(true);
    } catch (err) {
      showToast('Error loading digital invoice details', 'error');
    }
  };

  const handleDownloadPDF = (id) => {
    window.open(`${api.defaults.baseURL}/digital-invoices/${id}/pdf?token=${localStorage.getItem('os_token')}`, '_blank');
  };

  const handleCopyLink = (link) => {
    if (!link) {
      showToast('No download link entered', 'error');
      return;
    }
    navigator.clipboard.writeText(link);
    showToast('Download link copied to clipboard!', 'success');
  };

  const filteredRows = rows.filter(item => {
    const matchesSearch = item.invoice_number?.toLowerCase().includes(search.toLowerCase()) || 
                          item.customer_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus ? item.payment_status === filterStatus : true;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <PageHeader 
        title="Digital Invoices"
        actions={
          <>
            {user?.role !== 'viewer' && (
              <Btn variant="primary" onClick={() => { setForm(EMPTY_FORM); setIsEdit(false); setErrors({}); setShowFormModal(true); }}>
                + Add Digital Invoice
              </Btn>
            )}
          </>
        }
      />

      {/* Filters */}
      <Card style={{ padding: '12px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '240px' }}>
            <input 
              type="text"
              placeholder="Search by invoice no or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                width: '100%',
                maxWidth: '280px',
                backgroundColor: '#FFFFFF',
                color: '#111827'
              }}
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                backgroundColor: '#FFFFFF',
                color: '#111827'
              }}
            >
              <option value="">All Statuses</option>
              <option value="paid">PAID</option>
              <option value="partial">PARTIAL</option>
              <option value="unpaid">UNPAID</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Data Table */}
      <Card style={{ padding: '0px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Invoice No</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Date</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Customer</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Delivery Method</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Total</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Status</th>
              <th style={{ padding: '12px 16px', color: '#6B7280', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={7} rows={5} />
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>No digital invoices found.</td>
              </tr>
            ) : (
              filteredRows.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>{row.invoice_number}</td>
                  <td style={{ padding: '12px 16px' }}>{fmtDate(row.invoice_date)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div>{row.customer_name}</div>
                    <div style={{ fontSize: '11px', color: '#6B7280' }}>{row.customer_email}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>{row.delivery_method}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '700' }}>{fmt(row.total)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`badge-status status-${row.payment_status === 'paid' ? 'paid' : 'pending'}`}>
                      {row.payment_status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleDownloadPDF(row.id)}>
                        ⬇️ PDF
                      </Btn>
                      <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleCopyLink(row.download_link)}>
                        🔗 Copy Link
                      </Btn>
                      {isAdmin && (
                        <>
                          <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => triggerEdit(row)}>
                            Edit
                          </Btn>
                          <Btn 
                            variant="outline" 
                            style={{ padding: '4px 8px', fontSize: '11px', color: '#DC2626', borderColor: '#FECACA' }} 
                            onClick={() => setDeleteId(row.id)}
                          >
                            Delete
                          </Btn>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Add / Edit Modal */}
      <Modal open={showFormModal} onClose={() => setShowFormModal(false)} title={isEdit ? 'Edit Digital Invoice' : 'Add Digital Invoice'}>
        <form onSubmit={handleSave}>
          <Grid cols={2} gap={10}>
            <Input label="Invoice Date" type="date" value={form.invoice_date} onChange={e => setForm({ ...form, invoice_date: e.target.value })} />
            <Input label="Due Date" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
          </Grid>

          <div style={{ margin: '14px 0', borderTop: '1px solid #E5E7EB', paddingTop: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#374151' }}>Customer Details</span>
            <Select label="Select Customer" value={form.customer_id} onChange={e => selectCustomer(e.target.value)}>
              <option value="">-- Manual Entry --</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Grid cols={2} gap={10} style={{ marginTop: '8px' }}>
              <Input label="Customer Name *" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} />
              <Input label="Customer Email *" type="email" value={form.customer_email} onChange={e => setForm({ ...form, customer_email: e.target.value })} />
              <Input label="Customer Phone" value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} />
              <Input label="Customer GSTIN" value={form.customer_gstin} onChange={e => setForm({ ...form, customer_gstin: e.target.value })} />
            </Grid>
            <Textarea label="Billing Address" value={form.billing_address} onChange={e => setForm({ ...form, billing_address: e.target.value })} />
          </div>

          {/* Delivery Section */}
          <div style={{ margin: '14px 0', borderTop: '1px solid #E5E7EB', paddingTop: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#374151' }}>Delivery & File Details</span>
            <Grid cols={2} gap={10} style={{ marginTop: '8px' }}>
              <Select label="Delivery Method" value={form.delivery_method} onChange={e => setForm({ ...form, delivery_method: e.target.value })}>
                <option value="Instant Download">Instant Download</option>
                <option value="Email Link">Email Link</option>
                <option value="Google Drive">Google Drive</option>
                <option value="WeTransfer">WeTransfer</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Manual">Manual</option>
              </Select>
              <Input label="Download Link" value={form.download_link} onChange={e => setForm({ ...form, download_link: e.target.value })} />
              <Input label="Download Password" value={form.download_password} onChange={e => setForm({ ...form, download_password: e.target.value })} />
              <Input label="Link Expiry Date" type="date" value={form.link_expiry} onChange={e => setForm({ ...form, link_expiry: e.target.value })} />
              <Input label="Download Limit" type="number" value={form.download_limit} onChange={e => setForm({ ...form, download_limit: parseInt(e.target.value) || 5 })} />
              <Input label="File Size" value={form.file_size} onChange={e => setForm({ ...form, file_size: e.target.value })} />
              <Input label="Version" value={form.version_number} onChange={e => setForm({ ...form, version_number: e.target.value })} />
            </Grid>
          </div>

          {/* Line Items */}
          <div style={{ margin: '14px 0', borderTop: '1px solid #E5E7EB', paddingTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#374151' }}>Line Items</span>
              <Btn type="button" variant="outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={addRow}>+ Add Row</Btn>
            </div>

            {form.items.map((item, idx) => (
              <Card key={idx} style={{ padding: '10px', marginBottom: '8px', border: '1px solid #E5E7EB' }}>
                <Grid cols={3} gap={8}>
                  <Input label="Item Name *" value={item.product_name} onChange={e => setItemField(idx, 'product_name', e.target.value)} />
                  <Select label="Type" value={item.item_type} onChange={e => setItemField(idx, 'item_type', e.target.value)}>
                    <option value="File Download">File Download</option>
                    <option value="Design Service">Design Service</option>
                    <option value="Subscription">Subscription</option>
                    <option value="License">License</option>
                    <option value="Consultation">Consultation</option>
                    <option value="Software">Software</option>
                    <option value="Course">Course</option>
                    <option value="Other">Other</option>
                  </Select>
                  <Input label="File Format" value={item.file_format} onChange={e => setItemField(idx, 'file_format', e.target.value)} />
                  <Select label="License Type" value={item.license_type} onChange={e => setItemField(idx, 'license_type', e.target.value)}>
                    <option value="Personal Use">Personal Use</option>
                    <option value="Commercial Use">Commercial Use</option>
                    <option value="Extended License">Extended License</option>
                    <option value="Exclusive Rights">Exclusive Rights</option>
                  </Select>
                  <Input label="Qty" type="number" value={item.quantity} onChange={e => setItemField(idx, 'quantity', parseInt(e.target.value) || 0)} />
                  <Input label="Rate (₹) *" type="number" value={item.unit_price} onChange={e => setItemField(idx, 'unit_price', parseFloat(e.target.value) || 0)} />
                  <Input label="Disc %" type="number" value={item.discount_percent} onChange={e => setItemField(idx, 'discount_percent', parseFloat(e.target.value) || 0)} />
                  <Input label="GST %" type="number" value={item.gst_percent} onChange={e => setItemField(idx, 'gst_percent', parseFloat(e.target.value) || 0)} />
                  <div>
                    <label style={{ fontSize: '12px', color: '#6B7280', display: 'block' }}>Line Total</label>
                    <div style={{ padding: '8px 0', fontWeight: '700', fontSize: '14px' }}>{fmt(item.amount)}</div>
                  </div>
                  {form.items.length > 1 && (
                    <Btn type="button" variant="outline" style={{ alignSelf: 'center', borderColor: '#DC2626', color: '#DC2626', padding: '4px 8px' }} onClick={() => removeRow(idx)}>✕ Remove</Btn>
                  )}
                </Grid>
              </Card>
            ))}
          </div>

          <Grid cols={2} gap={10} style={{ borderTop: '1px solid #E5E7EB', paddingTop: '10px' }}>
            <Select label="Payment Mode" value={form.payment_mode} onChange={e => setForm({ ...form, payment_mode: e.target.value })}>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cash">Cash</option>
            </Select>
            <Select label="Payment Status" value={form.payment_status} onChange={e => setForm({ ...form, payment_status: e.target.value })}>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
            </Select>
          </Grid>

          <div style={{ marginTop: '10px', padding: '8px', backgroundColor: '#F9FAFB', borderRadius: '6px', textAlign: 'right' }}>
            <div style={{ fontSize: '12px' }}>Subtotal: {fmt(subtotal)}</div>
            <div style={{ fontSize: '12px' }}>Tax (GST): {fmt(tax)}</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginTop: '4px' }}>Total Amount: {fmt(total)}</div>
          </div>

          <Textarea label="Notes to Client" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <Select label="Document Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          <Textarea label="Internal Remark" value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} />

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setShowFormModal(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Digital Invoice'}
            </Btn>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmDelete 
        isOpen={deleteId !== null} 
        onClose={() => setDeleteId(null)} 
        onConfirm={confirmDelete} 
      />

    </div>
  );
}
