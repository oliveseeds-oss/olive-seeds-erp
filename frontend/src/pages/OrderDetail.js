import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../utils/AuthContext';
import { Card, PageHeader, Btn, StatusBadge, Spinner, fmt, fmtDate, Grid, Input, Select, showToast } from '../components/UI';

const STATUSES = ['pending', 'processing', 'manufacturing', 'engraving', 'qc', 'packing', 'ready', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'];

export default function OrderDetail() {
  const { id } = useParams();
  const { canModify } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newStatus, setNewStatus] = useState('');
  const [tracking, setTracking] = useState('');
  const [courier, setCourier] = useState('');
  const [awb, setAwb] = useState('');

  const fetch = async () => {
    try {
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data);
      setNewStatus(data.status);
    } catch (e) {
      showToast('Error loading order details', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, [id]);

  const updateStatus = async () => {
    try {
      await api.patch(`/orders/${id}/status`, {
        status: newStatus,
        tracking_number: tracking,
        courier,
        awb_number: awb
      });
      showToast('Status updated successfully', 'success');
      fetch();
    } catch (e) {
      showToast('Error updating status', 'error');
    }
  };

  const createInvoice = async (type = 'tax') => {
    try {
      const { data } = await api.post(`/invoices/from-order/${id}`, { invoice_type: type });
      showToast(`Invoice created successfully`, 'success');
      window.open(`/api/invoices/${data.id}/pdf?token=${localStorage.getItem('os_token')}`, '_blank');
    } catch (e) {
      showToast(e.response?.data?.error || 'Error creating invoice', 'error');
    }
  };

  if (loading) return <Spinner />;
  if (!order) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        title={`Order: ${order.order_id}`}
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Btn variant="secondary" onClick={() => navigate('/orders')}>
              ← Back
            </Btn>
            <Btn variant="primary" onClick={() => createInvoice('tax')}>
              Tax Invoice
            </Btn>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 1024 ? '1fr' : '1.8fr 1.2fr', gap: '20px' }}>
        {/* Left Side: Items list & Customer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Card>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Order Items</div>
            {(order.items || []).map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: idx === order.items.length - 1 ? 'none' : '1px solid #E5E7EB' }}>
                <div>
                  <div style={{ fontWeight: '600', color: '#111827' }}>{item.product_name}</div>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                    Qty: {item.quantity} x {fmt(item.unit_price)}
                  </div>
                </div>
                <strong style={{ color: '#111827' }}>{fmt(item.total)}</strong>
              </div>
            ))}
          </Card>

          <Card>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Customer Info</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{order.customer_name}</div>
            <div style={{ fontSize: '13px', color: '#374151', marginTop: '4px' }}>Phone: {order.customer_phone}</div>
            <div style={{ fontSize: '13px', color: '#374151' }}>Email: {order.customer_email}</div>
          </Card>
        </div>

        {/* Right Side: Status Updates */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Card>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Order Status</div>
            <div style={{ marginBottom: '12px' }}>
              <StatusBadge status={order.status} />
            </div>
            {canModify && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Select label="Change Status" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
                <Input label="Tracking Number" value={tracking} onChange={(e) => setTracking(e.target.value)} />
                <Btn variant="primary" onClick={updateStatus}>Update Status</Btn>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
