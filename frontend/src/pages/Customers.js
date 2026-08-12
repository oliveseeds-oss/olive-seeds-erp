import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../utils/AuthContext';
import { Card, PageHeader, Btn, Input, Select, Textarea, TableSkeleton, fmt, showToast, Modal, Grid } from '../components/UI';
import ImportModal from '../components/ImportModal';
import ConfirmDelete from '../components/ConfirmDelete';

const EMPTY = {
  name: '', customer_type: 'personal', company_name: '', gstin: '', pan: '', email: '', phone: '', alt_phone: '',
  billing_address: '', billing_city: '', billing_state: '', billing_pincode: '', billing_country: 'India',
  shipping_address: '', shipping_city: '', shipping_state: '', shipping_pincode: '', shipping_country: 'India',
  currency: 'INR', language: 'English', customer_group: '', credit_limit: 0, outstanding_balance: 0, notes: '',
  alternate_phone: ''
};

export default function Customers() {
  const { user, canWrite, canModify, isEmployee } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  // Change request modal
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [changeForm, setChangeForm] = useState({ field: '', current: '', requested: '', reason: '' });
  const [targetRecord, setTargetRecord] = useState(null);

  // Import Modal
  const [importOpen, setImportOpen] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/customers');
      setRows(res.data.customers || res.data || []);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const validateForm = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'This field is required';
    if (!form.phone.trim()) {
      errs.phone = 'This field is required';
    } else if (form.phone.replace(/[^0-9]/g, '').length < 10) {
      errs.phone = 'Enter a valid phone number';
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Enter a valid email address';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/customers/${editId}`, form);
        showToast('Customer saved successfully', 'success');
      } else {
        await api.post('/customers', form);
        showToast('Customer saved successfully', 'success');
      }
      setShowFormModal(false);
      setForm(EMPTY);
      setEditId(null);
      fetchCustomers();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteCustomer = async () => {
    try {
      await api.delete(`/customers/${deleteId}`);
      setRows(prev => prev.filter(item => item.id !== deleteId));
      setDeleteId(null);
      showToast('Customer deleted successfully', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete customer', 'error');
      setDeleteId(null);
    }
  };

  const handleDetailedExport = async () => {
    try {
      const { exportToCSV } = await import('../utils/exportUtils');
      const today = new Date().toISOString().split('T')[0];
      exportToCSV(filteredRows, `OliveSeeds_Customers_${today}.csv`);
    } catch (err) {
      showToast('Export failed', 'error');
    }
  };

  const handleRequestChangeSubmit = async () => {
    try {
      const payload = {
        module: 'customers',
        recordId: targetRecord.id,
        fieldName: changeForm.field,
        currentValue: changeForm.current,
        requestedValue: changeForm.requested,
        reason: changeForm.reason
      };
      await api.post('/changes', payload);
      showToast('Change request submitted successfully', 'success');
      setShowChangeModal(false);
      setChangeForm({ field: '', current: '', requested: '', reason: '' });
      setTargetRecord(null);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to submit request', 'error');
    }
  };

  const filteredRows = rows.filter(item => {
    const nameStr = item.name || '';
    const phoneStr = item.phone || '';
    const matchesSearch = nameStr.toLowerCase().includes(search.toLowerCase()) || 
                          phoneStr.includes(search);
    const matchesType = filterType ? item.customer_type === filterType : true;
    return matchesSearch && matchesType;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <PageHeader 
        title="Customers"
        actions={
          <>
            {user?.role === 'admin' && (
              <Btn variant="primary" onClick={() => { setForm(EMPTY); setEditId(null); setErrors({}); setShowFormModal(true); }}>
                + Add Customer
              </Btn>
            )}
            {(user?.role === 'admin' || user?.role === 'employee') && (
              <Btn variant="outline" onClick={() => setImportOpen(true)}>
                📤 Upload CSV
              </Btn>
            )}
          </>
        }
      />

      {/* Filter Bar */}
      <Card style={{ padding: '12px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '240px' }}>
            <input 
              type="text"
              placeholder="Search by name or phone..."
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
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                backgroundColor: '#FFFFFF',
                color: '#111827'
              }}
            >
              <option value="">All Types</option>
              <option value="personal">Personal</option>
              <option value="business">Business</option>
              <option value="wholesale">Wholesale</option>
              <option value="corporate">Corporate</option>
              <option value="international">International</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Btn variant="outline" onClick={handleDetailedExport}>
              📤 Export CSV
            </Btn>
            {canWrite && (
              <Btn variant="outline" onClick={() => setImportOpen(true)}>Import CSV</Btn>
            )}
          </div>
        </div>
      </Card>

      {/* Data Table */}
      <Card style={{ padding: '0px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Customer ID</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Name</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Company</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>GSTIN</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Phone</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Email</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Outstanding Balance</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Type</th>
              <th style={{ padding: '12px 16px', color: '#6B7280', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={9} rows={5} />
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>No customers found.</td>
              </tr>
            ) : (
              filteredRows.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>{row.customer_id}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>{row.name}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.company_name || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.gstin || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.phone}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.email}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '700', color: parseFloat(row.outstanding_balance) > 0 ? '#DC2626' : '#16A34A' }}>
                    {fmt(row.outstanding_balance)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className="badge-status status-processing">{row.customer_type}</span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      {canModify && (
                        <>
                          <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => { setForm(row); setEditId(row.id); setErrors({}); setShowFormModal(true); }}>
                            Edit
                          </Btn>
                          <Btn variant="danger" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => setDeleteId(row.id)}>
                            Delete
                          </Btn>
                        </>
                      )}
                      {isEmployee && (
                        <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => { setTargetRecord(row); setChangeForm({ field: 'name', current: row.name, requested: '', reason: '' }); setShowChangeModal(true); }}>
                          Request Change
                        </Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Add/Edit Modal */}
      <Modal open={showFormModal} onClose={() => setShowFormModal(false)} title={editId ? 'Edit Customer' : 'Add Customer'} width={700}>
        <form onSubmit={handleSave}>
          <Grid cols={2} gap={12}>
            <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
            <Select label="Customer Type" value={form.customer_type} onChange={(e) => setForm({ ...form, customer_type: e.target.value })}>
              <option value="personal">Personal</option>
              <option value="business">Business</option>
              <option value="wholesale">Wholesale</option>
              <option value="corporate">Corporate</option>
              <option value="international">International</option>
            </Select>
            <Input label="Company Name" value={form.company_name || ''} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            <Input label="GSTIN" value={form.gstin || ''} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
            <Input label="PAN" value={form.pan || ''} onChange={(e) => setForm({ ...form, pan: e.target.value })} />
            <Input label="Email" type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
            <Input label="Phone *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} />
            <Input label="Alt Phone" value={form.alt_phone || ''} onChange={(e) => setForm({ ...form, alt_phone: e.target.value })} />
            <Input label="Alternate Phone 2" value={form.alternate_phone || ''} onChange={(e) => setForm({ ...form, alternate_phone: e.target.value })} />
            <Input label="Credit Limit (₹)" type="number" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: parseFloat(e.target.value) || 0 })} />
            <Input label="Outstanding Balance (₹)" type="number" value={form.outstanding_balance} onChange={(e) => setForm({ ...form, outstanding_balance: parseFloat(e.target.value) || 0 })} />
            <Input label="Currency" value={form.currency || 'INR'} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            <Input label="Language" value={form.language || 'English'} onChange={(e) => setForm({ ...form, language: e.target.value })} />
            <Input label="Customer Group" value={form.customer_group || ''} onChange={(e) => setForm({ ...form, customer_group: e.target.value })} />
          </Grid>
          <div style={{ marginTop: '10px' }}>
            <Textarea label="Billing Address" value={form.billing_address || ''} onChange={(e) => setForm({ ...form, billing_address: e.target.value })} />
            <Grid cols={3} gap={10} style={{ marginTop: '6px' }}>
              <Input label="Billing City" value={form.billing_city || ''} onChange={(e) => setForm({ ...form, billing_city: e.target.value })} />
              <Input label="Billing State" value={form.billing_state || ''} onChange={(e) => setForm({ ...form, billing_state: e.target.value })} />
              <Input label="Billing Pincode" value={form.billing_pincode || ''} onChange={(e) => setForm({ ...form, billing_pincode: e.target.value })} />
            </Grid>
          </div>
          <div style={{ marginTop: '10px' }}>
            <Textarea label="Shipping Address" value={form.shipping_address || ''} onChange={(e) => setForm({ ...form, shipping_address: e.target.value })} />
            <Grid cols={3} gap={10} style={{ marginTop: '6px' }}>
              <Input label="Shipping City" value={form.shipping_city || ''} onChange={(e) => setForm({ ...form, shipping_city: e.target.value })} />
              <Input label="Shipping State" value={form.shipping_state || ''} onChange={(e) => setForm({ ...form, shipping_state: e.target.value })} />
              <Input label="Shipping Pincode" value={form.shipping_pincode || ''} onChange={(e) => setForm({ ...form, shipping_pincode: e.target.value })} />
            </Grid>
          </div>
          <div style={{ marginTop: '10px' }}>
            <Textarea label="Internal Notes" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
            <Btn variant="secondary" onClick={() => setShowFormModal(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Btn>
          </div>
        </form>
      </Modal>

      {/* Change Request Modal */}
      <Modal open={showChangeModal} onClose={() => setShowChangeModal(false)} title="Submit Change Request" width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Select label="Field to Change" value={changeForm.field} onChange={(e) => setChangeForm({ ...changeForm, field: e.target.value, current: targetRecord[e.target.value] || '' })}>
            <option value="name">Name</option>
            <option value="phone">Phone</option>
            <option value="email">Email</option>
            <option value="gstin">GSTIN</option>
            <option value="billing_address">Billing Address</option>
          </Select>
          <Input label="Current Value" value={changeForm.current} disabled />
          <Input label="Requested Value" value={changeForm.requested} onChange={(e) => setChangeForm({ ...changeForm, requested: e.target.value })} />
          <Textarea label="Reason for Change" value={changeForm.reason} onChange={(e) => setChangeForm({ ...changeForm, reason: e.target.value })} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
            <Btn variant="secondary" onClick={() => setShowChangeModal(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleRequestChangeSubmit}>Submit</Btn>
          </div>
        </div>
      </Modal>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onImportSuccess={fetchCustomers} schemaKey="customers" />

      <ConfirmDelete 
        isOpen={deleteId !== null} 
        onClose={() => setDeleteId(null)} 
        onConfirm={confirmDeleteCustomer} 
      />
    </div>
  );
}
