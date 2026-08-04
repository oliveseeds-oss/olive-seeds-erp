import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Card, PageHeader, Btn, Table, Modal, Grid, Input, Select, Spinner, fmt, fmtDate } from '../components/UI';
import { useAuth } from '../utils/AuthContext';

const EMPTY = { category:'', description:'', amount:'', gst_amount:0, expense_date:new Date().toISOString().split('T')[0], payment_method:'cash', vendor:'' };
const CATS = ['Raw Materials','Packing Materials','Labour','Electricity','Rent','Marketing','Shipping','Equipment','Software','Miscellaneous'];

export default function Expenses() {
  const { canWrite, canModify } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from',from);
      if (to) params.set('to',to);
      const { data } = await api.get(`/expenses?${params}`);
      setRows(data||[]);
    } catch(e) {}
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [from, to]);

  const sf = (k,v) => setForm(f=>({...f,[k]:v}));

  const save = async () => {
    if (!form.category || !form.amount) return toast.error('Category and amount required');
    setSaving(true);
    try {
      await api.post('/expenses', form);
      toast.success('Expense recorded'); setShowModal(false); setForm(EMPTY); fetch();
    } catch(e) { toast.error('Error'); }
    setSaving(false);
  };

  const deleteExpense = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try { await api.delete(`/expenses/${id}`); toast.success('Deleted'); fetch(); }
    catch(e) { toast.error('Error'); }
  };

  const total = rows.reduce((s,r)=>s+parseFloat(r.amount||0),0);

  const cols = [
    { label:'Date', render:r=>fmtDate(r.expense_date) },
    { label:'Category', key:'category' },
    { label:'Vendor', key:'vendor' },
    { label:'Description', render:r=><span style={{fontSize:12}}>{r.description}</span> },
    { label:'Amount', render:r=><span style={{fontWeight:700}}>{fmt(r.amount)}</span> },
    { label:'GST', render:r=>fmt(r.gst_amount) },
    { label:'Method', render:r=><span style={{fontSize:12,textTransform:'uppercase'}}>{r.payment_method}</span> },
    { label:'', render:r=>canModify&&<Btn size="sm" variant="danger" onClick={()=>deleteExpense(r.id)}>🗑️</Btn> }
  ];

  return (
    <div>
      <PageHeader title="💰 Expenses" subtitle={`Total: ${fmt(total)}`} actions={canWrite&&<Btn onClick={()=>setShowModal(true)}>➕ Add Expense</Btn>} />
      <Card style={{marginBottom:16}}>
        <div style={{display:'flex',gap:12}}>
          <div><label style={{fontSize:12,fontWeight:600,display:'block',marginBottom:3}}>From</label><input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{border:'1px solid var(--border)',borderRadius:6,padding:'7px 10px',fontSize:13}} /></div>
          <div><label style={{fontSize:12,fontWeight:600,display:'block',marginBottom:3}}>To</label><input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{border:'1px solid var(--border)',borderRadius:6,padding:'7px 10px',fontSize:13}} /></div>
        </div>
      </Card>
      <Card>{loading?<Spinner/>:<Table cols={cols} rows={rows} />}</Card>
      <Modal open={showModal} onClose={()=>setShowModal(false)} title="Add Expense" width={480}>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <Select label="Category *" value={form.category} onChange={e=>sf('category',e.target.value)}>
            <option value="">Select category...</option>
            {CATS.map(c=><option key={c}>{c}</option>)}
          </Select>
          <Input label="Vendor / Payee" value={form.vendor} onChange={e=>sf('vendor',e.target.value)} />
          <Input label="Description" value={form.description} onChange={e=>sf('description',e.target.value)} />
          <Grid cols={2} gap={10}>
            <Input label="Amount ₹ *" type="number" value={form.amount} onChange={e=>sf('amount',e.target.value)} />
            <Input label="GST Amount ₹" type="number" value={form.gst_amount} onChange={e=>sf('gst_amount',e.target.value)} />
            <Input label="Date *" type="date" value={form.expense_date} onChange={e=>sf('expense_date',e.target.value)} />
            <Select label="Payment Method" value={form.payment_method} onChange={e=>sf('payment_method',e.target.value)}>
              {['cash','upi','card','netbanking','bank_transfer'].map(m=><option key={m}>{m}</option>)}
            </Select>
          </Grid>
          <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
            <Btn variant="ghost" onClick={()=>setShowModal(false)}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving?'Saving...':'💾 Save'}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
