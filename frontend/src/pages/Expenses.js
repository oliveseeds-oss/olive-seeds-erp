import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../utils/AuthContext';
import { Card, PageHeader, Btn, Input, Select, Textarea, TableSkeleton, fmt, fmtDate, Modal } from '../components/UI';
import ImportModal from '../components/ImportModal';
import ConfirmDelete from '../components/ConfirmDelete';
import toast from 'react-hot-toast';

const EMPTY = { 
  category: '', 
  vendor: '',
  description: '', 
  amount: 0, 
  gst_percent: 0,
  gst_amount: 0, 
  expense_date: new Date().toISOString().split('T')[0], 
  payment_method: 'cash', 
  reference_number: '',
  notes: '',
  receipt_path: '',
  receipt_image_url: ''
};

const CATS = ['Raw Materials', 'Packing Materials', 'Labour', 'Electricity', 'Rent', 'Marketing', 'Shipping', 'Equipment', 'Software', 'Miscellaneous'];

export default function Expenses() {
  const { user, canWrite, canModify, isAdmin } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await api.get('/expenses');
      setRows(res.data.expenses || res.data || []);
    } catch (err) {
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleOpenAdd = () => {
    setForm(EMPTY);
    setErrors({});
    setIsEdit(false);
    setShowFormModal(true);
  };

  const handleOpenEdit = (exp) => {
    setForm({
      ...exp,
      expense_date: exp.expense_date ? exp.expense_date.slice(0, 10) : '',
      gst_amount: exp.gst_amount || 0,
      gst_percent: exp.gst_percent || 0,
      reference_number: exp.reference_number || '',
      notes: exp.notes || '',
      receipt_path: exp.receipt_path || '',
      receipt_image_url: exp.receipt_image_url || ''
    });
    setErrors({});
    setIsEdit(true);
    setEditId(exp.id);
    setShowFormModal(true);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (saving) return;

    // Validate
    const errs = {};
    if (!form.category) errs.category = 'Category is required';
    if (!form.amount || parseFloat(form.amount) <= 0) errs.amount = 'Amount must be greater than zero';
    if (!form.expense_date) errs.expense_date = 'Expense date is required';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error('Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form };
      delete payload.id;
      delete payload.created_at;
      delete payload.updated_at;
      delete payload.expense_id;

      if (editId) {
        await api.put(`/expenses/${editId}`, payload);
        toast.success('Updated successfully');
      } else {
        await api.post('/expenses', payload);
        toast.success('Saved successfully');
      }
      setShowFormModal(false);
      setEditId(null);
      setForm(EMPTY);
      fetchExpenses();
    } catch (err) {
      console.error('Save error:', err);
      toast.error(err.response?.data?.error || err.message || 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteExpense = async () => {
    try {
      await api.delete(`/expenses/${deleteId}`);
      setRows(prev => prev.filter(item => item.id !== deleteId));
      setDeleteId(null);
      toast.success('Deleted successfully');
    } catch (err) {
      toast.error('Delete failed');
      setDeleteId(null);
    }
  };

  const handleDetailedExport = async () => {
    try {
      const { exportToCSV } = await import('../utils/exportUtils');
      const today = new Date().toISOString().split('T')[0];
      exportToCSV(filteredRows, `OliveSeeds_Expenses_${today}.csv`);
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const filteredRows = rows.filter(item => {
    const matchesSearch = item.description?.toLowerCase().includes(search.toLowerCase()) || 
                          item.vendor?.toLowerCase().includes(search.toLowerCase()) ||
                          item.expense_id?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory ? item.category === filterCategory : true;
    return matchesSearch && matchesCategory;
  });

  // Calculate fields dynamically
  const amountVal = parseFloat(form.amount) || 0;
  const gstRateVal = parseFloat(form.gst_percent) || 0;
  const autoGstAmount = (amountVal * gstRateVal) / 100;
  const autoTotalAmount = amountVal + autoGstAmount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px' }}>
      
      <PageHeader 
        title="Expenses"
        actions={
          <>
            {canWrite && (
              <Btn variant="primary" onClick={handleOpenAdd}>
                + Add Expense
              </Btn>
            )}
            {canWrite && (
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
              placeholder="Search by ID, vendor or description..."
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
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                backgroundColor: '#FFFFFF',
                color: '#111827'
              }}
            >
              <option value="">All Categories</option>
              {CATS.map(c => <option key={c} value={c}>{c}</option>)}
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
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '1300px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left', color: '#6B7280' }}>
              <th style={{ padding: '12px 16px' }}>Expense ID</th>
              <th style={{ padding: '12px 16px' }}>Date</th>
              <th style={{ padding: '12px 16px' }}>Category</th>
              <th style={{ padding: '12px 16px' }}>Vendor</th>
              <th style={{ padding: '12px 16px' }}>Description</th>
              <th style={{ padding: '12px 16px' }}>Ref Number</th>
              <th style={{ padding: '12px 16px' }}>Amount</th>
              <th style={{ padding: '12px 16px' }}>GST %</th>
              <th style={{ padding: '12px 16px' }}>GST Amt</th>
              <th style={{ padding: '12px 16px' }}>Payment Mode</th>
              <th style={{ padding: '12px 16px' }}>Receipt Link</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={12} rows={5} />
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>No expenses found.</td>
              </tr>
            ) : (
              filteredRows.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.expense_id}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{fmtDate(row.expense_date)}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>{row.category}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.vendor || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.description || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.reference_number || '-'}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '700', color: '#DC2626' }}>{fmt(row.amount)}</td>
                  <td style={{ padding: '12px 16px' }}>{row.gst_percent || 0}%</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{fmt(row.gst_amount || 0)}</td>
                  <td style={{ padding: '12px 16px', textTransform: 'uppercase' }}>{row.payment_method}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {row.receipt_image_url || row.receipt_path ? (
                      <a href={row.receipt_image_url || row.receipt_path} target="_blank" rel="noreferrer" style={{ color: '#2563EB', textDecoration: 'underline' }}>View Receipt</a>
                    ) : '-'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      {canModify && (
                        <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleOpenEdit(row)}>
                          Edit
                        </Btn>
                      )}
                      {isAdmin && (
                        <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px', color: '#DC2626', borderColor: '#FECACA' }} onClick={() => setDeleteId(row.id)}>
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

      {/* Add/Edit Modal */}
      <Modal open={showFormModal} onClose={() => setShowFormModal(false)} title={isEdit ? 'Edit Expense Record' : 'Record Expense'} width={640}>
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Select label="Category *" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} error={errors.category}>
              <option value="">Select category...</option>
              {CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>

            <Input label="Vendor / Payee" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />

            <div style={{ gridColumn: 'span 2' }}>
              <Textarea label="Description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <Input label="Amount (Base) ₹ *" type="number" step="0.01" value={form.amount} onChange={(e) => {
              const amt = parseFloat(e.target.value) || 0;
              const gstPct = parseFloat(form.gst_percent) || 0;
              const gstAmt = (amt * gstPct) / 100;
              setForm({ ...form, amount: amt, gst_amount: parseFloat(gstAmt.toFixed(2)) });
            }} error={errors.amount} />

            <Input label="GST Rate (%)" type="number" step="0.1" value={form.gst_percent} onChange={(e) => {
              const rate = parseFloat(e.target.value) || 0;
              const amt = parseFloat(form.amount) || 0;
              const gstAmt = (amt * rate) / 100;
              setForm({ ...form, gst_percent: rate, gst_amount: parseFloat(gstAmt.toFixed(2)) });
            }} />

            <Input label="GST Amount (Auto) ₹" type="number" value={form.gst_amount || autoGstAmount.toFixed(2)} readOnly style={{ backgroundColor: '#F9FAFB' }} />
            
            <Input label="Total Amount (Auto) ₹" type="number" value={autoTotalAmount.toFixed(2)} readOnly style={{ backgroundColor: '#F9FAFB' }} />

            <Input label="Expense Date *" type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} error={errors.expense_date} />

            <Select label="Payment Method" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank Transfer</option>
            </Select>

            <Input label="Reference Number" value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} />

            <div style={{ gridColumn: 'span 2' }}>
              <Textarea label="Notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <Input label="Receipt URL / Link" value={form.receipt_image_url} onChange={(e) => setForm({ ...form, receipt_image_url: e.target.value, receipt_path: e.target.value })} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
            <Btn variant="secondary" onClick={() => setShowFormModal(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save expense'}
            </Btn>
          </div>
        </form>
      </Modal>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} entityName="expenses" onImportSuccess={fetchExpenses} />

      <ConfirmDelete 
        isOpen={deleteId !== null} 
        onClose={() => setDeleteId(null)} 
        onConfirm={confirmDeleteExpense} 
        title="Delete Expense"
        message="Are you sure you want to delete this expense record?"
      />
    </div>
  );
}
