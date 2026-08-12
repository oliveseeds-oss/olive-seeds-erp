import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../utils/AuthContext';
import { Card, PageHeader, Btn, Input, Select, Textarea, TableSkeleton, fmt, fmtDate, showToast, Modal } from '../components/UI';
import ImportModal from '../components/ImportModal';
import ConfirmDelete from '../components/ConfirmDelete';
import toast from 'react-hot-toast';

const EMPTY = {
  order_id: '', 
  customer_name: '',
  courier: 'shiprocket', 
  tracking_number: '', 
  awb_number: '',
  pickup_date: '',
  expected_delivery: '',
  actual_delivery: '',
  weight: 0, 
  length: 0, 
  width: 0, 
  height: 0, 
  shipping_cost: 0, 
  cod_amount: 0,
  insurance_amount: 0,
  payment_type: 'prepaid', // 'prepaid' or 'cod'
  status: 'shipped', 
  notes: ''
};

export default function Shipping() {
  const { user, canWrite, canModify } = useAuth();
  const [rows, setRows] = useState([]);
  const [ordersList, setOrdersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const fetchShipping = async () => {
    setLoading(true);
    try {
      const res = await api.get('/shipping');
      setRows(res.data.shipments || res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load shipping data');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await api.get('/orders');
      setOrdersList(res.data.orders || res.data || []);
    } catch (err) {}
  };

  useEffect(() => {
    fetchShipping();
    fetchOrders();
  }, []);

  const handleOrderChange = (e) => {
    const selectedOrderId = e.target.value;
    const selectedOrder = ordersList.find(o => String(o.id) === String(selectedOrderId));
    setForm({
      ...form,
      order_id: selectedOrderId,
      customer_name: selectedOrder ? selectedOrder.customer_name : ''
    });
  };

  const handleOpenAdd = () => {
    setForm(EMPTY);
    setErrors({});
    setIsEdit(false);
    setShowFormModal(true);
  };

  const handleOpenEdit = (shp) => {
    setForm({
      order_id: shp.order_id || '',
      customer_name: shp.customer_name || '',
      courier: shp.courier || 'shiprocket',
      tracking_number: shp.tracking_number || '',
      awb_number: shp.awb_number || '',
      pickup_date: shp.pickup_date ? shp.pickup_date.slice(0, 10) : '',
      expected_delivery: shp.expected_delivery ? shp.expected_delivery.slice(0, 10) : '',
      actual_delivery: shp.actual_delivery ? shp.actual_delivery.slice(0, 10) : '',
      weight: shp.weight || 0,
      length: shp.length || 0,
      width: shp.width || 0,
      height: shp.height || 0,
      shipping_cost: shp.shipping_cost || 0,
      cod_amount: shp.cod_amount || 0,
      insurance_amount: shp.insurance_amount || shp.insurance || 0,
      payment_type: shp.payment_type || 'prepaid',
      status: shp.status || 'shipped',
      notes: shp.notes || ''
    });
    setErrors({});
    setIsEdit(true);
    setEditId(shp.id);
    setShowFormModal(true);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (saving) return;

    // Validate
    const errs = {};
    if (!form.order_id) errs.order_id = 'Order selection is required';
    if (!form.courier) errs.courier = 'Courier is required';
    if (!form.tracking_number) errs.tracking_number = 'Tracking Number is required';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error('Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form };
      delete payload.id;
      delete payload.created_at;
      delete payload.updated_at;

      if (editId) {
        await api.put(`/shipping/${editId}`, payload);
        toast.success('Updated successfully');
      } else {
        await api.post('/shipping', payload);
        toast.success('Saved successfully');
      }
      setShowFormModal(false);
      setForm(EMPTY);
      setEditId(null);
      fetchShipping();
    } catch (err) {
      console.error('Save error:', err);
      toast.error(err.response?.data?.error || err.message || 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteShipment = async () => {
    try {
      await api.delete(`/shipping/${deleteId}`);
      setRows(prev => prev.filter(item => item.id !== deleteId));
      setDeleteId(null);
      toast.success('Deleted successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
      setDeleteId(null);
    }
  };

  const handleDetailedExport = async () => {
    try {
      const { exportToCSV } = await import('../utils/exportUtils');
      const today = new Date().toISOString().split('T')[0];
      exportToCSV(filteredRows, `OliveSeeds_Shipments_${today}.csv`);
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const filteredRows = rows.filter(item => {
    const orderStr = String(item.order_id || '');
    const trackingStr = String(item.tracking_number || '');
    const orderRefStr = String(item.order_reference || '');
    const customerNameStr = String(item.customer_name || '');
    return orderStr.toLowerCase().includes(search.toLowerCase()) || 
           trackingStr.toLowerCase().includes(search.toLowerCase()) ||
           orderRefStr.toLowerCase().includes(search.toLowerCase()) ||
           customerNameStr.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px' }}>
      
      <PageHeader 
        title="Shipping Logistics"
        actions={
          <>
            {canWrite && (
              <Btn variant="primary" onClick={handleOpenAdd}>
                + Add Shipment
              </Btn>
            )}
            {canWrite && (
              <Btn variant="outline" onClick={() => setImportOpen(true)}>
                📤 Upload CSV
              </Btn>
            )}
          </>
        }
      />

      {/* Filter Bar */}
      <Card style={{ padding: '12px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <Input 
            placeholder="Search by order ID, customer or tracking..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: '280px' }}
          />

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Btn variant="outline" onClick={handleDetailedExport}>
              📤 Export CSV
            </Btn>
            {canWrite && (
              <Btn variant="outline" onClick={() => setImportOpen(true)}>Import CSV</Btn>
            )}
          </div>
        </div>
      </Card>

      {/* Data Table */}
      <Card style={{ padding: '0px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '1300px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left', color: '#6B7280' }}>
              <th style={{ padding: '12px 16px' }}>Shipment ID</th>
              <th style={{ padding: '12px 16px' }}>Order Reference</th>
              <th style={{ padding: '12px 16px' }}>Customer Name</th>
              <th style={{ padding: '12px 16px' }}>Courier</th>
              <th style={{ padding: '12px 16px' }}>Tracking Number</th>
              <th style={{ padding: '12px 16px' }}>AWB Number</th>
              <th style={{ padding: '12px 16px' }}>Weight (kg)</th>
              <th style={{ padding: '12px 16px' }}>Volumetric Weight</th>
              <th style={{ padding: '12px 16px' }}>Cost</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Shipped At</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={12} rows={5} />
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>No shipments found.</td>
              </tr>
            ) : (
              filteredRows.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.shipment_id || `SHP-${row.id}`}</td>
                  <td style={{ padding: '12px 16px' }}>{row.order_reference || '-'}</td>
                  <td style={{ padding: '12px 16px' }}>{row.customer_name || '-'}</td>
                  <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>{row.courier}</td>
                  <td style={{ padding: '12px 16px' }}>{row.tracking_number}</td>
                  <td style={{ padding: '12px 16px' }}>{row.awb_number || '-'}</td>
                  <td style={{ padding: '12px 16px' }}>{row.weight} kg</td>
                  <td style={{ padding: '12px 16px' }}>{row.volumetric_weight || '-'} kg</td>
                  <td style={{ padding: '12px 16px', fontWeight: '700' }}>{fmt(row.shipping_cost)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`badge-status status-${row.status}`}>
                      {row.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>{fmtDate(row.pickup_date || row.created_at)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      {canModify && (
                        <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleOpenEdit(row)}>
                          Edit
                        </Btn>
                      )}
                      {user?.role === 'admin' && (
                        <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px', color: '#DC2626', borderColor: '#FECACA' }} onClick={() => setDeleteId(row.id)}>
                          Delete
                        </Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Add/Edit Modal */}
      <Modal open={showFormModal} onClose={() => setShowFormModal(false)} title={isEdit ? 'Edit Shipment Record' : 'New Shipment'} width={640}>
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Select label="Link Order *" value={form.order_id} onChange={handleOrderChange} error={errors.order_id} disabled={isEdit}>
              <option value="">-- Choose Order --</option>
              {ordersList.map(o => (
                <option key={o.id} value={o.id}>{o.order_id} ({o.customer_name})</option>
              ))}
            </Select>

            <Input label="Customer Name" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />

            <Select label="Courier *" value={form.courier} onChange={(e) => setForm({ ...form, courier: e.target.value })} error={errors.courier}>
              <option value="shiprocket">Shiprocket</option>
              <option value="bluedart">Bluedart</option>
              <option value="delhivery">Delhivery</option>
              <option value="fedex">Fedex</option>
              <option value="other">Other Courier</option>
            </Select>

            <Input label="Tracking Number *" value={form.tracking_number} onChange={(e) => setForm({ ...form, tracking_number: e.target.value })} error={errors.tracking_number} />

            <Input label="AWB Number" value={form.awb_number} onChange={(e) => setForm({ ...form, awb_number: e.target.value })} />

            <Input label="Pickup Date" type="date" value={form.pickup_date} onChange={(e) => setForm({ ...form, pickup_date: e.target.value })} />

            <Input label="Expected Delivery Date" type="date" value={form.expected_delivery} onChange={(e) => setForm({ ...form, expected_delivery: e.target.value })} />

            <Input label="Actual Delivery Date" type="date" value={form.actual_delivery} onChange={(e) => setForm({ ...form, actual_delivery: e.target.value })} />

            <Input label="Weight (kg)" type="number" step="0.001" value={form.weight} onChange={(e) => setForm({ ...form, weight: parseFloat(e.target.value) || 0 })} />
            <Input label="Length (cm)" type="number" value={form.length} onChange={(e) => setForm({ ...form, length: parseFloat(e.target.value) || 0 })} />
            <Input label="Width (cm)" type="number" value={form.width} onChange={(e) => setForm({ ...form, width: parseFloat(e.target.value) || 0 })} />
            <Input label="Height (cm)" type="number" value={form.height} onChange={(e) => setForm({ ...form, height: parseFloat(e.target.value) || 0 })} />

            <Input label="Shipping Cost ₹" type="number" step="0.01" value={form.shipping_cost} onChange={(e) => setForm({ ...form, shipping_cost: parseFloat(e.target.value) || 0 })} />
            <Input label="COD Amount ₹" type="number" step="0.01" value={form.cod_amount} onChange={(e) => setForm({ ...form, cod_amount: parseFloat(e.target.value) || 0 })} />
            <Input label="Insurance ₹" type="number" step="0.01" value={form.insurance_amount} onChange={(e) => setForm({ ...form, insurance_amount: parseFloat(e.target.value) || 0 })} />

            <Select label="Payment Type" value={form.payment_type} onChange={(e) => setForm({ ...form, payment_type: e.target.value })}>
              <option value="prepaid">Prepaid</option>
              <option value="cod">COD</option>
            </Select>

            <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="pending">Pending</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="returned">Returned</option>
            </Select>

            <div style={{ gridColumn: 'span 2' }}>
              <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
            <Btn variant="secondary" onClick={() => setShowFormModal(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Shipment'}
            </Btn>
          </div>
        </form>
      </Modal>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} entityName="shipping" onImportSuccess={fetchShipping} />

      <ConfirmDelete 
        open={deleteId !== null} 
        onClose={() => setDeleteId(null)} 
        onConfirm={confirmDeleteShipment} 
        title="Delete Shipment"
        message="Are you sure you want to delete this shipment record?"
      />
    </div>
  );
}
