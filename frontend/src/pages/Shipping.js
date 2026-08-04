import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Card, PageHeader, Btn, Table, Modal, Grid, Input, Select, Badge, Spinner, fmtDate, fmt } from '../components/UI';
import { useAuth } from '../utils/AuthContext';

const EMPTY = { order_id:'', courier:'shiprocket', tracking_number:'', awb_number:'', weight:'', length:'', width:'', height:'', shipping_cost:'', insurance:'', payment_type:'prepaid', pickup_date:'', expected_delivery:'' };

export default function Shipping() {
  const { canWrite } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try { const { data } = await api.get('/shipping'); setRows(data || []); } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.order_id) return toast.error('Order ID required');
    setSaving(true);
    try {
      await api.post('/shipping', form);
      toast.success('Shipment created'); setShowModal(false); setForm(EMPTY); fetch();
    } catch (e) { toast.error(e.response?.data?.error || 'Error'); }
    setSaving(false);
  };

  const cols = [
    { label: 'Shipment ID', key: 'shipment_id' },
    { label: 'Order', key: 'order_id' },
    { label: 'Customer', key: 'customer_name' },
    { label: 'Courier', render: r => <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{r.courier}</span> },
    { label: 'Tracking', render: r => <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{r.tracking_number || '-'}</span> },
    { label: 'AWB', render: r => <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{r.awb_number || '-'}</span> },
    { label: 'Weight', render: r => r.weight ? `${r.weight} kg` : '-' },
    { label: 'Cost', render: r => fmt(r.shipping_cost) },
    { label: 'Type', render: r => <Badge color={r.payment_type === 'cod' ? 'orange' : 'blue'}>{r.payment_type?.toUpperCase()}</Badge> },
    { label: 'Status', render: r => <Badge color={r.status === 'delivered' ? 'green' : r.status === 'returned' ? 'red' : 'blue'}>{r.status}</Badge> },
    { label: 'Date', render: r => <span style={{ fontSize: 12 }}>{fmtDate(r.created_at)}</span> },
  ];

  return (
    <div>
      <PageHeader title="🚚 Shipping" subtitle={`${rows.length} shipments`}
        actions={canWrite && <Btn onClick={() => setShowModal(true)}>➕ Add Shipment</Btn>} />
      <Card>{loading ? <Spinner /> : <Table cols={cols} rows={rows} emptyMsg="No shipments yet" />}</Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Shipment" width={600}>
        <Grid cols={2} gap={12}>
          <Input label="Order ID *" value={form.order_id} onChange={e => sf('order_id', e.target.value)} placeholder="OS2024..." />
          <Select label="Courier" value={form.courier} onChange={e => sf('courier', e.target.value)}>
            {['shiprocket','amazon','fedex','ups','dhl','aramex','indiapost','dtdc','bluedart','other'].map(c =>
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </Select>
          <Input label="Tracking Number" value={form.tracking_number} onChange={e => sf('tracking_number', e.target.value)} />
          <Input label="AWB Number" value={form.awb_number} onChange={e => sf('awb_number', e.target.value)} />
          <Input label="Weight (kg)" type="number" value={form.weight} onChange={e => sf('weight', e.target.value)} />
          <Input label="Shipping Cost ₹" type="number" value={form.shipping_cost} onChange={e => sf('shipping_cost', e.target.value)} />
          <Input label="Length (cm)" type="number" value={form.length} onChange={e => sf('length', e.target.value)} />
          <Input label="Width (cm)" type="number" value={form.width} onChange={e => sf('width', e.target.value)} />
          <Input label="Height (cm)" type="number" value={form.height} onChange={e => sf('height', e.target.value)} />
          <Input label="Insurance ₹" type="number" value={form.insurance} onChange={e => sf('insurance', e.target.value)} />
          <Select label="Payment Type" value={form.payment_type} onChange={e => sf('payment_type', e.target.value)}>
            <option value="prepaid">Prepaid</option>
            <option value="cod">Cash on Delivery (COD)</option>
          </Select>
          <Input label="Pickup Date" type="date" value={form.pickup_date} onChange={e => sf('pickup_date', e.target.value)} />
          <Input label="Expected Delivery" type="date" value={form.expected_delivery} onChange={e => sf('expected_delivery', e.target.value)} />
        </Grid>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <Btn variant="ghost" onClick={() => setShowModal(false)}>Cancel</Btn>
          <Btn onClick={save} disabled={saving}>{saving ? 'Saving...' : '💾 Save'}</Btn>
        </div>
      </Modal>
    </div>
  );
}
