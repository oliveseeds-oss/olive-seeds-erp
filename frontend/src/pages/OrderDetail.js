import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Card, PageHeader, Btn, StatusBadge, Badge, Spinner, fmt, fmtDate, Grid, Input, Select } from '../components/UI';

const STATUSES = ['pending','processing','manufacturing','engraving','qc','packing','ready','shipped','delivered','cancelled','returned','refunded'];

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newStatus, setNewStatus] = useState('');
  const [tracking, setTracking] = useState('');
  const [courier, setCourier] = useState('');
  const [awb, setAwb] = useState('');

  const fetch = async () => {
    try { const { data } = await api.get(`/orders/${id}`); setOrder(data); setNewStatus(data.status); }
    catch(e) { toast.error('Order not found'); navigate('/orders'); }
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [id]);

  const updateStatus = async () => {
    try {
      await api.patch(`/orders/${id}/status`, { status:newStatus, tracking_number:tracking, courier, awb_number:awb });
      toast.success('Status updated'); fetch();
    } catch(e) { toast.error('Error updating status'); }
  };

  const createInvoice = async (type='tax') => {
    try {
      const { data } = await api.post(`/invoices/from-order/${id}`, { invoice_type: type });
      toast.success(`Invoice ${data.invoice_number} created`);
      window.open(`/api/invoices/${data.id}/pdf`, '_blank');
    } catch(e) { toast.error(e.response?.data?.error || 'Error'); }
  };

  if (loading) return <Spinner />;
  if (!order) return null;

  return (
    <div>
      <PageHeader title={`Order: ${order.order_id}`} subtitle={`Created ${fmtDate(order.created_at)}`}
        actions={
          <div style={{ display:'flex', gap:8 }}>
            <Btn variant="outline" onClick={()=>navigate('/orders')}>← Back</Btn>
            <Btn variant="success" onClick={()=>createInvoice(order.is_international?'commercial':'tax')}>🧾 {order.is_international?'Commercial Invoice':'Tax Invoice'}</Btn>
            <Btn variant="outline" onClick={()=>createInvoice('proforma')}>📋 Proforma</Btn>
            <Btn variant="outline" onClick={()=>createInvoice('delivery_challan')}>📦 Challan</Btn>
          </div>
        } />

      <Grid cols={3} gap={16}>
        <Card>
          <h3 style={{ fontSize:13, fontWeight:700, color:'var(--muted)', marginBottom:10 }}>ORDER INFO</h3>
          {[['Order ID', order.order_id],['Source', order.source],['Type', order.order_type],['Currency', order.currency],['GST Invoice', order.is_gst_invoice?'Yes':'No'],['International', order.is_international?'Yes':'No']].map(([l,v])=>(
            <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
              <span style={{ color:'var(--muted)' }}>{l}</span><span style={{ fontWeight:600, textTransform:'capitalize' }}>{v}</span>
            </div>
          ))}
        </Card>
        <Card>
          <h3 style={{ fontSize:13, fontWeight:700, color:'var(--muted)', marginBottom:10 }}>CUSTOMER</h3>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:6 }}>{order.customer_name||'Walk-in'}</div>
          {order.customer_phone && <div style={{ fontSize:13, color:'var(--muted)' }}>📞 {order.customer_phone}</div>}
          {order.customer_email && <div style={{ fontSize:13, color:'var(--muted)' }}>✉️ {order.customer_email}</div>}
          {order.shipping_address && (
            <div style={{ marginTop:10, fontSize:12, color:'#555', background:'#f8fafc', padding:8, borderRadius:6 }}>
              📍 {order.shipping_address}, {order.shipping_city}, {order.shipping_state} {order.shipping_pincode}<br/>{order.shipping_country}
            </div>
          )}
        </Card>
        <Card>
          <h3 style={{ fontSize:13, fontWeight:700, color:'var(--muted)', marginBottom:10 }}>FINANCIALS</h3>
          {[['Subtotal', fmt(order.subtotal)], order.discount>0?['Discount',`-${fmt(order.discount)}`]:null, order.cgst>0?['CGST',fmt(order.cgst)]:null, order.sgst>0?['SGST',fmt(order.sgst)]:null, order.igst>0?['IGST',fmt(order.igst)]:null, order.shipping_cost>0?['Shipping',fmt(order.shipping_cost)]:null].filter(Boolean).map(([l,v])=>(
            <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
              <span style={{ color:'var(--muted)' }}>{l}</span><span>{v}</span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', fontSize:16, fontWeight:800, color:'var(--primary)' }}>
            <span>Total</span><span>{fmt(order.total)}</span>
          </div>
          <div style={{ marginTop:4 }}><StatusBadge status={order.payment_status||'pending'} /></div>
        </Card>
      </Grid>

      <Grid cols={2} gap={16} style={{ marginTop:16 }}>
        {/* Items */}
        <Card>
          <h3 style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>🛍️ Order Items</h3>
          {(order.items||[]).map((item,i)=>(
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight:600, fontSize:13 }}>{item.product_name}</div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>SKU: {item.sku||'-'} | HSN: {item.hsn_code||'-'} | GST: {item.gst_percent||0}%</div>
                {item.personalization && <div style={{ fontSize:11, color:'#555', marginTop:4, background:'#fef9c3', padding:'3px 6px', borderRadius:4 }}>✏️ {item.personalization}</div>}
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontWeight:700 }}>{fmt(item.total)}</div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>{item.quantity} × {fmt(item.unit_price)}</div>
              </div>
            </div>
          ))}
        </Card>

        {/* Status Update */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <Card>
            <h3 style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>🔄 Update Status</h3>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:12 }}>
              {STATUSES.map(s=>(
                <button key={s} onClick={()=>setNewStatus(s)} style={{
                  padding:'6px 12px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer',
                  background: newStatus===s?'var(--primary)':'#f3f4f6', color: newStatus===s?'#fff':'#555', border:'none'
                }}>{s.charAt(0).toUpperCase()+s.slice(1)}</button>
              ))}
            </div>
            <Grid cols={2} gap={8}>
              <Input label="Tracking Number" value={tracking} onChange={e=>setTracking(e.target.value)} placeholder="AWB/Tracking..." />
              <Input label="AWB Number" value={awb} onChange={e=>setAwb(e.target.value)} />
              <Select label="Courier" value={courier} onChange={e=>setCourier(e.target.value)}>
                <option value="">Select Courier</option>
                {['shiprocket','amazon','fedex','ups','dhl','aramex','indiapost','dtdc','bluedart'].map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
              </Select>
            </Grid>
            <Btn onClick={updateStatus} style={{ marginTop:12, width:'100%', justifyContent:'center' }}>Update Status</Btn>
          </Card>

          {order.notes && <Card><h3 style={{ fontSize:13, fontWeight:700, color:'var(--muted)', marginBottom:6 }}>NOTES</h3><p style={{ fontSize:13 }}>{order.notes}</p></Card>}
          {order.personalization_notes && <Card><h3 style={{ fontSize:13, fontWeight:700, color:'var(--muted)', marginBottom:6 }}>✏️ PERSONALIZATION</h3><p style={{ fontSize:13 }}>{order.personalization_notes}</p></Card>}
        </div>
      </Grid>
    </div>
  );
}
