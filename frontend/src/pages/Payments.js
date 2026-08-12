import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../utils/AuthContext';
import { Card, PageHeader, Btn, Input, Select, Textarea, TableSkeleton, fmt, fmtDate, showToast, Modal, Grid } from '../components/UI';
import ImportModal from '../components/ImportModal';
import ConfirmDelete from '../components/ConfirmDelete';

export default function Payments() {
  const { user, canWrite, canModify } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMethod, setFilterMethod] = useState('');

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [form, setForm] = useState({
    invoice_id: '',
    invoice_number: '',
    amount_paid: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    transaction_reference: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/payments');
      setRows(res.data.payments || res.data || []);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load payments', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.invoice_number || form.amount_paid <= 0) {
      showToast('Invoice number and amount paid are required', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/payments', form);
      showToast('Payment recorded successfully', 'success');
      setShowFormModal(false);
      setForm({
        invoice_id: '',
        invoice_number: '',
        amount_paid: 0,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash',
        transaction_reference: '',
        notes: ''
      });
      fetchPayments();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to record payment', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeletePayment = async () => {
    try {
      await api.delete(`/payments/${deleteId}`);
      setRows(prev => prev.filter(item => item.id !== deleteId));
      setDeleteId(null);
      showToast('Payment record deleted successfully', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Delete failed', 'error');
      setDeleteId(null);
    }
  };

  const handleDetailedExport = async () => {
    try {
      const { exportToCSV } = await import('../utils/exportUtils');
      const today = new Date().toISOString().split('T')[0];
      exportToCSV(filteredRows, `OliveSeeds_Payments_${today}.csv`);
    } catch (err) {
      showToast('Export failed', 'error');
    }
  };

  const filteredRows = rows.filter(item => {
    const invNo = item.invoice_number || '';
    const custName = item.customer_name || '';
    const matchesSearch = invNo.toLowerCase().includes(search.toLowerCase()) || 
                          custName.toLowerCase().includes(search.toLowerCase());
    const matchesMethod = filterMethod ? item.payment_method === filterMethod : true;
    return matchesSearch && matchesMethod;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <PageHeader 
        title="Payments"
        actions={
          <>
            {user?.role === 'admin' && (
              <Btn variant="primary" onClick={() => setShowFormModal(true)}>
                Record Payment
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
              placeholder="Search by invoice or customer..."
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
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                backgroundColor: '#FFFFFF',
                color: '#111827'
              }}
            >
              <option value="">All Methods</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="bank">Bank Transfer</option>
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
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Receipt No</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Invoice No</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Customer</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Amount Paid</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Method</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Transaction Reference</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Payment Date</th>
              <th style={{ padding: '12px 16px', color: '#6B7280', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={8} rows={5} />
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>No payments found.</td>
              </tr>
            ) : (
              filteredRows.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>{row.payment_id}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>{row.invoice_number}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.customer_name || '-'}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '700', color: '#16A34A' }}>{fmt(row.amount_paid)}</td>
                  <td style={{ padding: '12px 16px', textTransform: 'uppercase' }}>{row.payment_method}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.transaction_reference || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{fmtDate(row.payment_date)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      {canModify && (
                        <Btn variant="danger" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => setDeleteId(row.id)}>
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
      </Card>

      {/* Record Payment Modal */}
      <Modal open={showFormModal} onClose={() => setShowFormModal(false)} title="Record Payment">
        <form onSubmit={handleSave}>
          <Grid cols={2} gap={10}>
            <Input label="Invoice Number *" value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} />
            <Input label="Amount Paid *" type="number" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: parseFloat(e.target.value) || 0 })} />
            <Input label="Payment Date" type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
            <Select label="Payment Method" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="bank">Bank Transfer</option>
            </Select>
          </Grid>
          <Input label="Transaction Reference" value={form.transaction_reference || ''} onChange={(e) => setForm({ ...form, transaction_reference: e.target.value })} />
          <Textarea label="Notes" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
            <Btn variant="secondary" onClick={() => setShowFormModal(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Btn>
          </div>
        </form>
      </Modal>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} entityName="payments" onImportSuccess={fetchPayments} />

      <ConfirmDelete 
        isOpen={deleteId !== null} 
        onClose={() => setDeleteId(null)} 
        onConfirm={confirmDeletePayment} 
      />
    </div>
  );
}
