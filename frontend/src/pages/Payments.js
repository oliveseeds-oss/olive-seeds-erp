import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { Card, PageHeader, Table, Spinner, fmt, fmtDate, Badge } from '../components/UI';

export default function Payments() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [method, setMethod] = useState('');

  const fetch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit:200 });
      if (from) params.set('from',from);
      if (to) params.set('to',to);
      if (method) params.set('method',method);
      const { data } = await api.get(`/payments?${params}`);
      setRows(data.payments||[]);
    } catch(e) {}
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [from, to, method]);

  const total = rows.reduce((s,r)=>s+parseFloat(r.amount||0),0);

  const cols = [
    { label:'Payment ID', key:'payment_id' },
    { label:'Customer', key:'customer_name' },
    { label:'Amount', render:r=><span style={{fontWeight:700,color:parseFloat(r.amount)<0?'var(--danger)':'var(--accent)'}}>{fmt(r.amount)}</span> },
    { label:'Method', render:r=><span style={{textTransform:'uppercase',fontSize:12,fontWeight:600}}>{r.payment_method}</span> },
    { label:'Transaction ID', render:r=><span style={{fontSize:12,color:'var(--muted)'}}>{r.transaction_id||'-'}</span> },
    { label:'Status', render:r=><Badge color={r.status==='completed'?'green':r.status==='refunded'?'red':'yellow'}>{r.status}</Badge> },
    { label:'Date', render:r=><span style={{fontSize:12}}>{fmtDate(r.payment_date)}</span> }
  ];

  return (
    <div>
      <PageHeader title="💳 Payments" subtitle={`Total collected: ${fmt(total)}`} />
      <Card style={{marginBottom:16}}>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
          <div><label style={{fontSize:12,fontWeight:600,display:'block',marginBottom:3}}>From</label><input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{border:'1px solid var(--border)',borderRadius:6,padding:'7px 10px',fontSize:13}} /></div>
          <div><label style={{fontSize:12,fontWeight:600,display:'block',marginBottom:3}}>To</label><input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{border:'1px solid var(--border)',borderRadius:6,padding:'7px 10px',fontSize:13}} /></div>
          <div style={{alignSelf:'flex-end'}}>
            <select value={method} onChange={e=>setMethod(e.target.value)} style={{border:'1px solid var(--border)',borderRadius:6,padding:'7px 10px',fontSize:13}}>
              <option value="">All Methods</option>
              {['cash','upi','card','netbanking','bank_transfer','cod','paypal','refunded'].map(m=><option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </Card>
      <Card>{loading?<Spinner/>:<Table cols={cols} rows={rows} />}</Card>
    </div>
  );
}
