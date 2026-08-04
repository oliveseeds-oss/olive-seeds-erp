import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import api from '../utils/api';
import { Card, Stat, Spinner, fmt, fmtDate } from '../components/UI';
import { StatusBadge } from '../components/UI';

const COLORS = ['#1a5276','#2980b9','#27ae60','#f39c12','#e74c3c','#9b59b6','#1abc9c'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <p>Error loading dashboard</p>;

  return (
    <div>
      <h1 style={{ fontSize:22, fontWeight:700, color:'var(--primary)', marginBottom:20 }}>📊 Dashboard</h1>

      {/* KPI Row 1 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:14, marginBottom:16 }}>
        <Stat label="Today's Sales" value={fmt(data.todaySales)} sub={`${data.todayOrders} orders`} icon="💰" color="#27ae60" />
        <Stat label="Monthly Revenue" value={fmt(data.monthRevenue)} icon="📈" color="#1a5276" />
        <Stat label="Monthly Profit" value={fmt(data.monthProfit)} icon="💹" color="#27ae60" />
        <Stat label="GST Payable" value={fmt(data.monthGST)} icon="📑" color="#e74c3c" />
        <Stat label="Pending Orders" value={data.pendingOrders} icon="⏳" color="#f39c12" />
        <Stat label="Ready to Ship" value={data.readyToShip} icon="📦" color="#2980b9" />
        <Stat label="Low Stock" value={data.lowStock} icon="⚠️" color="#f39c12" />
        <Stat label="Pending Payments" value={fmt(data.pendingPayments)} icon="💳" color="#e74c3c" />
      </div>

      {/* Charts Row */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16, marginBottom:16 }}>
        <Card>
          <h3 style={{ fontSize:14, fontWeight:700, color:'var(--primary)', marginBottom:16 }}>Sales - Last 30 Days</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.salesGraph}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize:10 }} tickFormatter={d=>d?.slice(5)} />
              <YAxis tick={{ fontSize:10 }} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v=>[fmt(v),'Revenue']} labelFormatter={l=>`Date: ${l}`} />
              <Line type="monotone" dataKey="total" stroke="#1a5276" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h3 style={{ fontSize:14, fontWeight:700, color:'var(--primary)', marginBottom:16 }}>Sales by Source</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data.sourceSales} dataKey="revenue" nameKey="source" cx="50%" cy="50%" outerRadius={75} label={e=>`${e.source}: ${fmt(e.revenue)}`} labelLine={false}>
                {data.sourceSales.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v=>[fmt(v),'Revenue']} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        {/* Top Products */}
        <Card>
          <h3 style={{ fontSize:14, fontWeight:700, color:'var(--primary)', marginBottom:12 }}>🏆 Top Products (This Month)</h3>
          {data.topProducts.slice(0,8).map((p,i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ width:22, height:22, background:'var(--primary)', color:'#fff', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700 }}>{i+1}</span>
                <span style={{ fontSize:13 }}>{p.product_name}</span>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{fmt(p.revenue)}</div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>Qty: {p.qty}</div>
              </div>
            </div>
          ))}
        </Card>

        {/* Country Sales */}
        <Card>
          <h3 style={{ fontSize:14, fontWeight:700, color:'var(--primary)', marginBottom:12 }}>🌍 International Sales</h3>
          {data.countrySales.length === 0
            ? <p style={{ color:'var(--muted)', fontSize:13, textAlign:'center', padding:20 }}>No international orders this month</p>
            : data.countrySales.map((c,i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:13 }}>{c.country}</span>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{fmt(c.revenue)}</div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>{c.orders} orders</div>
                </div>
              </div>
            ))
          }
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <h3 style={{ fontSize:14, fontWeight:700, color:'var(--primary)', marginBottom:12 }}>🕐 Recent Orders</h3>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f8fafc' }}>
                {['Order ID','Customer','Amount','Source','Status','Date'].map(h => (
                  <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontWeight:600, color:'var(--muted)', borderBottom:'1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((o,i) => (
                <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'8px 12px', fontWeight:600, color:'var(--primary)' }}>{o.order_id}</td>
                  <td style={{ padding:'8px 12px' }}>{o.customer_name||'Walk-in'}</td>
                  <td style={{ padding:'8px 12px', fontWeight:600 }}>{fmt(o.total)}</td>
                  <td style={{ padding:'8px 12px', textTransform:'capitalize' }}>{o.source}</td>
                  <td style={{ padding:'8px 12px' }}><StatusBadge status={o.status} /></td>
                  <td style={{ padding:'8px 12px', color:'var(--muted)' }}>{fmtDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
