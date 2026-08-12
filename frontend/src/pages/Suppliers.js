import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../utils/AuthContext';
import { Card, PageHeader, Btn, Input, Select, Textarea, TableSkeleton, showToast, Modal } from '../components/UI';
import ExportButton from '../components/ExportButton';
import ImportModal from '../components/ImportModal';

const EMPTY = { name: '', company_name: '', gstin: '', email: '', phone: '', address: '', city: '', state: '' };

export default function Suppliers() {
  const { user, canWrite, canModify, isEmployee } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);

  // Change request modal
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [changeForm, setChangeForm] = useState({ field: '', current: '', requested: '', reason: '' });
  const [targetRecord, setTargetRecord] = useState(null);

  // Import Modal
  const [importOpen, setImportOpen] = useState(false);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/suppliers');
      setRows(res.data.suppliers || res.data || []);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load suppliers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
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
    if (editId && !window.confirm('Are you sure you want to update this supplier?')) return;
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/suppliers/${editId}`, form);
        showToast('Supplier saved successfully', 'success');
      } else {
        await api.post('/suppliers', form);
        showToast('Supplier saved successfully', 'success');
      }
      setShowFormModal(false);
      setForm(EMPTY);
      setEditId(null);
      fetchSuppliers();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save supplier', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this supplier?')) return;
    try {
      await api.delete(`/suppliers/${id}`);
      showToast('Supplier deleted successfully', 'success');
      fetchSuppliers();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete supplier', 'error');
    }
  };

  const handleRequestChangeSubmit = async () => {
    try {
      const payload = {
        module: 'suppliers',
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

  const filteredRows = rows.filter(item => 
    item.name?.toLowerCase().includes(search.toLowerCase()) || 
    (item.phone && item.phone.includes(search))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <PageHeader 
        title="Suppliers"
        actions={
          <>
            {user?.role === 'admin' && (
              <Btn variant="primary" onClick={() => { setForm(EMPTY); setEditId(null); setErrors({}); setShowFormModal(true); }}>
                + Add Supplier
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

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <ExportButton data={filteredRows} pageName="Suppliers" />
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
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Name</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Phone</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Email</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>City</th>
              <th style={{ padding: '12px 16px', color: '#6B7280', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={5} rows={5} />
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>No suppliers found.</td>
              </tr>
            ) : (
              filteredRows.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>{row.name}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.phone}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.email}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.city}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      {canModify && (
                        <>
                          <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => { setForm(row); setEditId(row.id); setErrors({}); setShowFormModal(true); }}>
                            Edit
                          </Btn>
                          <Btn variant="danger" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleDelete(row.id)}>
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
      <Modal open={showFormModal} onClose={() => setShowFormModal(false)} title={editId ? 'Edit Supplier' : 'Add Supplier'} width={640}>
        <form onSubmit={handleSave}>
          <Input label="Supplier Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
          <Input label="Company Name" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          <Input label="GSTIN" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
          <div style={{ display: 'flex', gap: '10px' }}>
            <Input label="Phone *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
          </div>
          <Textarea label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div style={{ display: 'flex', gap: '10px' }}>
            <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Input label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
            <Btn variant="secondary" onClick={() => setShowFormModal(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Btn>
          </div>
        </form>
      </Modal>

      {/* Employee Change Request Modal */}
      <Modal open={showChangeModal} onClose={() => setShowChangeModal(false)} title="Submit Change Request">
        <div>
          <Input label="Module" value="Suppliers" disabled />
          <Input label="Record ID" value={targetRecord?.id || ''} disabled />
          <Select label="Field to change" value={changeForm.field} onChange={(e) => setChangeForm({ ...changeForm, field: e.target.value })}>
            <option value="name">Supplier Name</option>
            <option value="phone">Phone</option>
            <option value="email">Email</option>
            <option value="address">Address</option>
          </Select>
          <Input label="Current Value" value={changeForm.current} disabled />
          <Input label="Requested Value *" value={changeForm.requested} onChange={(e) => setChangeForm({ ...changeForm, requested: e.target.value })} />
          <Textarea label="Reason *" value={changeForm.reason} onChange={(e) => setChangeForm({ ...changeForm, reason: e.target.value })} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
            <Btn variant="secondary" onClick={() => setShowChangeModal(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleRequestChangeSubmit}>Submit Request</Btn>
          </div>
        </div>
      </Modal>

      {/* CSV Import Modal */}
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} entityName="suppliers" onImportSuccess={fetchSuppliers} />
    </div>
  );
}
