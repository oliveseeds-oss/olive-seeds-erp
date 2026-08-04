import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Card, PageHeader, Btn, Table, SearchBox, StatusBadge, Spinner, fmt, fmtDate, Modal, Input, Select } from '../components/UI';

export default function Invoices() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [payStatus, setPayStatus] = useState('');
  const [payModal, setPayModal] = useState(null);
  const [payForm, setPayForm] = useState({ amount:'', payment_method:'cash', transaction_id:'' });

  const fetch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit:100 });
      if (search) params.set('search',search);
      if (type) params.set('type',type);
      if (payStatus) params.set('payment_status',payStatus);
      const { data } = await api.get(`/invoices?${params}`);
      setRows(data.invoices||[]); setTotal(data.total||0);
    } catch(e) {}
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [type, payStatus]);
  useEffect(() => { const t=setTimeout(fetch,400); return()=>clearTimeout(t); }, [search]);

  const openPDF = (inv) => window.open(`/api/invoices/${inv.id}/pdf`, '_blank');

  const recordPayment = async () => {
    try {
      await api.patch(`/invoices/${payModal.id}/pay`, payForm);
      toast.success('Payment recorded'); setPayModal(null); fetch();
    } catch(e) { toast.error('Error'); }
  };

  const cols = [
    { label:'Invoice No', render:r=><span style={{fontWeight:700,color:'var(--primary)'}}>{r.invoice_number}</span> },
    { label:'Type', render:r=><span style={{textTransform:'capitalize',fontSize:12}}>{r.invoice_type?.replace('_',' ')}</span> },
    { label:'Customer', render:r=><span>{r.customer_name||'-'}</span> },
    { label:'Date', render:r=><span style={{fontSize:12}}>{fmtDate(r.invoice_date)}</span> },
    { label:'Amount', render:r=><span style={{fontWeight:700}}>{fmt(r.total)} <span style={{fontSize:11,color:'var(--muted)'}}>{r.currency}</span></span> },
    { label:'Status', render:r=><StatusBadge status={r.payment_status||'pending'} /> },
    { label:'Actions', render:r=>(
      <div style={{display:'flex',gap:5}}>
        <Btn size="sm" onClick={()=>openPDF(r)}>📄 PDF</Btn>
        {r.payment_status!=='paid' && <Btn size="sm" variant="success" onClick={()=>{setPayModal(r);setPayForm({amount:r.total-r.paid_amount,payment_method:'cash',transaction_id:''});}}>💳 Pay</Btn>}
        <Btn size="sm" variant="ghost" onClick={()=>{window.location.href=`/api/invoices/${r.id}/pdf`}}>⬇️</Btn>
      </div>
    )}
  ];

  return (
    <div>
      <PageHeader title="🧾 Invoices" subtitle={`${total} invoices`} />
      <Card style={{marginBottom:16}}>
        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
          <SearchBox value={search} onChange={setSearch} placeholder="Search invoice no, customer..." />
          <select value={type} onChange={e=>setType(e.target.value)} style={{border:'1px solid var(--border)',borderRadius:7,padding:'8px 10px',fontSize:13}}>
            <option value="">All Types</option>
            {['tax','retail','wholesale','corporate','proforma','quotation','delivery_challan','credit_note','debit_note','commercial'].map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}
          </select>
          <select value={payStatus} onChange={e=>setPayStatus(e.target.value)} style={{border:'1px solid var(--border)',borderRadius:7,padding:'8px 10px',fontSize:13}}>
            <option value="">All Payment Status</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </Card>
      <Card>{loading?<Spinner/>:<Table cols={cols} rows={rows} />}</Card>

      <Modal open={!!payModal} onClose={()=>setPayModal(null)} title={`Record Payment: ${payModal?.invoice_number}`} width={400}>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{padding:12,background:'#f8fafc',borderRadius:8}}>
            <div style={{fontSize:13}}>Invoice Total: <strong>{fmt(payModal?.total)}</strong></div>
            <div style={{fontSize:13}}>Pending: <strong style={{color:'var(--danger)'}}>{fmt((payModal?.total||0)-(payModal?.paid_amount||0))}</strong></div>
          </div>
          <Input label="Amount ₹" type="number" value={payForm.amount} onChange={e=>setPayForm(f=>({...f,amount:e.target.value}))} />
          <Select label="Method" value={payForm.payment_method} onChange={e=>setPayForm(f=>({...f,payment_method:e.target.value}))}>
            {['cash','upi','card','netbanking','bank_transfer','paypal','cod'].map(m=><option key={m} value={m}>{m.toUpperCase()}</option>)}
          </Select>
          <Input label="Transaction ID" value={payForm.transaction_id} onChange={e=>setPayForm(f=>({...f,transaction_id:e.target.value}))} placeholder="UTR/Reference..." />
          <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
            <Btn variant="ghost" onClick={()=>setPayModal(null)}>Cancel</Btn>
            <Btn variant="success" onClick={recordPayment}>✅ Record Payment</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
