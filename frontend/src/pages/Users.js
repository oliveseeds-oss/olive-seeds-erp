import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../utils/AuthContext';
import { Card, PageHeader, Btn, Input, Select, TableSkeleton, fmtDate, showToast, Modal } from '../components/UI';
import ConfirmDelete from '../components/ConfirmDelete';

export default function Users() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'viewer', phone: '', signature_path: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setRows(res.data);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [user]);

  const validateForm = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'This field is required';
    if (!form.email.trim()) errs.email = 'This field is required';
    if (!editId && !form.password) errs.password = 'This field is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/users/${editId}`, form);
        showToast('User saved successfully', 'success');
      } else {
        await api.post('/users', form);
        showToast('User saved successfully', 'success');
      }
      setShowFormModal(false);
      setForm({ name: '', email: '', password: '', role: 'viewer', phone: '', signature_path: '' });
      setEditId(null);
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save user', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSignatureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !editId) return;
    const formData = new FormData();
    formData.append('signature', file);
    try {
      const res = await api.post(`/users/${editId}/signature`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setForm(prev => ({ ...prev, signature_path: res.data.signature_path }));
      showToast('Signature uploaded successfully', 'success');
      fetchUsers();
    } catch (err) {
      showToast('Signature upload failed', 'error');
    }
  };

  const removeSignature = async () => {
    try {
      await api.put(`/users/${editId}`, { ...form, remove_signature: 'true' });
      setForm(prev => ({ ...prev, signature_path: '' }));
      showToast('Signature removed', 'success');
      fetchUsers();
    } catch (err) {
      showToast('Signature removal failed', 'error');
    }
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/users/${deleteId}`);
      setRows(prev => prev.filter(item => item.id !== deleteId));
      setDeleteId(null);
      showToast('Deleted successfully', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Delete failed', 'error');
      setDeleteId(null);
    }
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <PageHeader 
        title="Users"
        actions={
          user?.role === 'admin' ? (
            <Btn variant="primary" onClick={() => { setForm({ name: '', email: '', password: '', role: 'viewer', phone: '', signature_path: '' }); setEditId(null); setErrors({}); setShowFormModal(true); }}>
              + Add User
            </Btn>
          ) : null
        }
      />

      {/* Data Table */}
      <Card style={{ padding: '0px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Name</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Email</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Phone</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Role</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Last Login</th>
              {user?.role === 'admin' && <th style={{ padding: '12px 16px', color: '#6B7280', textAlign: 'right' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={6} rows={3} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>No users found.</td>
              </tr>
            ) : (
              rows.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>{row.name}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.email}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.phone || '-'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className="badge-status status-completed">{row.role}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.last_login ? fmtDate(row.last_login) : 'Never'}</td>
                  {user?.role === 'admin' && (
                    <td style={{ padding: '12px 16px', textAlign: 'right', display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                      {!['USR001', 'USR002', 'USR003'].includes(row.user_id) ? (
                        <>
                          <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => { setForm(row); setEditId(row.id); setErrors({}); setShowFormModal(true); }}>
                            Edit
                          </Btn>
                          {row.id !== user.id && (
                            <Btn variant="danger" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => setDeleteId(row.id)}>
                              Delete
                            </Btn>
                          )}
                        </>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>System Reserved</span>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )
          }</tbody>
        </table>
      </Card>

      {/* Add/Edit Modal */}
      <Modal open={showFormModal} onClose={() => setShowFormModal(false)} title={editId ? 'Edit User' : 'Add User'} width={500}>
        <form onSubmit={handleSave}>
          <Input label="Full Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
          <Input label="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
          <Input label={editId ? 'Password (leave empty to keep same)' : 'Password *'} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password} />
          <Input label="Phone Number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="admin">Admin</option>
            <option value="employee">Employee</option>
            <option value="viewer">Viewer</option>
          </Select>

          {editId && (
            <div style={{ marginTop: '16px', borderTop: '1px solid #E5E7EB', paddingTop: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Digital Signature</label>
              <span style={{ display: 'block', fontSize: '11px', color: '#6B7280', marginBottom: '8px' }}>Upload signature image (PNG with transparent bg recommended)</span>
              {form.signature_path ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <img src={form.signature_path} style={{ maxHeight: '60px', border: '1px solid #E5E7EB', padding: '4px' }} alt="User Signature" />
                  <Btn type="button" variant="danger" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={removeSignature}>Remove Signature</Btn>
                </div>
              ) : (
                <input type="file" accept=".png,.jpg,.jpeg" onChange={handleSignatureUpload} style={{ display: 'block', marginBottom: '12px' }} />
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
            <Btn variant="secondary" onClick={() => setShowFormModal(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Btn>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmDelete isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={confirmDelete} />
    </div>
  );
}
