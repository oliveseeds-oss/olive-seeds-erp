import React, { useState } from 'react';
import api from '../utils/api';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, PageHeader, Btn, Table, Spinner, fmt } from '../components/UI';

export default function Reports() {
  const [tab, setTab] = useState('sales');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [groupBy, setGroupBy] = useState('day');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from',from);
      if (to) params.set('to',to);
      if (tab==='sales') params.set('group_by',groupBy);
      const { data: d } = await api.get(`/reports/${tab}?${params}`);
      setData(d);
    } catch(e) {}
    setLoading(false);
  };

  const exportCSV = () => {
    if (!data || !data.length) return;
    const keys = Object.keys(data[0]);
    const csv = [keys.join(','), ...data.map(r=>keys.map(k=>r[k]).join(','))].join('\n');
    const a = document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
    a.download=`${tab}_report.csv`; a.click();
  };

  const TABS = [['sales','📈 Sales'],['products','📦 Products'],['customers','👥 Customers'],['marketplace','🛒 Marketplace'],['profit','💹 Profit'],['inventory','🏭 Inventory'],['country','🌍 Country']];

  return (
    <div>
      <PageHeader title="📈 Reports" actions={<Btn variant="success" onClick={exportCSV} disabled={!data}>⬇️ Export CSV</Btn>} />
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
        {TABS.map(([k,l])=>(
          <button key={k} onClick={()=>{setTab(k);setData(null);}} style={{padding:'7px 14px',borderRadius:8,border:'none',background:tab===k?'var(--primary)':'#e2e8f0',color:tab===k?'#fff':'#555',fontWeight:600,fontSize:13,cursor:'pointer'}}>{l}</button>
        ))}
      </div>
      <Card style={{marginBottom:16}}>
        <div style={{display:'flex',gap:12,alignItems:'flex-end',flexWrap:'wrap'}}>
          <div><label style={{fontSize:12,fontWeight:600,display:'block',marginBottom:3}}>From</label><input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{border:'1px solid var(--border)',borderRadius:6,padding:'7px 10px',fontSize:13}} /></div>
          <div><label style={{fontSize:12,fontWeight:600,display:'block',marginBottom:3}}>To</label><input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{border:'1px solid var(--border)',borderRadius:6,padding:'7px 10px',fontSize:13}} /></div>
          {tab==='sales' && <div>
            <label style={{fontSize:12,fontWeight:600,display:'block',marginBottom:3}}>Group By</label>
            <select value={groupBy} onChange={e=>setGroupBy(e.target.value)} style={{border:'1px solid var(--border)',borderRadius:6,padding:'7px 10px',fontSize:13}}>
              <option value="day">Day</option><option value="month">Month</option><option value="year">Year</option>
            </select>
          </div>}
          <Btn onClick={fetch}>📊 Generate</Btn>
        </div>
      </Card>

      {loading && <Spinner />}

      {data && !loading && (
        <Card>
          {tab==='sales' && <>
            <h3 style={{fontSize:14,fontWeight:700,marginBottom:16}}>Sales Report</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="period" tick={{fontSize:10}} />
                <YAxis tick={{fontSize:10}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v=>[fmt(v),'Revenue']} />
                <Bar dataKey="revenue" fill="var(--primary)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{marginTop:16}}>
              <Table cols={[{label:'Period',key:'period'},{label:'Orders',key:'orders'},{label:'Revenue',render:r=>fmt(r.revenue)},{label:'Tax',render:r=>fmt(r.tax)},{label:'Discount',render:r=>fmt(r.discount)}]} rows={data} />
            </div>
          </>}
          {tab==='products' && <Table cols={[{label:'Product',key:'product_name'},{label:'SKU',key:'sku'},{label:'Qty Sold',key:'qty_sold'},{label:'Revenue',render:r=>fmt(r.revenue)}]} rows={data} />}
          {tab==='customers' && <Table cols={[{label:'Customer',key:'name'},{label:'Type',key:'customer_type'},{label:'Orders',key:'orders'},{label:'Total Spent',render:r=>fmt(r.spent)}]} rows={data} />}
          {tab==='marketplace' && <Table cols={[{label:'Source',key:'source'},{label:'Orders',key:'orders'},{label:'Revenue',render:r=>fmt(r.revenue)}]} rows={data} />}
          {tab==='profit' && <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
            {[['Revenue',fmt(data.revenue),'var(--primary)'],['Expenses',fmt(data.expenses),'var(--danger)'],['COGS',fmt(data.cogs),'var(--warning)'],['Gross Profit',fmt(data.gross_profit),'var(--accent)'],['Net Profit',fmt(data.net_profit),data.net_profit>=0?'var(--accent)':'var(--danger)']].map(([l,v,c])=>(
              <Card key={l}><p style={{fontSize:12,color:'var(--muted)'}}>{l}</p><p style={{fontSize:22,fontWeight:700,color:c}}>{v}</p></Card>
            ))}
          </div>}
          {tab==='inventory' && <Table cols={[{label:'Product',key:'name'},{label:'SKU',key:'sku'},{label:'Stock',key:'stock'},{label:'Reorder Lvl',key:'reorder_level'},{label:'Stock Value',render:r=>fmt(r.stock_value)}]} rows={data} />}
          {tab==='country' && <Table cols={[{label:'Country',key:'country'},{label:'Orders',key:'orders'},{label:'Revenue',render:r=>fmt(r.revenue)}]} rows={data} />}
        </Card>
      )}
    </div>
  );
}
