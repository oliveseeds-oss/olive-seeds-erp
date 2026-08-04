import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Card, PageHeader, Btn, Table, SearchBox, StatusBadge, Badge, Spinner, fmt, fmtDate } from '../components/UI';

const STATUSES = ['pending','processing','manufacturing','engraving','qc','packing','ready','shipped','delivered','cancelled','returned','refunded'];
const SOURCES = ['website','amazon','flipkart','etsy','instagram','whatsapp','manual','walkin'];

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit:30 });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (source) params.set('source', source);
      const { data } = await api.get(`/orders?${params}`);
      setOrders(data.orders);
      setTotal(data.total);
    } catch(e) {}
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, [page, status, source]);
  useEffect(() => { const t = setTimeout(fetchOrders, 400); return ()=>clearTimeout(t); }, [search]);

  const cols = [
    { label:'Order ID', key:'order_id', render:r=><span style={{fontWeight:700,color:'var(--primary)',cursor:'pointer'}} onClick={()=>navigate(`/orders/${r.id}`)}>{r.order_id}</span> },
    { label:'Customer', render:r=><div><div style={{fontWeight:600}}>{r.customer_name||'Walk-in'}</div><div style={{fontSize:11,color:'var(--muted)'}}>{r.customer_phone}</div></div> },
    { label:'Amount', render:r=><span style={{fontWeight:700}}>{fmt(r.total)}</span> },
    { label:'Source', render:r=><span style={{textTransform:'capitalize'}}>{r.source}</span> },
    { label:'Status', render:r=><StatusBadge status={r.status} /> },
    { label:'Payment', render:r=><StatusBadge status={r.payment_status||'pending'} /> },
    { label:'Date', render:r=><span style={{fontSize:12}}>{fmtDate(r.created_at)}</span> },
    { label:'Action', render:r=>(
      <div style={{display:'flex',gap:6}}>
        <Btn size="sm" onClick={()=>navigate(`/orders/${r.id}`)}>View</Btn>
        <Btn size="sm" variant="outline" onClick={()=>window.open(`/api/invoices/${r.id}/pdf`,'_blank')}>📄 PDF</Btn>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="🛒 Orders" subtitle={`${total} total orders`}
        actions={<Btn onClick={()=>navigate('/orders/new')}>➕ New Order</Btn>} />

      <Card style={{ marginBottom:16 }}>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
          <SearchBox value={search} onChange={setSearch} placeholder="Search order ID, customer..." />
          <select value={status} onChange={e=>setStatus(e.target.value)} style={{ border:'1px solid var(--border)', borderRadius:7, padding:'8px 10px', fontSize:13 }}>
            <option value="">All Statuses</option>
            {STATUSES.map(s=><option key={s} value={s} style={{textTransform:'capitalize'}}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
          </select>
          <select value={source} onChange={e=>setSource(e.target.value)} style={{ border:'1px solid var(--border)', borderRadius:7, padding:'8px 10px', fontSize:13 }}>
            <option value="">All Sources</option>
            {SOURCES.map(s=><option key={s} value={s} style={{textTransform:'capitalize'}}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
          </select>
          <Btn variant="ghost" size="sm" onClick={()=>{setSearch('');setStatus('');setSource('');setPage(1);}}>Clear</Btn>
        </div>
      </Card>

      <Card>
        {loading ? <Spinner /> : <Table cols={cols} rows={orders} emptyMsg="No orders found" />}
        {total > 30 && (
          <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:16 }}>
            <Btn variant="ghost" size="sm" disabled={page===1} onClick={()=>setPage(p=>p-1)}>← Prev</Btn>
            <span style={{ padding:'6px 12px', fontSize:13 }}>Page {page} of {Math.ceil(total/30)}</span>
            <Btn variant="ghost" size="sm" disabled={page>=Math.ceil(total/30)} onClick={()=>setPage(p=>p+1)}>Next →</Btn>
          </div>
        )}
      </Card>
    </div>
  );
}
