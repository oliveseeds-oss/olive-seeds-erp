import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Card, PageHeader, Btn, Table, Modal, Grid, Input, Select, Badge, Spinner, fmtDate } from '../components/UI';

export default function Users() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'viewer', phone: '' });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try { const { data } = await api.get('/users'); setRows(data || []); } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openNew = () => { setForm({ name: '', email: '', password: '', role: 'viewer', phone: '' }); setEditId(null); setShowModal(true); };
  const openEdit = (r) => { setForm({ name: r.name, email: r.email, password: '', role: r.role, phone: r.phone || '', is_active: r.is_active }); setEditId(r.id); setShowModal(true); };

  const save = async () => {
    if (!form.name || !form.email) return toast.error('Name and email required');
    if (!editId && !form.password) return toast.error('Password required for new user');
    setSaving(true);
    try {
      if (editId) await api.put(`/users/${editId}`, form);
      else await api.post('/users', form);
      toast.success(editId ? 'User updated' : 'User created');
      setShowModal(false); fetch();
    } catch (e) { toast.error(e.response?.data?.error || 'Error'); }
    setSaving(false);
  };

  const toggleActive = async (u) => {
    try {
      await api.put(`/users/${u.id}`, { ...u, is_active: u.is_active ? 0 : 1 });
      toast.success(u.is_active ? 'User deactivated' : 'User activated'); fetch();
    } catch (e) { toast.error('Error'); }
  };

  const roleColor = { admin: 'purple', employee: 'blue', viewer: 'gray' };

  const cols = [
    { label: 'User ID', key: 'user_id' },
    { label: 'Name', render: r => <div><div style={{ fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.email}</div></div> },
    { label: 'Role', render: r => <Badge color={roleColor[r.role] || 'gray'}>{r.role.toUpperCase()}</Badge> },
    { label: 'Phone', key: 'phone' },
    { label: 'Status', render: r => <Badge color={r.is_active ? 'green' : 'red'}>{r.is_active ? 'Active' : 'Inactive'}</Badge> },
    { label: 'Last Login', render: r => <span style={{ fontSize: 12 }}>{r.last_login ? fmtDate(r.last_login) : 'Never'}</span> },
    { label: 'Actions', render: r => (
      <div style={{ display: 'flex', gap: 6 }}>
        <Btn size="sm" variant="outline" onClick={() => openEdit(r)}>✏️ Edit</Btn>
        <Btn size="sm" variant={r.is_active ? 'danger' : 'success'} onClick={() => toggleActive(r)}>
          {r.is_active ? '🔒 Disable' : '✅ Enable'}
        </Btn>
      </div>
    )}
  ];

  return (
    <div>
      <PageHeader title="👤 User Management" subtitle="Manage system users and permissions"
        actions={<Btn onClick={openNew}>➕ Add User</Btn>} />

      <Card style={{ marginBottom: 16, background: '#f0fdf4', border: '1px solid #86efac' }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#166534', marginBottom: 8 }}>🔐 Role Permissions</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, fontSize: 12 }}>
          {[
            { role: '👑 Admin', color: '#7c3aed', perms: ['✅ Create orders & records', '✅ Edit any record', '✅ Delete records', '✅ Manage users', '✅ All reports', '✅ Settings'] },
            { role: '👨‍💼 Employee', color: '#2563eb', perms: ['✅ Create new orders', '✅ Add customers/products', '❌ Cannot edit records', '📨 Submit change requests', '✅ View all data', '❌ No user management'] },
            { role: '👁️ Viewer', color: '#6b7280', perms: ['✅ View dashboard', '✅ View all data', '❌ Cannot create', '❌ Cannot edit', '❌ Cannot delete', '❌ Read-only access'] },
          ].map(({ role, color, perms }) => (
            <div key={role} style={{ padding: 12, background: '#fff', borderRadius: 8, border: `1px solid ${color}30` }}>
              <div style={{ fontWeight: 700, color, marginBottom: 8, fontSize: 13 }}>{role}</div>
              {perms.map(p => <div key={p} style={{ padding: '2px 0', color: p.startsWith('❌') ? '#dc2626' : '#166534' }}>{p}</div>)}
            </div>
          ))}
        </div>
      </Card>

      <Card>{loading ? <Spinner /> : <Table cols={cols} rows={rows} emptyMsg="No users found" />}</Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit User' : 'New User'} width={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input label="Full Name *" value={form.name} onChange={e => sf('name', e.target.value)} />
          <Input label="Email *" type="email" value={form.email} onChange={e => sf('email', e.target.value)} />
          <Input label={editId ? 'New Password (leave blank to keep)' : 'Password *'} type="password" value={form.password} onChange={e => sf('password', e.target.value)} />
          <Input label="Phone" value={form.phone} onChange={e => sf('phone', e.target.value)} />
          <Select label="Role *" value={form.role} onChange={e => sf('role', e.target.value)}>
            <option value="admin">👑 Admin — Full Access</option>
            <option value="employee">👨‍💼 Employee — Create Only</option>
            <option value="viewer">👁️ Viewer — Read Only</option>
          </Select>
          {editId && (
            <Select label="Status" value={form.is_active !== undefined ? String(form.is_active) : '1'} onChange={e => sf('is_active', parseInt(e.target.value))}>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </Select>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Btn variant="ghost" onClick={() => setShowModal(false)}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving...' : '💾 Save User'}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
