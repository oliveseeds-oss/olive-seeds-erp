import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Card, PageHeader, Btn, Table, SearchBox, Modal, Grid, Input, Select, Textarea, Badge, Spinner, fmt } from '../components/UI';
import { useAuth } from '../utils/AuthContext';

const EMPTY = { name:'', product_type:'physical', sku:'', barcode:'', category_id:'', material:'', color:'', finish:'', size:'', thickness:'', weight:'', description:'', hsn_code:'', gst_percent:18, purchase_price:0, selling_price:0, bulk_price:'', international_price:'', min_order:1, stock:0, reorder_level:5, warehouse:'' };

export default function Products() {
  const { canWrite, canModify } = useAuth();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [ptype, setPtype] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [stockModal, setStockModal] = useState(null);
  const [stockAdj, setStockAdj] = useState({ type:'add', adjustment:1, notes:'' });

  const fetch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit:200 });
      if (search) params.set('search',search);
      if (ptype) params.set('type',ptype);
      if (lowStock) params.set('low_stock','true');
      const { data } = await api.get(`/products?${params}`);
      setRows(data.products||[]); setTotal(data.total||0);
    } catch(e) {}
    setLoading(false);
  };

  useEffect(() => { api.get('/products/meta/categories').then(r=>setCategories(r.data||[])); }, []);
  useEffect(() => { fetch(); }, [ptype, lowStock]);
  useEffect(() => { const t=setTimeout(fetch,400); return()=>clearTimeout(t); }, [search]);

  const openNew = () => { setForm(EMPTY); setEditId(null); setShowModal(true); };
  const openEdit = (r) => { setForm(r); setEditId(r.id); setShowModal(true); };
  const sf = (k,v) => setForm(f=>({...f,[k]:v}));

  const save = async () => {
    if (!form.name || !form.selling_price) return toast.error('Name and selling price required');
    setSaving(true);
    try {
      if (editId) await api.put(`/products/${editId}`, form);
      else await api.post('/products', form);
      toast.success(editId?'Product updated':'Product created');
      setShowModal(false); fetch();
    } catch(e) { toast.error(e.response?.data?.error||'Error'); }
    setSaving(false);
  };

  const adjustStock = async () => {
    try {
      await api.post(`/products/${stockModal.id}/stock`, stockAdj);
      toast.success('Stock updated'); setStockModal(null); fetch();
    } catch(e) { toast.error(e.response?.data?.error||'Error'); }
  };

  const cols = [
    { label:'Product', render:r=><div><div style={{fontWeight:600,fontSize:13}}>{r.name}</div><div style={{fontSize:11,color:'var(--muted)'}}>SKU: {r.sku||'-'} | {r.product_type}</div></div> },
    { label:'Category', render:r=><span style={{fontSize:13}}>{r.category_name||'-'}</span> },
    { label:'Price', render:r=><div><div style={{fontWeight:700,color:'var(--primary)'}}>{fmt(r.selling_price)}</div><div style={{fontSize:11,color:'var(--muted)'}}>Cost: {fmt(r.purchase_price)}</div></div> },
    { label:'GST', render:r=><span>{r.gst_percent}%</span> },
    { label:'HSN', key:'hsn_code' },
    { label:'Stock', render:r=>(
      <span style={{ fontWeight:700, color: r.stock===0?'var(--danger)': r.stock<=r.reorder_level?'var(--warning)':'var(--accent)' }}>
        {r.stock} {r.stock===0?'⚠️ OUT':r.stock<=r.reorder_level?'⚡ LOW':''}
      </span>
    )},
    { label:'Actions', render:r=>(
      <div style={{display:'flex',gap:5}}>
        {canWrite && <Btn size="sm" variant="outline" onClick={()=>setStockModal(r)}>📦 Stock</Btn>}
        {canModify && <Btn size="sm" variant="outline" onClick={()=>openEdit(r)}>✏️</Btn>}
      </div>
    )}
  ];

  return (
    <div>
      <PageHeader title="📦 Products" subtitle={`${total} products`}
        actions={canWrite && <Btn onClick={openNew}>➕ Add Product</Btn>} />
      <Card style={{marginBottom:16}}>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
          <SearchBox value={search} onChange={setSearch} placeholder="Search name, SKU, barcode..." />
          <select value={ptype} onChange={e=>setPtype(e.target.value)} style={{border:'1px solid var(--border)',borderRadius:7,padding:'8px 10px',fontSize:13}}>
            <option value="">All Types</option>
            <option value="physical">Physical</option>
            <option value="digital">Digital</option>
            <option value="service">Service</option>
          </select>
          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,cursor:'pointer'}}>
            <input type="checkbox" checked={lowStock} onChange={e=>setLowStock(e.target.checked)} />Low Stock Only
          </label>
        </div>
      </Card>
      <Card>{loading?<Spinner/>:<Table cols={cols} rows={rows} />}</Card>

      {/* Product Modal */}
      <Modal open={showModal} onClose={()=>setShowModal(false)} title={editId?'Edit Product':'New Product'} width={750}>
        <Grid cols={3} gap={10}>
          <div style={{gridColumn:'span 3'}}>
            <Input label="Product Name *" value={form.name} onChange={e=>sf('name',e.target.value)} />
          </div>
          <Select label="Type" value={form.product_type} onChange={e=>sf('product_type',e.target.value)}>
            <option value="physical">Physical</option><option value="digital">Digital</option><option value="service">Service</option>
          </Select>
          <Select label="Category" value={form.category_id||''} onChange={e=>sf('category_id',e.target.value)}>
            <option value="">No Category</option>
            {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input label="SKU" value={form.sku||''} onChange={e=>sf('sku',e.target.value)} />
          <Input label="Barcode" value={form.barcode||''} onChange={e=>sf('barcode',e.target.value)} />
          <Input label="HSN Code" value={form.hsn_code||''} onChange={e=>sf('hsn_code',e.target.value)} />
          <Input label="GST %" type="number" value={form.gst_percent} onChange={e=>sf('gst_percent',e.target.value)} />
          <Input label="Purchase Price ₹" type="number" value={form.purchase_price} onChange={e=>sf('purchase_price',e.target.value)} />
          <Input label="Selling Price ₹ *" type="number" value={form.selling_price} onChange={e=>sf('selling_price',e.target.value)} />
          <Input label="Bulk Price ₹" type="number" value={form.bulk_price||''} onChange={e=>sf('bulk_price',e.target.value)} />
          <Input label="International Price" type="number" value={form.international_price||''} onChange={e=>sf('international_price',e.target.value)} />
          <Input label="Min Order" type="number" value={form.min_order} onChange={e=>sf('min_order',e.target.value)} />
          <Input label="Stock Qty" type="number" value={form.stock} onChange={e=>sf('stock',e.target.value)} />
          <Input label="Reorder Level" type="number" value={form.reorder_level} onChange={e=>sf('reorder_level',e.target.value)} />
          <Input label="Warehouse" value={form.warehouse||''} onChange={e=>sf('warehouse',e.target.value)} />
          <Input label="Material" value={form.material||''} onChange={e=>sf('material',e.target.value)} />
          <Input label="Color" value={form.color||''} onChange={e=>sf('color',e.target.value)} />
          <Input label="Finish" value={form.finish||''} onChange={e=>sf('finish',e.target.value)} />
          <Input label="Size" value={form.size||''} onChange={e=>sf('size',e.target.value)} />
          <Input label="Weight (kg)" type="number" value={form.weight||''} onChange={e=>sf('weight',e.target.value)} />
          <div style={{gridColumn:'span 3'}}><Textarea label="Description" value={form.description||''} onChange={e=>sf('description',e.target.value)} /></div>
        </Grid>
        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
          <Btn variant="ghost" onClick={()=>setShowModal(false)}>Cancel</Btn>
          <Btn onClick={save} disabled={saving}>{saving?'Saving...':'💾 Save'}</Btn>
        </div>
      </Modal>

      {/* Stock Modal */}
      <Modal open={!!stockModal} onClose={()=>setStockModal(null)} title={`Adjust Stock: ${stockModal?.name}`} width={400}>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{padding:12,background:'#f8fafc',borderRadius:8,fontSize:13}}>
            Current Stock: <strong style={{color:'var(--primary)'}}>{stockModal?.stock}</strong>
          </div>
          <Select label="Adjustment Type" value={stockAdj.type} onChange={e=>setStockAdj(s=>({...s,type:e.target.value}))}>
            <option value="add">➕ Add Stock</option>
            <option value="remove">➖ Remove Stock</option>
          </Select>
          <Input label="Quantity" type="number" value={stockAdj.adjustment} onChange={e=>setStockAdj(s=>({...s,adjustment:e.target.value}))} />
          <Input label="Notes" value={stockAdj.notes} onChange={e=>setStockAdj(s=>({...s,notes:e.target.value}))} />
          <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
            <Btn variant="ghost" onClick={()=>setStockModal(null)}>Cancel</Btn>
            <Btn onClick={adjustStock}>Update Stock</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
