import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { Card, PageHeader, Table, Spinner, fmt, fmtDate } from '../components/UI';

export default function Inventory() {
  const [movements, setMovements] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [tab, setTab] = useState('low');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/inventory/movements'),
      api.get('/inventory/low-stock')
    ]).then(([m, l]) => { setMovements(m.data||[]); setLowStock(l.data||[]); setLoading(false); });
  }, []);

  const movCols = [
    { label:'Product', key:'product_name' },
    { label:'SKU', key:'sku' },
    { label:'Type', render:r=><span style={{textTransform:'capitalize',fontWeight:600,color:r.movement_type==='in'?'var(--accent)':'var(--danger)'}}>{r.movement_type}</span> },
    { label:'Qty', key:'quantity' },
    { label:'Notes', key:'notes' },
    { label:'Date', render:r=><span style={{fontSize:12}}>{fmtDate(r.created_at)}</span> }
  ];

  const stockCols = [
    { label:'Product', render:r=><div><div style={{fontWeight:600}}>{r.name}</div><div style={{fontSize:11,color:'var(--muted)'}}>SKU: {r.sku}</div></div> },
    { label:'Current Stock', render:r=><span style={{fontWeight:700,color:r.stock===0?'var(--danger)':'var(--warning)'}}>{r.stock} {r.stock===0?'⛔ OUT':'⚡ LOW'}</span> },
    { label:'Reorder Level', key:'reorder_level' },
    { label:'Purchase Price', render:r=>fmt(r.purchase_price) },
    { label:'Selling Price', render:r=>fmt(r.selling_price) },
    { label:'Stock Value', render:r=>fmt(r.stock*r.purchase_price) }
  ];

  return (
    <div>
      <PageHeader title="🏭 Inventory" subtitle="Stock levels and movements" />
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        {[['low','⚠️ Low Stock'],['movements','📋 Movements']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{padding:'8px 16px',borderRadius:8,border:'none',background:tab===k?'var(--primary)':'#e2e8f0',color:tab===k?'#fff':'#555',fontWeight:600,fontSize:13,cursor:'pointer'}}>{l}</button>
        ))}
      </div>
      {loading ? <Spinner /> : (
        <Card>
          {tab==='low'
            ? <><h3 style={{marginBottom:12,fontSize:14,fontWeight:700,color:'var(--danger)'}}>⚠️ Low / Out of Stock ({lowStock.length})</h3><Table cols={stockCols} rows={lowStock} emptyMsg="All products are adequately stocked ✅" /></>
            : <><h3 style={{marginBottom:12,fontSize:14,fontWeight:700}}>📋 Recent Stock Movements</h3><Table cols={movCols} rows={movements} /></>
          }
        </Card>
      )}
    </div>
  );
}
