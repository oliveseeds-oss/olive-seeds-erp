import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Card, PageHeader, Btn, Table, Modal, Input, Select, Textarea, Badge, Spinner, fmtDate } from '../components/UI';
import { useAuth } from '../utils/AuthContext';

export default function ChangeRequests() {
  const { isAdmin, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [reviewModal, setReviewModal] = useState(null);
  const [form, setForm] = useState({ module: '', record_id: '', field_name: '', current_value: '', requested_value: '', reason: '' });
  const [reviewNotes, setReviewNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try { const { data } = await api.get('/changes'); setRows(data || []); } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.module || !form.reason) return toast.error('Module and reason required');
    setSaving(true);
    try {
      await api.post('/changes', form);
      toast.success('Change request submitted to admin ✅');
      setShowModal(false); setForm({ module: '', record_id: '', field_name: '', current_value: '', requested_value: '', reason: '' }); fetch();
    } catch (e) { toast.error('Error'); }
    setSaving(false);
  };

  const approve = async () => {
    try { await api.patch(`/changes/${reviewModal.id}/approve`, { notes: reviewNotes }); toast.success('Change approved and applied ✅'); setReviewModal(null); fetch(); }
    catch (e) { toast.error(e.response?.data?.error || 'Error applying change'); }
  };

  const reject = async () => {
    try { await api.patch(`/changes/${reviewModal.id}/reject`, { notes: reviewNotes }); toast.success('Change request rejected'); setReviewModal(null); fetch(); }
    catch (e) { toast.error('Error'); }
  };

  const statusColor = { pending: 'yellow', approved: 'green', rejected: 'red' };

  const cols = [
    { label: 'ID', render: r => <span style={{ fontSize: 12, color: 'var(--muted)' }}>#{r.id}</span> },
    { label: 'Requested By', key: 'requester_name' },
    { label: 'Module', render: r => <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{r.module}</span> },
    { label: 'Record ID', key: 'record_id' },
    { label: 'Field', key: 'field_name' },
    { label: 'Current Value', render: r => <span style={{ fontSize: 12, color: 'var(--muted)' }}>{r.current_value || '-'}</span> },
    { label: 'Requested Value', render: r => <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>{r.requested_value || '-'}</span> },
    { label: 'Reason', render: r => <span style={{ fontSize: 12 }}>{r.reason}</span> },
    { label: 'Status', render: r => <Badge color={statusColor[r.status] || 'gray'}>{r.status}</Badge> },
    { label: 'Date', render: r => <span style={{ fontSize: 12 }}>{fmtDate(r.created_at)}</span> },
    { label: 'Actions', render: r => isAdmin && r.status === 'pending' && (
      <Btn size="sm" onClick={() => { setReviewModal(r); setReviewNotes(''); }}>🔍 Review</Btn>
    )}
  ];

  return (
    <div>
      <PageHeader title="✏️ Change Requests" subtitle="Employee correction requests to admin"
        actions={!isAdmin && <Btn onClick={() => setShowModal(true)}>➕ Submit Change Request</Btn>} />

      <Card style={{ marginBottom: 16, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>ℹ️ How Change Requests Work</h3>
        <p style={{ fontSize: 13, color: '#1e3a8a', lineHeight: 1.6 }}>
          <strong>Employees</strong> cannot edit existing records. If a mistake was made (wrong price, typo, wrong quantity), submit a change request here.<br />
          <strong>Admin</strong> will review and approve/reject. Approved changes are applied automatically to the database.
        </p>
      </Card>

      <Card>{loading ? <Spinner /> : <Table cols={cols} rows={rows} emptyMsg="No change requests yet" />}</Card>

      {/* Submit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Submit Change Request" width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Select label="Module *" value={form.module} onChange={e => sf('module', e.target.value)}>
            <option value="">Select module...</option>
            {['orders', 'customers', 'products', 'invoices', 'payments', 'expenses', 'order_items'].map(m =>
              <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
          </Select>
          <Input label="Record ID" value={form.record_id} onChange={e => sf('record_id', e.target.value)} placeholder="e.g. 42 (the database ID)" />
          <Input label="Field Name" value={form.field_name} onChange={e => sf('field_name', e.target.value)} placeholder="e.g. total, customer_name, status" />
          <Input label="Current (Wrong) Value" value={form.current_value} onChange={e => sf('current_value', e.target.value)} />
          <Input label="Correct Value Requested" value={form.requested_value} onChange={e => sf('requested_value', e.target.value)} />
          <Textarea label="Reason for Change *" value={form.reason} onChange={e => sf('reason', e.target.value)} placeholder="Explain why this change is needed..." />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Btn variant="ghost" onClick={() => setShowModal(false)}>Cancel</Btn>
            <Btn onClick={submit} disabled={saving}>{saving ? 'Submitting...' : '📨 Submit to Admin'}</Btn>
          </div>
        </div>
      </Modal>

      {/* Review Modal */}
      <Modal open={!!reviewModal} onClose={() => setReviewModal(null)} title="Review Change Request" width={500}>
        {reviewModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[['Module', reviewModal.module], ['Record ID', reviewModal.record_id], ['Field', reviewModal.field_name], ['Current Value', reviewModal.current_value], ['Requested Value', reviewModal.requested_value], ['Reason', reviewModal.reason]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{l}:</span>
                <span style={{ fontWeight: l === 'Requested Value' ? 700 : 400, color: l === 'Requested Value' ? 'var(--primary)' : 'inherit' }}>{v || '-'}</span>
              </div>
            ))}
            <Textarea label="Review Notes (optional)" value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} placeholder="Add a note about your decision..." />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn variant="ghost" onClick={() => setReviewModal(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={reject}>❌ Reject</Btn>
              <Btn variant="success" onClick={approve}>✅ Approve & Apply</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
