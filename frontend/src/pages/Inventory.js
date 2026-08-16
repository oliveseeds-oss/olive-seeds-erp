import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { Card, Btn, Input, Select, Textarea, TableSkeleton, fmt, fmtDate, Modal } from '../components/UI';
import ConfirmDelete from '../components/ConfirmDelete';
import { useAuth } from '../utils/AuthContext';
import toast from 'react-hot-toast';

const EMPTY_RAW_FORM = {
  name: '',
  unit: 'pcs',
  category: 'Acrylic',
  stock: 0,
  reorder_level: 0,
  maximum_stock: 0,
  purchase_price: 0,
  last_purchase_date: '',
  supplier_id: '',
  supplier_name: '',
  location: '',
  description: '',
  notes: '',
  is_active: true
};

export default function Inventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isEmployee = user?.role === 'employee';

  const [activeTab, setActiveTab] = useState('stock'); // 'stock', 'movements', 'raw'

  // Data states
  const [stocks, setStocks] = useState([]);
  const [movements, setMovements] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [productsList, setProductsList] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals state
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    product_id: '',
    adjustment_type: 'add',
    quantity: 1,
    reason: '',
    notes: ''
  });

  const [showRawModal, setShowRawModal] = useState(false);
  const [rawForm, setRawForm] = useState(EMPTY_RAW_FORM);
  const [editRawId, setEditRawId] = useState(null);
  const [deleteRawId, setDeleteRawId] = useState(null);

  // Raw Stock adjustment modal
  const [showRawAdjustModal, setShowRawAdjustModal] = useState(false);
  const [rawAdjustForm, setRawAdjustForm] = useState({
    material_id: '',
    material_name: '',
    adjustment_type: 'add',
    quantity: 0,
    reason: '',
    notes: ''
  });

  const [saving, setSaving] = useState(false);

  const fetchStock = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/stock');
      setStocks(res.data || []);
    } catch (err) {
      toast.error('Failed to load stock list');
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/movements');
      setMovements(res.data || []);
    } catch (err) {
      toast.error('Failed to load stock movements');
    } finally {
      setLoading(false);
    }
  };

  const fetchRawMaterials = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/raw-materials');
      setRawMaterials(res.data || []);
    } catch (err) {
      toast.error('Failed to load raw materials');
    } finally {
      setLoading(false);
    }
  };

  const loadData = () => {
    if (activeTab === 'stock') {
      fetchStock();
    } else if (activeTab === 'movements') {
      fetchMovements();
    } else if (activeTab === 'raw') {
      fetchRawMaterials();
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  useEffect(() => {
    // Prefetch lists for dropdowns
    api.get('/products').then(res => setProductsList(Array.isArray(res.data) ? res.data : (res.data.products || []))).catch(() => {});
    api.get('/suppliers').then(res => setSuppliers(Array.isArray(res.data) ? res.data : (res.data.suppliers || []))).catch(() => {});
  }, []);

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!adjustForm.product_id || adjustForm.quantity <= 0) {
      toast.error('Please fill out all required fields');
      return;
    }
    setSaving(true);
    try {
      await api.post('/inventory/adjust', adjustForm);
      toast.success('Inventory adjusted successfully');
      setShowAdjustModal(false);
      setAdjustForm({ product_id: '', adjustment_type: 'add', quantity: 1, reason: '', notes: '' });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to adjust stock');
    } finally {
      setSaving(false);
    }
  };

  const handleRawSubmit = async (e) => {
    e.preventDefault();
    if (!rawForm.name.trim()) {
      toast.error('Material name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...rawForm,
        supplier_id: rawForm.supplier_id || null,
        stock: parseFloat(rawForm.stock) || 0,
        reorder_level: parseFloat(rawForm.reorder_level) || 0,
        maximum_stock: parseFloat(rawForm.maximum_stock) || 0,
        purchase_price: parseFloat(rawForm.purchase_price) || 0,
        last_purchase_date: rawForm.last_purchase_date || null
      };

      if (editRawId) {
        await api.put(`/inventory/raw-materials/${editRawId}`, payload);
        toast.success('Raw material updated successfully');
      } else {
        await api.post('/inventory/raw-materials', payload);
        toast.success('Raw material recorded successfully');
      }
      setShowRawModal(false);
      setRawForm(EMPTY_RAW_FORM);
      setEditRawId(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record entry');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenRawEdit = (record) => {
    setRawForm({
      name: record.name || '',
      unit: record.unit || '',
      category: record.category || '',
      stock: record.stock || 0,
      reorder_level: record.reorder_level || 0,
      maximum_stock: record.maximum_stock || 0,
      purchase_price: record.purchase_price || 0,
      last_purchase_date: record.last_purchase_date ? record.last_purchase_date.slice(0, 10) : '',
      supplier_id: record.supplier_id || '',
      supplier_name: record.supplier_name || '',
      location: record.location || '',
      description: record.description || '',
      notes: record.notes || '',
      is_active: record.is_active ?? true
    });
    setEditRawId(record.id);
    setShowRawModal(true);
  };

  const handleOpenRawAdjust = (record) => {
    setRawAdjustForm({
      material_id: record.id,
      material_name: record.name,
      adjustment_type: 'add',
      quantity: 0,
      reason: '',
      notes: ''
    });
    setShowRawAdjustModal(true);
  };

  const handleRawAdjustSubmit = async (e) => {
    e.preventDefault();
    if (parseFloat(rawAdjustForm.quantity) <= 0) {
      toast.error('Quantity must be greater than zero');
      return;
    }
    setSaving(true);
    try {
      await api.post('/inventory/raw-materials/adjust', {
        material_id: rawAdjustForm.material_id,
        adjustment_type: rawAdjustForm.adjustment_type,
        quantity: parseFloat(rawAdjustForm.quantity),
        reason: rawAdjustForm.reason,
        notes: rawAdjustForm.notes
      });
      toast.success('Raw material stock adjusted successfully');
      setShowRawAdjustModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to adjust stock');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDeleteRaw = async () => {
    try {
      await api.delete(`/inventory/raw-materials/${deleteRawId}`);
      toast.success('Raw material deleted successfully');
      setDeleteRawId(null);
      loadData();
    } catch (err) {
      toast.error('Failed to delete raw material');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', margin: 0 }}>Inventory Dashboard</h2>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          {activeTab === 'movements' && (
            <Btn variant="primary" onClick={() => setShowAdjustModal(true)}>➕ Adjust Stock</Btn>
          )}
          {activeTab === 'raw' && (
            <Btn variant="primary" onClick={() => { setRawForm(EMPTY_RAW_FORM); setEditRawId(null); setShowRawModal(true); }}>➕ Record Raw Material</Btn>
          )}
        </div>
      </div>

      {/* Tabs selectors */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #E5E7EB', paddingBottom: '4px' }}>
        <Btn variant={activeTab === 'stock' ? 'primary' : 'outline'} onClick={() => setActiveTab('stock')}>
          📋 Current Stock
        </Btn>
        <Btn variant={activeTab === 'movements' ? 'primary' : 'outline'} onClick={() => setActiveTab('movements')}>
          🔄 Stock Movements
        </Btn>
        <Btn variant={activeTab === 'raw' ? 'primary' : 'outline'} onClick={() => setActiveTab('raw')}>
          🧱 Raw Materials
        </Btn>
      </div>

      {/* Search Filter */}
      <Card style={{ padding: '12px 20px' }}>
        <Input 
          placeholder="Search by name, SKU or reference..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          style={{ maxWidth: '320px' }}
        />
      </Card>

      {/* TAB 1: CURRENT STOCK */}
      {activeTab === 'stock' && (
        <Card style={{ padding: '0px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', color: '#6B7280', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px' }}>Product ID</th>
                <th style={{ padding: '12px 16px' }}>SKU</th>
                <th style={{ padding: '12px 16px' }}>Name</th>
                <th style={{ padding: '12px 16px' }}>Type</th>
                <th style={{ padding: '12px 16px' }}>Category</th>
                <th style={{ padding: '12px 16px' }}>Stock Status</th>
                <th style={{ padding: '12px 16px' }}>Quantity</th>
                <th style={{ padding: '12px 16px' }}>Reorder level</th>
                <th style={{ padding: '12px 16px' }}>Selling Price</th>
                <th style={{ padding: '12px 16px' }}>Warehouse</th>
                <th style={{ padding: '12px 16px' }}>Stock Value</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton cols={11} rows={5} />
              ) : stocks.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>No products found.</td>
                </tr>
              ) : (
                stocks.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()) || s.sku?.toLowerCase().includes(search.toLowerCase())).map(p => {
                  let badgeColor = '#ECFDF5';
                  let textColor = '#065F46';
                  let label = 'In Stock';

                  if (p.stock_status === 'out_of_stock') {
                    badgeColor = '#FEF2F2';
                    textColor = '#991B1B';
                    label = 'Out of Stock';
                  } else if (p.stock_status === 'low_stock') {
                    badgeColor = '#FFFBEB';
                    textColor = '#92400E';
                    label = 'Low Stock';
                  }

                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{p.product_id}</td>
                      <td style={{ padding: '12px 16px' }}>{p.sku || '-'}</td>
                      <td style={{ padding: '12px 16px' }}>{p.name}</td>
                      <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>{p.product_type}</td>
                      <td style={{ padding: '12px 16px' }}>{p.category_name || '-'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, backgroundColor: badgeColor, color: textColor }}>
                          {label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{p.stock}</td>
                      <td style={{ padding: '12px 16px' }}>{p.reorder_level}</td>
                      <td style={{ padding: '12px 16px' }}>{fmt(p.selling_price)}</td>
                      <td style={{ padding: '12px 16px' }}>{p.warehouse || '-'}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700 }}>{fmt(p.stock_value || 0)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Card>
      )}

      {/* TAB 2: STOCK MOVEMENTS */}
      {activeTab === 'movements' && (
        <Card style={{ padding: '0px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', color: '#6B7280', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px' }}>ID</th>
                <th style={{ padding: '12px 16px' }}>Product</th>
                <th style={{ padding: '12px 16px' }}>SKU</th>
                <th style={{ padding: '12px 16px' }}>Type</th>
                <th style={{ padding: '12px 16px' }}>Qty</th>
                <th style={{ padding: '12px 16px' }}>Notes</th>
                <th style={{ padding: '12px 16px' }}>Created By</th>
                <th style={{ padding: '12px 16px' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton cols={8} rows={5} />
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>No stock movements recorded yet.</td>
                </tr>
              ) : (
                movements.filter(m => m.product_name?.toLowerCase().includes(search.toLowerCase()) || m.product_sku?.toLowerCase().includes(search.toLowerCase())).map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                    <td style={{ padding: '12px 16px' }}>{m.id}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{m.product_name}</td>
                    <td style={{ padding: '12px 16px' }}>{m.product_sku || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, backgroundColor: m.movement_type === 'in' ? '#ECFDF3' : '#FEF2F2', color: m.movement_type === 'in' ? '#065F46' : '#991B1B', textTransform: 'uppercase' }}>
                        {m.movement_type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{m.quantity}</td>
                    <td style={{ padding: '12px 16px' }}>{m.notes || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>{m.created_by_name || 'System'}</td>
                    <td style={{ padding: '12px 16px' }}>{fmtDate(m.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}

      {/* TAB 3: RAW MATERIALS */}
      {activeTab === 'raw' && (
        <Card style={{ padding: '0px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', color: '#6B7280', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px' }}>Sno</th>
                <th style={{ padding: '12px 16px' }}>Material ID</th>
                <th style={{ padding: '12px 16px' }}>Name</th>
                <th style={{ padding: '12px 16px' }}>Category</th>
                <th style={{ padding: '12px 16px' }}>Unit</th>
                <th style={{ padding: '12px 16px' }}>Current Stock</th>
                <th style={{ padding: '12px 16px' }}>Min Stock</th>
                <th style={{ padding: '12px 16px' }}>Max Stock</th>
                <th style={{ padding: '12px 16px' }}>Purchase Price</th>
                <th style={{ padding: '12px 16px' }}>Stock Value</th>
                <th style={{ padding: '12px 16px' }}>Supplier</th>
                <th style={{ padding: '12px 16px' }}>Location</th>
                <th style={{ padding: '12px 16px' }}>Last Purchase</th>
                <th style={{ padding: '12px 16px' }}>Notes</th>
                <th style={{ padding: '12px 16px' }}>Is Active</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton cols={16} rows={5} />
              ) : rawMaterials.length === 0 ? (
                <tr>
                  <td colSpan={16} style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>No raw materials found.</td>
                </tr>
              ) : (
                rawMaterials.filter(rm => rm.name?.toLowerCase().includes(search.toLowerCase())).map((rm, idx) => (
                  <tr key={rm.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                    <td style={{ padding: '12px 16px' }}>{idx + 1}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{rm.material_id}</td>
                    <td style={{ padding: '12px 16px' }}>{rm.name}</td>
                    <td style={{ padding: '12px 16px' }}>{rm.category || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>{rm.unit || 'pcs'}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{parseFloat(rm.stock || 0).toFixed(2)}</td>
                    <td style={{ padding: '12px 16px' }}>{parseFloat(rm.reorder_level || 0).toFixed(2)}</td>
                    <td style={{ padding: '12px 16px' }}>{parseFloat(rm.maximum_stock || 0).toFixed(2)}</td>
                    <td style={{ padding: '12px 16px' }}>{fmt(rm.purchase_price || 0)}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700 }}>{fmt((parseFloat(rm.stock || 0) * parseFloat(rm.purchase_price || 0)))}</td>
                    <td style={{ padding: '12px 16px' }}>{rm.supplier_name || rm.supplier_id || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>{rm.location || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>{rm.last_purchase_date ? rm.last_purchase_date.slice(0, 10) : '-'}</td>
                    <td style={{ padding: '12px 16px' }}>{rm.notes || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, backgroundColor: rm.is_active ? '#ECFDF5' : '#FEF2F2', color: rm.is_active ? '#065F46' : '#991B1B' }}>
                        {rm.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                      {isAdmin && (
                        <>
                          <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleOpenRawEdit(rm)}>Edit</Btn>
                          <Btn variant="danger" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => setDeleteRawId(rm.id)}>Delete</Btn>
                        </>
                      )}
                      <Btn variant="secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleOpenRawAdjust(rm)}>Adjust Stock</Btn>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}

      {/* Adjust Product Stock Modal */}
      <Modal open={showAdjustModal} onClose={() => setShowAdjustModal(false)} title="Adjust Inventory Stock">
        <form onSubmit={handleAdjustSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Select label="Select Product *" value={adjustForm.product_id} onChange={(e) => setAdjustForm({ ...adjustForm, product_id: e.target.value })}>
              <option value="">-- Choose Product --</option>
              {productsList.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku}) [Current Stock: {p.stock}]</option>
              ))}
            </Select>
            <Select label="Adjustment Mode *" value={adjustForm.adjustment_type} onChange={(e) => setAdjustForm({ ...adjustForm, adjustment_type: e.target.value })}>
              <option value="add">Add Stock (restock, purchase)</option>
              <option value="remove">Remove Stock (sales, shrink)</option>
              <option value="damage">Write-off Damage</option>
              <option value="set">Set Stock Count (physical audit)</option>
            </Select>
            <Input label="Adjustment Quantity *" type="number" min="1" value={adjustForm.quantity} onChange={(e) => setAdjustForm({ ...adjustForm, quantity: parseInt(e.target.value) || 1 })} />
            <Input label="Reason / Usecase" placeholder="Physical inventory count, vendor correction..." value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} />
            <Textarea label="Internal notes" placeholder="Additional details..." value={adjustForm.notes} onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
            <Btn variant="secondary" onClick={() => setShowAdjustModal(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" disabled={saving}>
              {saving ? 'Adjusting...' : 'Save adjustment'}
            </Btn>
          </div>
        </form>
      </Modal>

      {/* Record/Edit Raw Material Modal */}
      <Modal open={showRawModal} onClose={() => setShowRawModal(false)} title={editRawId ? 'Edit Raw Material' : 'Record Raw Material Entry'} width={640}>
        <form onSubmit={handleRawSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Input label="Material Name *" value={rawForm.name} onChange={(e) => setRawForm({ ...rawForm, name: e.target.value })} />
            
            <Select label="Unit *" value={rawForm.unit} onChange={(e) => setRawForm({ ...rawForm, unit: e.target.value })}>
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="litre">litre</option>
              <option value="ml">ml</option>
              <option value="pcs">pcs</option>
              <option value="meters">meters</option>
              <option value="sheets">sheets</option>
              <option value="rolls">rolls</option>
              <option value="boxes">boxes</option>
              <option value="Other">Other</option>
            </Select>

            <Select label="Category *" value={rawForm.category} onChange={(e) => setRawForm({ ...rawForm, category: e.target.value })}>
              <option value="Acrylic">Acrylic</option>
              <option value="Wood">Wood</option>
              <option value="Leather">Leather</option>
              <option value="MDF">MDF</option>
              <option value="Foam">Foam</option>
              <option value="Fabric">Fabric</option>
              <option value="Metal">Metal</option>
              <option value="Adhesive">Adhesive</option>
              <option value="Packing Material">Packing Material</option>
              <option value="Consumable">Consumable</option>
              <option value="Other">Other</option>
            </Select>

            <Input label="Current Stock *" type="number" step="0.001" value={rawForm.stock} onChange={(e) => setRawForm({ ...rawForm, stock: parseFloat(e.target.value) || 0 })} />
            <Input label="Minimum Stock (Reorder)" type="number" step="0.001" value={rawForm.reorder_level} onChange={(e) => setRawForm({ ...rawForm, reorder_level: parseFloat(e.target.value) || 0 })} />
            <Input label="Maximum Stock (Ideal)" type="number" step="0.001" value={rawForm.maximum_stock} onChange={(e) => setRawForm({ ...rawForm, maximum_stock: parseFloat(e.target.value) || 0 })} />
            <Input label="Purchase Price (₹)" type="number" step="0.01" value={rawForm.purchase_price} onChange={(e) => setRawForm({ ...rawForm, purchase_price: parseFloat(e.target.value) || 0 })} />
            <Input label="Last Purchase Date" type="date" value={rawForm.last_purchase_date} onChange={(e) => setRawForm({ ...rawForm, last_purchase_date: e.target.value })} />
            
            <Select label="Supplier (linked)" value={rawForm.supplier_id} onChange={(e) => setRawForm({ ...rawForm, supplier_id: e.target.value })}>
              <option value="">-- Choose Supplier --</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Input label="Supplier Name (custom)" placeholder="Enter name if not in list" value={rawForm.supplier_name} onChange={(e) => setRawForm({ ...rawForm, supplier_name: e.target.value })} />
            <Input label="Location (shelf/rack)" placeholder="e.g. Shelf A, Rack 2" value={rawForm.location} onChange={(e) => setRawForm({ ...rawForm, location: e.target.value })} />

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', margin: '10px 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={rawForm.is_active} onChange={e => setForm ? setRawForm({ ...rawForm, is_active: e.target.checked }) : null} />
                Is Active Material
              </label>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <Textarea label="Description" placeholder="Material descriptions..." value={rawForm.description} onChange={(e) => setRawForm({ ...rawForm, description: e.target.value })} />
            </div>
            
            <div style={{ gridColumn: 'span 2' }}>
              <Textarea label="Internal Notes" placeholder="Usage details, reorder notes..." value={rawForm.notes} onChange={(e) => setRawForm({ ...rawForm, notes: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
            <Btn variant="secondary" onClick={() => setShowRawModal(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Material'}
            </Btn>
          </div>
        </form>
      </Modal>

      {/* Adjust Raw Material Stock Modal */}
      <Modal open={showRawAdjustModal} onClose={() => setShowRawAdjustModal(false)} title={`Adjust Stock - ${rawAdjustForm.material_name}`}>
        <form onSubmit={handleRawAdjustSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Select label="Adjustment Mode *" value={rawAdjustForm.adjustment_type} onChange={(e) => setRawAdjustForm({ ...rawAdjustForm, adjustment_type: e.target.value })}>
              <option value="add">Add Stock (restock, purchase)</option>
              <option value="remove">Remove Stock (usage, shrink)</option>
              <option value="set">Set Stock Count (physical audit)</option>
            </Select>
            <Input label="Adjustment Quantity *" type="number" step="0.001" min="0.001" value={rawAdjustForm.quantity} onChange={(e) => setRawAdjustForm({ ...rawAdjustForm, quantity: parseFloat(e.target.value) || 0 })} />
            <Input label="Reason / Usecase" placeholder="Usage in order, audit correction..." value={rawAdjustForm.reason} onChange={(e) => setRawAdjustForm({ ...rawAdjustForm, reason: e.target.value })} />
            <Textarea label="Internal notes" placeholder="Additional details..." value={rawAdjustForm.notes} onChange={(e) => setRawAdjustForm({ ...rawAdjustForm, notes: e.target.value })} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
            <Btn variant="secondary" onClick={() => setShowRawAdjustModal(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" disabled={saving}>
              {saving ? 'Adjusting...' : 'Save adjustment'}
            </Btn>
          </div>
        </form>
      </Modal>

      <ConfirmDelete 
        isOpen={deleteRawId !== null} 
        onClose={() => setDeleteRawId(null)} 
        onConfirm={handleConfirmDeleteRaw} 
        title="Delete Raw Material" 
        message="Are you sure you want to delete this raw material? This action is permanent and cannot be undone."
      />

    </div>
  );
}
