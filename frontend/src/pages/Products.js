import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Card, PageHeader, Btn, Grid, Input, Select, Textarea, TableSkeleton, fmt } from '../components/UI';
import ConfirmDelete from '../components/ConfirmDelete';
import { useAuth } from '../utils/AuthContext';
import toast from 'react-hot-toast';

const EMPTY_FORM = {
  product_id: '',
  product_type: 'physical',
  sku: '',
  barcode: '',
  name: '',
  category_id: '',
  material: '',
  color: '',
  finish: '',
  size: '',
  thickness: '',
  weight: 0,
  description: '',
  hsn_code: '',
  sac_code: '',
  gst_percent: 18,
  purchase_price: 0,
  selling_price: 0,
  bulk_price: '',
  bulk_min_qty: 1,
  international_price: '',
  min_order: 1,
  max_order: '',
  stock: 0,
  reorder_level: 5,
  warehouse: '',
  image_urls: '',
  is_active: true,
  marketplace_amazon: false,
  marketplace_flipkart: false,
  marketplace_etsy: false,
  marketplace_website: false,
  amazon_asin: '',
  flipkart_sku: '',
  etsy_listing_id: ''
};

export default function Products() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isEmployee = user?.role === 'employee';

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Modals state
  const [showFormModal, setShowFormModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  
  // Tab control in form modal
  const [activeFormTab, setActiveFormTab] = useState('basic');

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/products');
      setProducts(Array.isArray(res.data) ? res.data : (res.data.products || []));
    } catch (err) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/products/meta/categories');
      setCategories(res.data || []);
    } catch (err) {
      console.error('Categories fetch error:', err);
      // Try alternative endpoint if first fails
      try {
        const res2 = await api.get('/categories');
        setCategories(res2.data || []);
      } catch (err2) {
        console.error('Categories fallback failed:', err2);
        setCategories([]);
      }
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const handleOpenAdd = () => {
    setForm(EMPTY_FORM);
    setIsEdit(false);
    setActiveFormTab('basic');
    setShowFormModal(true);
  };

  const handleOpenEdit = (prod) => {
    setForm({
      ...prod,
      category_id: prod.category_id || '',
      bulk_price: prod.bulk_price || '',
      max_order: prod.max_order || '',
      international_price: prod.international_price || '',
      is_active: prod.is_active === 1 || prod.is_active === true,
      marketplace_amazon: prod.marketplace_amazon === 1 || prod.marketplace_amazon === true,
      marketplace_flipkart: prod.marketplace_flipkart === 1 || prod.marketplace_flipkart === true,
      marketplace_etsy: prod.marketplace_etsy === 1 || prod.marketplace_etsy === true,
      marketplace_website: prod.marketplace_website === 1 || prod.marketplace_website === true
    });
    setIsEdit(true);
    setEditId(prod.id);
    setActiveFormTab('basic');
    setShowFormModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.product_id.trim() || !form.name.trim()) {
      toast.error('Product ID and Name are required');
      return;
    }
    try {
      const payload = {
        ...form,
        category_id: form.category_id || null,
        bulk_price: form.bulk_price || null,
        max_order: form.max_order || null,
        international_price: form.international_price || null,
        weight: parseFloat(form.weight) || 0,
        purchase_price: parseFloat(form.purchase_price) || 0,
        selling_price: parseFloat(form.selling_price) || 0,
        bulk_min_qty: parseInt(form.bulk_min_qty) || 1,
        min_order: parseInt(form.min_order) || 1,
        stock: parseInt(form.stock) || 0,
        reorder_level: parseInt(form.reorder_level) || 5
      };

      if (isEdit) {
        await api.put(`/products/${editId}`, payload);
        toast.success('Product updated successfully');
      } else {
        await api.post('/products', payload);
        toast.success('Product created successfully');
      }
      setShowFormModal(false);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save product');
    }
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/products/${deleteId}`);
      toast.success('Product deleted successfully');
      setDeleteId(null);
      fetchProducts();
    } catch (err) {
      toast.error('Failed to delete product');
      setDeleteId(null);
    }
  };

  const filteredProducts = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = p.name?.toLowerCase().includes(q) || p.product_id?.toLowerCase().includes(p) || p.sku?.toLowerCase().includes(q);
    const matchType = filterType ? p.product_type === filterType : true;
    const matchCat = filterCategory ? String(p.category_id) === String(filterCategory) : true;
    return matchSearch && matchType && matchCat;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px' }}>
      <PageHeader 
        title="Products Inventory" 
        actions={
          isAdmin || isEmployee ? (
            <Btn variant="primary" onClick={handleOpenAdd}>➕ Add Product</Btn>
          ) : null
        }
      />

      <Card>
        <Grid cols={3} gap={15}>
          <Input 
            placeholder="Search by ID, name or SKU..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
          <Select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="physical">Physical</option>
            <option value="digital">Digital</option>
            <option value="service">Service</option>
          </Select>
          <Select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Grid>
      </Card>

      {/* Product List Table */}
      <Card style={{ padding: '0px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '2400px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', color: '#6B7280', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Product ID</th>
              <th style={{ padding: '12px 16px' }}>Type</th>
              <th style={{ padding: '12px 16px' }}>SKU</th>
              <th style={{ padding: '12px 16px' }}>Barcode</th>
              <th style={{ padding: '12px 16px' }}>Name</th>
              <th style={{ padding: '12px 16px' }}>Material</th>
              <th style={{ padding: '12px 16px' }}>Color</th>
              <th style={{ padding: '12px 16px' }}>Finish</th>
              <th style={{ padding: '12px 16px' }}>Size</th>
              <th style={{ padding: '12px 16px' }}>Thickness</th>
              <th style={{ padding: '12px 16px' }}>Weight</th>
              <th style={{ padding: '12px 16px' }}>HSN Code</th>
              <th style={{ padding: '12px 16px' }}>SAC Code</th>
              <th style={{ padding: '12px 16px' }}>GST %</th>
              <th style={{ padding: '12px 16px' }}>Pur. Price</th>
              <th style={{ padding: '12px 16px' }}>Sell. Price</th>
              <th style={{ padding: '12px 16px' }}>Bulk Price</th>
              <th style={{ padding: '12px 16px' }}>Bulk Min Qty</th>
              <th style={{ padding: '12px 16px' }}>Int. Price</th>
              <th style={{ padding: '12px 16px' }}>Stock</th>
              <th style={{ padding: '12px 16px' }}>Reorder Level</th>
              <th style={{ padding: '12px 16px' }}>Warehouse</th>
              <th style={{ padding: '12px 16px' }}>Marketplaces</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={25} rows={5} />
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={25} style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>No products found.</td>
              </tr>
            ) : (
              filteredProducts.map(p => {
                // Stock color coding
                let stockBg = '#ECFDF5';
                let stockText = '#065F46';
                let stockLabel = 'Healthy';

                if (p.stock === 0) {
                  stockBg = '#FEF2F2';
                  stockText = '#991B1B';
                  stockLabel = 'Out of Stock';
                } else if (p.stock <= p.reorder_level) {
                  stockBg = '#FFFBEB';
                  stockText = '#92400E';
                  stockLabel = 'Low Stock';
                }

                const marketplaces = [];
                if (p.marketplace_amazon) marketplaces.push('Amazon');
                if (p.marketplace_flipkart) marketplaces.push('Flipkart');
                if (p.marketplace_etsy) marketplaces.push('Etsy');
                if (p.marketplace_website) marketplaces.push('Website');

                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: p.is_active ? '#10B981' : '#9CA3AF', marginRight: '6px' }} />
                      {p.is_active ? 'Active' : 'Inactive'}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{p.product_id}</td>
                    <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>{p.product_type}</td>
                    <td style={{ padding: '12px 16px' }}>{p.sku || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>{p.barcode || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>{p.name}</td>
                    <td style={{ padding: '12px 16px' }}>{p.material || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>{p.color || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>{p.finish || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>{p.size || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>{p.thickness || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>{p.weight ? `${p.weight} kg` : '-'}</td>
                    <td style={{ padding: '12px 16px' }}>{p.hsn_code || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>{p.sac_code || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>{p.gst_percent}%</td>
                    <td style={{ padding: '12px 16px' }}>{fmt(p.purchase_price)}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '600' }}>{fmt(p.selling_price)}</td>
                    <td style={{ padding: '12px 16px' }}>{p.bulk_price ? fmt(p.bulk_price) : '-'}</td>
                    <td style={{ padding: '12px 16px' }}>{p.bulk_min_qty}</td>
                    <td style={{ padding: '12px 16px' }}>{p.international_price ? fmt(p.international_price) : '-'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, backgroundColor: stockBg, color: stockText }}>
                        {p.stock} ({stockLabel})
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{p.reorder_level}</td>
                    <td style={{ padding: '12px 16px' }}>{p.warehouse || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>{marketplaces.join(', ') || '-'}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        {(isAdmin || isEmployee) && (
                          <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleOpenEdit(p)}>
                            Edit
                          </Btn>
                        )}
                        {isAdmin && (
                          <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px', color: '#DC2626', borderColor: '#FECACA' }} onClick={() => setDeleteId(p.id)}>
                            Delete
                          </Btn>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      {/* Add / Edit Form Modal with 5 tabs */}
      {showFormModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#FFF', borderRadius: '8px', width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700 }}>{isEdit ? 'Edit Product' : 'Add Product'}</h3>
            
            {/* Modal Tabs navigation */}
            <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid #E5E7EB', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
              {[
                { id: 'basic', label: '1. Basic Info' },
                { id: 'physical', label: '2. Physical Attributes' },
                { id: 'pricing', label: '3. Pricing & Tax' },
                { id: 'inventory', label: '4. Inventory' },
                { id: 'marketplaces', label: '5. Marketplaces' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFormTab(tab.id)}
                  type="button"
                  style={{
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    borderBottom: activeFormTab === tab.id ? '2px solid #1A1A2E' : '2px solid transparent',
                    background: 'none',
                    color: activeFormTab === tab.id ? '#1A1A2E' : '#6B7280',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSave}>
              {/* Tab 1: Basic Info */}
              {activeFormTab === 'basic' && (
                <Grid cols={2} gap={15}>
                  <Input label="Product ID *" value={form.product_id} onChange={e => setForm({ ...form, product_id: e.target.value })} disabled={isEdit} />
                  <Input label="Product Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  <Input label="SKU" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
                  <Input label="Barcode" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '16px', width: '100%' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>Category</label>
                    <select
                      value={form.category_id || ''}
                      onChange={e => setForm({...form, category_id: e.target.value})}
                      style={{
                        width: '100%',
                        border: '1.5px solid #D0D5DD',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        fontSize: '14px',
                        color: '#101828',
                        background: '#FFFFFF'
                      }}
                    >
                      <option value="">-- Select Category --</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginTop: '30px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                    Active Product
                  </label>
                  <div style={{ gridColumn: 'span 2' }}>
                    <Textarea label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                  </div>
                </Grid>
              )}

              {/* Tab 2: Physical Attributes */}
              {activeFormTab === 'physical' && (
                <Grid cols={2} gap={15}>
                  <Select label="Product Type" value={form.product_type} onChange={e => setForm({ ...form, product_type: e.target.value })}>
                    <option value="physical">Physical Product</option>
                    <option value="digital">Digital Download</option>
                    <option value="service">Service</option>
                  </Select>
                  <Input label="Material" value={form.material} onChange={e => setForm({ ...form, material: e.target.value })} />
                  <Input label="Color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
                  <Input label="Finish" value={form.finish} onChange={e => setForm({ ...form, finish: e.target.value })} />
                  <Input label="Size" value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} />
                  <Input label="Thickness" value={form.thickness} onChange={e => setForm({ ...form, thickness: e.target.value })} />
                  <Input label="Weight (kg)" type="number" step="0.001" value={form.weight} onChange={e => setForm({ ...form, weight: parseFloat(e.target.value) || 0 })} />
                  <Input label="Warehouse Location" value={form.warehouse} onChange={e => setForm({ ...form, warehouse: e.target.value })} />
                </Grid>
              )}

              {/* Tab 3: Pricing & Tax */}
              {activeFormTab === 'pricing' && (
                <Grid cols={2} gap={15}>
                  <Input label="Purchase Price (₹) *" type="number" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: parseFloat(e.target.value) || 0 })} />
                  <Input label="Selling Price (₹) *" type="number" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: parseFloat(e.target.value) || 0 })} />
                  <Input label="Bulk Wholesaler Price (₹)" type="number" value={form.bulk_price} onChange={e => setForm({ ...form, bulk_price: e.target.value })} />
                  <Input label="Bulk Minimum Quantity" type="number" value={form.bulk_min_qty} onChange={e => setForm({ ...form, bulk_min_qty: parseInt(e.target.value) || 1 })} />
                  <Input label="International Price ($ / currency)" type="number" value={form.international_price} onChange={e => setForm({ ...form, international_price: e.target.value })} />
                  <Input label="GST Rate (%)" type="number" value={form.gst_percent} onChange={e => setForm({ ...form, gst_percent: parseFloat(e.target.value) || 18 })} />
                  <Input label="HSN Code" value={form.hsn_code} onChange={e => setForm({ ...form, hsn_code: e.target.value })} />
                  <Input label="SAC Code" value={form.sac_code} onChange={e => setForm({ ...form, sac_code: e.target.value })} />
                </Grid>
              )}

              {/* Tab 4: Inventory & Ordering */}
              {activeFormTab === 'inventory' && (
                <Grid cols={2} gap={15}>
                  <Input label="Current Stock" type="number" value={form.stock} onChange={e => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} />
                  <Input label="Reorder Level" type="number" value={form.reorder_level} onChange={e => setForm({ ...form, reorder_level: parseInt(e.target.value) || 5 })} />
                  <Input label="Min Order Quantity" type="number" value={form.min_order} onChange={e => setForm({ ...form, min_order: parseInt(e.target.value) || 1 })} />
                  <Input label="Max Order Quantity" type="number" value={form.max_order} onChange={e => setForm({ ...form, max_order: e.target.value })} />
                  <div style={{ gridColumn: 'span 2' }}>
                    <Input label="Image URLs (comma separated)" value={form.image_urls} onChange={e => setForm({ ...form, image_urls: e.target.value })} />
                  </div>
                </Grid>
              )}

              {/* Tab 5: Marketplaces Integration */}
              {activeFormTab === 'marketplaces' && (
                <Grid cols={2} gap={15}>
                  <div style={{ gridColumn: 'span 2', display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.marketplace_amazon} onChange={e => setForm({ ...form, marketplace_amazon: e.target.checked })} />
                      Amazon Store
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.marketplace_flipkart} onChange={e => setForm({ ...form, marketplace_flipkart: e.target.checked })} />
                      Flipkart Store
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.marketplace_etsy} onChange={e => setForm({ ...form, marketplace_etsy: e.target.checked })} />
                      Etsy Shop
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.marketplace_website} onChange={e => setForm({ ...form, marketplace_website: e.target.checked })} />
                      Official Website
                    </label>
                  </div>
                  <Input label="Amazon ASIN" value={form.amazon_asin} onChange={e => setForm({ ...form, amazon_asin: e.target.value })} />
                  <Input label="Flipkart SKU" value={form.flipkart_sku} onChange={e => setForm({ ...form, flipkart_sku: e.target.value })} />
                  <Input label="Etsy Listing ID" value={form.etsy_listing_id} onChange={e => setForm({ ...form, etsy_listing_id: e.target.value })} />
                </Grid>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px', borderTop: '1px solid #E5E7EB', paddingTop: '16px' }}>
                <Btn variant="secondary" onClick={() => setShowFormModal(false)}>Cancel</Btn>
                <Btn variant="primary" type="submit">Save Product</Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDelete 
        isOpen={deleteId !== null} 
        onClose={() => setDeleteId(null)} 
        onConfirm={confirmDelete} 
      />
    </div>
  );
}
