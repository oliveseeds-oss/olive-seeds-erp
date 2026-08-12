import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../utils/AuthContext';
import { Card, PageHeader, Btn, Input, Select, Textarea, TableSkeleton, fmt, fmtDate, Modal, Grid } from '../components/UI';
import ConfirmDelete from '../components/ConfirmDelete';
import { downloadPDFBlob, fetchAsBase64, fetchImageAsBase64, buildQuotationHTML, openPrintWindow } from '../utils/printUtils';
import toast from 'react-hot-toast';

const EMPTY_ITEM = {
  product_name: '',
  description: '',
  size: '',
  quantity: 1,
  unit: 'pcs',
  unit_price: 0,
  discount_percent: 0,
  gst_percent: 18,
  amount: 0
};

const EMPTY_FORM = {
  quotation_title: '',
  quotation_date: new Date().toISOString().split('T')[0],
  valid_until: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  customer_id: '',
  customer_name: '',
  customer_email: '',
  customer_phone: '',
  customer_company: '',
  customer_gstin: '',
  billing_address: '',
  billing_city: '',
  billing_state: '',
  billing_pincode: '',
  items: [EMPTY_ITEM],
  shipping_estimate: 0,
  notes: '',
  terms: '',
  internal_notes: '',
  status: 'draft',
  remark: ''
};

export default function Quotations() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete State
  const [deleteId, setDeleteId] = useState(null);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/quotations');
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error('Failed to load quotations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();

    api.get('/customers')
      .then(res => setCustomers(Array.isArray(res.data) ? res.data : (res.data.customers || [])))
      .catch(() => {});

    api.get('/products')
      .then(res => setProducts(Array.isArray(res.data) ? res.data : (res.data.products || [])))
      .catch(() => {});
  }, []);

  const selectCustomer = (cid) => {
    const c = customers.find(x => String(x.id) === String(cid));
    if (c) {
      setForm(prev => ({
        ...prev,
        customer_id: cid,
        customer_name: c.name,
        customer_email: c.email || '',
        customer_phone: c.phone || '',
        customer_company: c.company_name || '',
        customer_gstin: c.gstin || '',
        billing_address: c.billing_address || '',
        billing_city: c.billing_city || '',
        billing_state: c.billing_state || '',
        billing_pincode: c.billing_pincode || ''
      }));
    }
  };

  const setItemField = (idx, key, val) => {
    const items = [...form.items];
    items[idx][key] = val;

    // Recalculate item amount
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

  const selectProductForItem = (idx, pid) => {
    const p = products.find(x => String(x.id) === String(pid));
    if (p) {
      const items = [...form.items];
      items[idx].product_id = p.id;
      items[idx].product_name = p.name;
      items[idx].unit_price = p.selling_price || 0;
      items[idx].gst_percent = p.gst_percent || 18;
      items[idx].size = p.size || '';
      
      const qty = parseFloat(items[idx].quantity) || 1;
      const rate = parseFloat(items[idx].unit_price) || 0;
      const disc = parseFloat(items[idx].discount_percent) || 0;
      items[idx].amount = (qty * rate) - ((qty * rate * disc) / 100);

      setForm({ ...form, items });
    }
  };

  const calcFormTotals = () => {
    let subtotal = 0;
    let tax = 0;
    (form.items || []).forEach(item => {
      const amt = parseFloat(item.amount) || 0;
      subtotal += amt;
      tax += amt * (parseFloat(item.gst_percent) || 0) / 100;
    });
    const total = subtotal + tax + parseFloat(form.shipping_estimate || 0);
    return { subtotal, tax, total };
  };

  const { subtotal, tax, total } = calcFormTotals();

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (saving) return;
    
    if (!form.customer_name.trim()) {
      toast.error('Customer name is required');
      return;
    }
    setSaving(true);
    
    // Normalize customer_id to null if empty
    const payload = {
      ...form,
      customer_id: form.customer_id ? parseInt(form.customer_id) : null
    };

    try {
      if (isEdit) {
        await api.put(`/quotations/${form.id}`, payload);
        toast.success('Quotation updated successfully');
      } else {
        await api.post('/quotations', payload);
        toast.success('Quotation created successfully');
      }
      setShowFormModal(false);
      fetchQuotations();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save quotation');
    } finally {
      setSaving(false);
    }
  };

  const triggerEdit = async (quo) => {
    try {
      const res = await api.get(`/quotations/${quo.id}`);
      setForm({
        ...res.data,
        quotation_title: res.data.quotation_title || '',
        billing_city: res.data.billing_city || '',
        billing_state: res.data.billing_state || '',
        billing_pincode: res.data.billing_pincode || '',
        items: res.data.items || [EMPTY_ITEM]
      });
      setIsEdit(true);
      setShowFormModal(true);
    } catch (err) {
      toast.error('Error loading quotation data');
    }
  };

  const handleConvertInvoice = async (id) => {
    if (!window.confirm('Convert this quotation to a Tax Invoice?')) return;
    try {
      const res = await api.post(`/quotations/${id}/convert-invoice`);
      toast.success(res.data.message || 'Converted successfully');
      fetchQuotations();
    } catch (err) {
      toast.error('Conversion failed');
    }
  };

  const handleConvertOrder = async (id) => {
    if (!window.confirm('Convert this quotation to a Production Order?')) return;
    try {
      const res = await api.post(`/quotations/${id}/convert-order`);
      toast.success(res.data.message || 'Converted successfully');
      fetchQuotations();
    } catch (err) {
      toast.error('Conversion failed');
    }
  };

  const [companySettings, setCompanySettings] = useState({});
  const [userSignaturePath, setUserSignaturePath] = useState(null);

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

  const handleDownloadPDF = async (id) => {
    try {
      const quo = rows.find(r => r.id === id);
      await downloadPDFBlob(api, `/quotations/${id}/pdf`, `Quotation-${quo?.quotation_number || id}.pdf`);
      toast.success('PDF downloaded successfully');
    } catch (e) {
      toast.error('Failed to download PDF');
    }
  };

  const handlePrint = async (id) => {
    try {
      const res = await api.get(`/quotations/${id}`);
      const quo = res.data;
      
      const logoBase64 = await fetchImageAsBase64(api, companySettings.logo_path || '/files/logo');
      const signatureBase64 = await fetchImageAsBase64(api, userSignaturePath || companySettings.default_signature_path);
      
      const dataToPrint = {
        ...quo,
        companyName: companySettings.company_name || 'OLIVE SEEDS | DESIGN STUDIO',
        companyPhone: companySettings.phone || '+91 94 42 94 33 94',
        companyEmail: companySettings.email || 'info@oliveseedsdesignstudio.com',
        companyWebsite: companySettings.website || 'https://www.oliveseedsdesignstudio.com',
        logoBase64,
        signatureBase64,
        staffName: user?.name || ''
      };
      
      const html = buildQuotationHTML(dataToPrint, companySettings, { name: user?.name }, logoBase64, signatureBase64);
      openPrintWindow(html);
    } catch (e) {
      toast.error('Error loading print template');
    }
  };

  const confirmDeleteQuo = async () => {
    try {
      await api.delete(`/quotations/${deleteId}`);
      setRows(prev => prev.filter(item => item.id !== deleteId));
      setDeleteId(null);
      toast.success('Quotation deleted successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
      setDeleteId(null);
    }
  };

  const filteredRows = rows.filter(item => {
    const matchesSearch = item.quotation_number?.toLowerCase().includes(search.toLowerCase()) || 
                          item.customer_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus ? item.status === filterStatus : true;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <PageHeader 
        title="Quotations"
        actions={
          <>
            {isAdmin && (
              <Btn variant="primary" onClick={() => { setForm(EMPTY_FORM); setIsEdit(false); setShowFormModal(true); }}>
                + Add Quotation
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
              placeholder="Search by quote no or customer..."
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
              {['draft', 'sent', 'accepted', 'rejected', 'expired'].map(s => (
                <option key={s} value={s}>{s.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Data Table */}
      <Card style={{ padding: '0px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Quote No</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Date</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Valid Until</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Customer</th>
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
                <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>No quotations found.</td>
              </tr>
            ) : (
              filteredRows.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>{row.quotation_number}</td>
                  <td style={{ padding: '12px 16px' }}>{fmtDate(row.quotation_date)}</td>
                  <td style={{ padding: '12px 16px' }}>{fmtDate(row.valid_until)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div>{row.customer_name}</div>
                    <div style={{ fontSize: '11px', color: '#6B7280' }}>{row.customer_email}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: '700' }}>{fmt(row.total)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`badge-status status-${row.status}`}>
                      {row.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handlePrint(row.id)}>
                        🖨️ Print
                      </Btn>
                      <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleDownloadPDF(row.id)}>
                        ⬇️ PDF
                      </Btn>
                      {row.status !== 'accepted' && (
                        <>
                          <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleConvertInvoice(row.id)}>
                            🧾 Invoice
                          </Btn>
                          <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleConvertOrder(row.id)}>
                            📦 Order
                          </Btn>
                        </>
                      )}
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
      <Modal open={showFormModal} onClose={() => setShowFormModal(false)} title={isEdit ? 'Edit Quotation' : 'Add Quotation'} width={640}>
        <form onSubmit={handleSave}>
          <Grid cols={2} gap={10}>
            <Input label="Quotation Date" type="date" value={form.quotation_date} onChange={e => setForm({ ...form, quotation_date: e.target.value })} />
            <Input label="Valid Until" type="date" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} />
          </Grid>
          
          <div style={{ marginTop: '10px' }}>
            <Input label="Quotation Title / Subject" placeholder="e.g. Monthly Social Media & Website Maintenance Package" value={form.quotation_title} onChange={e => setForm({ ...form, quotation_title: e.target.value })} />
          </div>

          <div style={{ margin: '14px 0', borderTop: '1px solid #E5E7EB', paddingTop: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#374151' }}>Client Selection</span>
            <Select label="Select Customer" value={form.customer_id} onChange={e => selectCustomer(e.target.value)}>
              <option value="">-- Manual Entry --</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Grid cols={2} gap={10} style={{ marginTop: '8px' }}>
              <Input label="Client Name" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} />
              <Input label="Client Email" type="email" value={form.customer_email} onChange={e => setForm({ ...form, customer_email: e.target.value })} />
              <Input label="Client Phone" value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} />
              <Input label="Client Company" value={form.customer_company} onChange={e => setForm({ ...form, customer_company: e.target.value })} />
            </Grid>
            
            <Textarea label="Billing Address" value={form.billing_address} onChange={e => setForm({ ...form, billing_address: e.target.value })} style={{ marginTop: '8px' }} />
            
            <Grid cols={3} gap={10} style={{ marginTop: '8px' }}>
              <Input label="Billing City" value={form.billing_city} onChange={e => setForm({ ...form, billing_city: e.target.value })} />
              <Input label="Billing State" value={form.billing_state} onChange={e => setForm({ ...form, billing_state: e.target.value })} />
              <Input label="Billing Pincode" value={form.billing_pincode} onChange={e => setForm({ ...form, billing_pincode: e.target.value })} />
            </Grid>
          </div>

          {/* Quotation Line Items */}
          <div style={{ margin: '14px 0', borderTop: '1px solid #E5E7EB', paddingTop: '10px' }}>
            <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#374151' }}>Quote Items</span>
              <Btn type="button" variant="outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={addRow}>+ Add Row</Btn>
            </div>

            {(form.items || []).map((item, idx) => (
              <Card key={idx} style={{ padding: '10px', marginBottom: '8px', border: '1px solid #E5E7EB' }}>
                <Grid cols={3} gap={8}>
                  <div>
                    <Select label="Select Product" onChange={e => selectProductForItem(idx, e.target.value)}>
                      <option value="">-- Choose or Type --</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                    <Input label="Item Name" value={item.product_name} onChange={e => setItemField(idx, 'product_name', e.target.value)} />
                  </div>
                  <Input label="Description" value={item.description} onChange={e => setItemField(idx, 'description', e.target.value)} />
                  <Input label="Size" value={item.size} onChange={e => setItemField(idx, 'size', e.target.value)} />
                  <Input label="Qty" type="number" value={item.quantity} onChange={e => setItemField(idx, 'quantity', parseInt(e.target.value) || 0)} />
                  <Input label="Rate (₹)" type="number" value={item.unit_price} onChange={e => setItemField(idx, 'unit_price', parseFloat(e.target.value) || 0)} />
                  <Input label="GST %" type="number" value={item.gst_percent} onChange={e => setItemField(idx, 'gst_percent', parseFloat(e.target.value) || 0)} />
                  <Input label="Disc %" type="number" value={item.discount_percent} onChange={e => setItemField(idx, 'discount_percent', parseFloat(e.target.value) || 0)} />
                  <div>
                    <label style={{ fontSize: '12px', color: '#6B7280', display: 'block' }}>Line Total</label>
                    <div style={{ padding: '8px 0', fontWeight: '700', fontSize: '14px' }}>{fmt(item.amount)}</div>
                  </div>
                  {(form.items || []).length > 1 && (
                    <Btn type="button" variant="outline" style={{ alignSelf: 'center', borderColor: '#DC2626', color: '#DC2626', padding: '4px 8px' }} onClick={() => removeRow(idx)}>✕ Remove</Btn>
                  )}
                </Grid>
              </Card>
            ))}
          </div>

          <Grid cols={2} gap={10} style={{ borderTop: '1px solid #E5E7EB', paddingTop: '10px' }}>
            <Input label="Shipping Estimate (₹)" type="number" value={form.shipping_estimate} onChange={e => setForm({ ...form, shipping_estimate: parseFloat(e.target.value) || 0 })} />
            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
            </Select>
          </Grid>

          <div style={{ marginTop: '10px', padding: '8px', backgroundColor: '#F9FAFB', borderRadius: '6px', textAlign: 'right' }}>
            <div style={{ fontSize: '12px' }}>Subtotal: {fmt(subtotal)}</div>
            <div style={{ fontSize: '12px' }}>Tax (GST): {fmt(tax)}</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginTop: '4px' }}>Total Estimate: {fmt(total)}</div>
          </div>

          <Textarea label="Notes to Client" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <Textarea label="Terms & Conditions" value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })} />

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setShowFormModal(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Quotation'}
            </Btn>
          </div>
        </form>
      </Modal>

      <ConfirmDelete 
        open={deleteId !== null} 
        onClose={() => setDeleteId(null)} 
        onConfirm={confirmDeleteQuo} 
        title="Delete Quotation"
        message="Are you sure you want to delete this quotation? This action is permanent."
      />

    </div>
  );
}
