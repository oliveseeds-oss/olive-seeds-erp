import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../utils/AuthContext';
import { Card, PageHeader, Btn, Input, Select, Textarea, TableSkeleton, fmtDate, showToast, Modal } from '../components/UI';

export default function ChangeRequests() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [form, setForm] = useState({ module: 'customers', recordId: '', fieldName: '', currentValue: '', requestedValue: '', reason: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [reviewItem, setReviewItem] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const fetchChanges = async () => {
    setLoading(true);
    try {
      const res = await api.get('/changes');
      setRows(res.data.changes || res.data || []);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load change requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChanges();
  }, []);

  const validateForm = () => {
    const errs = {};
    if (!form.recordId) errs.recordId = 'This field is required';
    if (!form.fieldName.trim()) errs.fieldName = 'This field is required';
    if (!form.requestedValue.trim()) errs.requestedValue = 'This field is required';
    if (!form.reason.trim()) errs.reason = 'This field is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSaving(true);
    try {
      const payload = {
        module: form.module,
        record_id: parseInt(form.recordId) || 0,
        field_name: form.fieldName,
        current_value: form.currentValue,
        requested_value: form.requestedValue,
        reason: form.reason
      };
      await api.post('/changes', payload);
      showToast('Change request submitted successfully', 'success');
      setShowFormModal(false);
      setForm({ module: 'customers', recordId: '', fieldName: '', currentValue: '', requestedValue: '', reason: '' });
      fetchChanges();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to submit change request', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReviewAction = async (status) => {
    try {
      if (status === 'approved') {
        await api.patch(`/changes/${reviewItem.id}/approve`, { notes: reviewNotes });
        showToast('Change request approved and applied', 'success');
      } else {
        await api.patch(`/changes/${reviewItem.id}/reject`, { notes: reviewNotes });
        showToast('Change request rejected', 'success');
      }
      setReviewItem(null);
      setReviewNotes('');
      fetchChanges();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to complete review action', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px' }}>
      
      <PageHeader 
        title="Change Requests"
        actions={
          user?.role === 'viewer' || user?.role === 'employee' ? (
            <Btn variant="primary" onClick={() => { setForm({ module: 'customers', recordId: '', fieldName: '', currentValue: '', requestedValue: '', reason: '' }); setErrors({}); setShowFormModal(true); }}>
              + Request Change
            </Btn>
          ) : null
        }
      />

      {/* Guide Card */}
      <Card style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
        <div style={{ fontWeight: '700', color: '#111827', marginBottom: '6px' }}>Correction Requests Pipeline</div>
        <p style={{ fontSize: '13px', color: '#6B7280', margin: 0, lineHeight: '1.5' }}>
          Employees and Viewers can submit correction forms to fix mistakes in invoices, customers, and products. Administrators review and approve submissions, automatically updating the database.
        </p>
      </Card>

      {/* Data Table */}
      <Card style={{ padding: '0px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '1000px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left', color: '#6B7280' }}>
              <th style={{ padding: '12px 16px' }}>Module</th>
              <th style={{ padding: '12px 16px' }}>Record ID</th>
              <th style={{ padding: '12px 16px' }}>Field</th>
              <th style={{ padding: '12px 16px' }}>Current Value</th>
              <th style={{ padding: '12px 16px' }}>Requested Value</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Date Requested</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={8} rows={3} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>No change requests found.</td>
              </tr>
            ) : (
              rows.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827', textTransform: 'capitalize' }}>{row.module}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.record_id || row.recordId || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.field_name || row.fieldName || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#9CA3AF', textDecoration: 'line-through' }}>{row.current_value || row.currentValue || '-'}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>{row.requested_value || row.requestedValue}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`badge-status status-${row.status === 'pending' ? 'processing' : row.status === 'approved' ? 'completed' : 'failed'}`}>{row.status}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{fmtDate(row.created_at)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    {user?.role === 'admin' && row.status === 'pending' && (
                      <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => { setReviewItem(row); setReviewNotes(''); }}>
                        Review
                      </Btn>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Add Request Modal */}
      {showFormModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#FFF', borderRadius: '8px', width: '100%', maxWidth: '500px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 700 }}>Submit Correction / Change Request</h3>
            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <Select label="Target Module *" value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })}>
                  <option value="customers">Customers</option>
                  <option value="products">Products</option>
                  <option value="orders">Orders</option>
                  <option value="invoices">Invoices</option>
                </Select>
                <Input label="Record Database ID *" value={form.recordId} onChange={(e) => setForm({ ...form, recordId: e.target.value })} error={errors.recordId} />
                <Input label="Field Name to Change *" value={form.fieldName} onChange={(e) => setForm({ ...form, fieldName: e.target.value })} error={errors.fieldName} />
                <Input label="Current Value" value={form.currentValue} onChange={(e) => setForm({ ...form, currentValue: e.target.value })} />
                <Input label="Requested Value *" value={form.requestedValue} onChange={(e) => setForm({ ...form, requestedValue: e.target.value })} error={errors.requestedValue} />
                <Textarea label="Reason for Request *" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} error={errors.reason} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px', borderTop: '1px solid #E5E7EB', paddingTop: '16px' }}>
                <Btn variant="secondary" onClick={() => setShowFormModal(false)}>Cancel</Btn>
                <Btn variant="primary" type="submit" disabled={saving}>
                  {saving ? 'Submitting...' : 'Submit Request'}
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Review Modal */}
      {reviewItem && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#FFF', borderRadius: '8px', width: '100%', maxWidth: '500px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 700 }}>Review Change Request</h3>
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', marginBottom: '20px', backgroundColor: '#F9FAFB', padding: '14px', borderRadius: '6px' }}>
                <div><strong>Module:</strong> {reviewItem.module}</div>
                <div><strong>Record ID:</strong> {reviewItem.record_id || reviewItem.recordId || '-'}</div>
                <div><strong>Field Name:</strong> {reviewItem.field_name || reviewItem.fieldName || '-'}</div>
                <div><strong>Current Value:</strong> <span style={{ textDecoration: 'line-through', color: '#9CA3AF' }}>{reviewItem.current_value || reviewItem.currentValue || '-'}</span></div>
                <div><strong>Requested Value:</strong> <span style={{ fontWeight: '600', color: '#111827' }}>{reviewItem.requested_value || reviewItem.requestedValue}</span></div>
                <div><strong>Reason:</strong> {reviewItem.reason}</div>
              </div>
              
              <Textarea label="Review Notes / Remarks" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px', borderTop: '1px solid #E5E7EB', paddingTop: '16px' }}>
                <Btn variant="secondary" onClick={() => setReviewItem(null)}>Cancel</Btn>
                <Btn variant="danger" onClick={() => handleReviewAction('rejected')}>Reject</Btn>
                <Btn variant="primary" onClick={() => handleReviewAction('approved')}>Approve & Apply</Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
