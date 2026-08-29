import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Card, PageHeader, Btn, Input, Select, Textarea, Grid, fmt, showToast } from '../components/UI';

import { useAuth } from '../utils/AuthContext';

export default function NewOrder() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.role === 'viewer') {
      navigate('/orders');
    }
  }, [user, navigate]);

  const [form, setForm] = useState({
    customer_id: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    billing_address: '',
    shipping_address: '',
    shipping_city: '',
    shipping_state: '',
    shipping_pincode: '',
    shipping_country: 'India',
    source: 'manual',
    order_type: 'regular',
    is_gst_invoice: true,
    is_international: false,
    discount: 0,
    shipping_cost: 0,
    notes: '',
    personalization_notes: '',
    payment_method: '',
    items: []
  });

  useEffect(() => {
    api.get('/customers')
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data.customers || []);
        setCustomers(list);
      })
      .catch(() => {});

    api.get('/products')
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data.products || []);
        setProducts(list);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (productSearch.trim().length > 1) {
      setFilteredProducts(
        products.filter(p => 
          p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
          p.sku?.toLowerCase().includes(productSearch.toLowerCase())
        ).slice(0, 10)
      );
    } else {
      setFilteredProducts([]);
    }
  }, [productSearch, products]);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const selectCustomer = (cid) => {
    const c = customers.find(x => String(x.id) === String(cid));
    if (c) {
      setForm(f => ({
        ...f,
        customer_id: cid,
        customer_name: c.name,
        customer_email: c.email || '',
        customer_phone: c.phone || '',
        billing_address: c.billing_address || '',
        shipping_address: c.shipping_address || c.billing_address || '',
        shipping_city: c.shipping_city || c.billing_city || '',
        shipping_state: c.shipping_state || c.billing_state || '',
        shipping_pincode: c.shipping_pincode || c.billing_pincode || '',
        shipping_country: c.shipping_country || 'India'
      }));
    }
  };

  const addProduct = (p) => {
    setProductSearch('');
    setFilteredProducts([]);
    const existingIdx = form.items.findIndex(i => i.product_id === p.id);
    if (existingIdx >= 0) {
      const items = [...form.items];
      items[existingIdx].quantity++;
      items[existingIdx].total = items[existingIdx].quantity * items[existingIdx].unit_price - (items[existingIdx].discount || 0);
      setField('items', items);
    } else {
      setField('items', [
        ...form.items,
        {
          product_id: p.id,
          product_name: p.name,
          sku: p.sku || '',
          hsn_code: p.hsn_code || '',
          quantity: 1,
          unit_price: p.selling_price || p.price || 0,
          discount: 0,
          gst_percent: p.gst_percent || 18,
          total: p.selling_price || p.price || 0
        }
      ]);
    }
  };

  const updateItem = (idx, field, val) => {
    const items = [...form.items];
    items[idx][field] = val;
    items[idx].total = items[idx].quantity * items[idx].unit_price - (items[idx].discount || 0);
    setField('items', items);
  };

  const removeItem = (idx) => setField('items', form.items.filter((_, i) => i !== idx));

  const calcTotals = () => {
    const subtotal = form.items.reduce((s, i) => s + parseFloat(i.total || 0), 0);
    let tax = 0;
    if (form.is_gst_invoice && !form.is_international) {
      form.items.forEach(item => {
        tax += (item.quantity * item.unit_price - (item.discount || 0)) * (item.gst_percent || 0) / 100;
      });
    }
    const total = subtotal - parseFloat(form.discount || 0) + tax + parseFloat(form.shipping_cost || 0);
    return { subtotal, tax, total };
  };

  const { subtotal, tax, total } = calcTotals();

  const handleSubmit = async () => {
    if (!form.items.length) {
      showToast('Add at least one product', 'error');
      return;
    }
    if (!form.customer_name.trim()) {
      showToast('Customer name required', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/orders', { ...form, total });
      showToast('Order created successfully', 'success');
      navigate(`/orders/${res.data.id}`);
    } catch (e) {
      showToast(e.response?.data?.error || 'Error creating order', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        title="New Order"
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <Btn variant="secondary" onClick={() => navigate('/orders')}>Cancel</Btn>
            <Btn variant="primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Order'}
            </Btn>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 1024 ? '1fr' : '1fr 1fr', gap: '20px' }}>
        
        {/* Left Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Card>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#111827', marginBottom: '14px' }}>Order Details</div>
            <Grid cols={2} gap={10}>
              <Select label="Source" value={form.source} onChange={(e) => setField('source', e.target.value)}>
                {['manual', 'website', 'amazon', 'flipkart', 'etsy', 'instagram', 'whatsapp', 'walkin'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
              <Select label="Payment Method" value={form.payment_method} onChange={(e) => setField('payment_method', e.target.value)}>
                <option value="">Select...</option>
                {['cash', 'upi', 'card', 'bank_transfer', 'cod'].map(m => (
                  <option key={m} value={m}>{m.toUpperCase()}</option>
                ))}
              </Select>
            </Grid>
          </Card>

          <Card>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#111827', marginBottom: '14px' }}>Customer Info</div>
            <Select label="Select Existing Customer" value={form.customer_id} onChange={(e) => selectCustomer(e.target.value)}>
              <option value="">-- Walk-in / New Customer --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
              ))}
            </Select>
            <Grid cols={2} gap={10} style={{ marginTop: '10px' }}>
              <Input label="Customer Name *" value={form.customer_name} onChange={(e) => setField('customer_name', e.target.value)} />
              <Input label="Phone" value={form.customer_phone} onChange={(e) => setField('customer_phone', e.target.value)} />
            </Grid>
          </Card>

          <Card>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#111827', marginBottom: '14px' }}>Shipping Address</div>
            <Textarea label="Address" value={form.shipping_address} onChange={(e) => setField('shipping_address', e.target.value)} />
            <Grid cols={2} gap={10} style={{ marginTop: '10px' }}>
              <Input label="City" value={form.shipping_city} onChange={(e) => setField('shipping_city', e.target.value)} />
              <Input label="State" value={form.shipping_state} onChange={(e) => setField('shipping_state', e.target.value)} />
            </Grid>
          </Card>
        </div>

        {/* Right Form - Products list & Totals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Card>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#111827', marginBottom: '14px' }}>Add Products</div>
            <div style={{ position: 'relative' }}>
              <Input 
                placeholder="Search products..." 
                value={productSearch} 
                onChange={(e) => setProductSearch(e.target.value)} 
              />
              {filteredProducts.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', zIndex: 100, maxHeight: '200px', overflowY: 'auto' }}>
                  {filteredProducts.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => addProduct(p)} 
                      style={{ padding: '8px 12px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', display: 'flex', justifycontent: 'space-between' }}
                    >
                      <span>{p.name} ({p.sku})</span>
                      <strong>{fmt(p.selling_price || p.price || 0)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E7EB', textAlign: 'left', color: '#6B7280' }}>
                  <th style={{ padding: '6px 0' }}>Product</th>
                  <th style={{ padding: '6px 0' }}>Qty</th>
                  <th style={{ padding: '6px 0' }}>Price</th>
                  <th style={{ padding: '6px 0' }}>Disc</th>
                  <th style={{ padding: '6px 0', textAlign: 'right' }}>Total</th>
                  <th style={{ padding: '6px 0' }}></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '6px 0' }}>{item.product_name}</td>
                    <td style={{ padding: '6px 0', width: '60px' }}>
                      <input 
                        type="number" 
                        value={item.quantity} 
                        onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                        style={{ width: '100%', padding: '4px', border: '1px solid #D1D5DB', borderRadius: '4px' }} 
                      />
                    </td>
                    <td style={{ padding: '6px 0', width: '80px' }}>
                      <input 
                        type="number" 
                        value={item.unit_price} 
                        onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                        style={{ width: '100%', padding: '4px', border: '1px solid #D1D5DB', borderRadius: '4px' }} 
                      />
                    </td>
                    <td style={{ padding: '6px 0', width: '70px' }}>
                      <input 
                        type="number" 
                        value={item.discount} 
                        onChange={e => updateItem(idx, 'discount', parseFloat(e.target.value) || 0)}
                        style={{ width: '100%', padding: '4px', border: '1px solid #D1D5DB', borderRadius: '4px' }} 
                      />
                    </td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: '600' }}>{fmt(item.total)}</td>
                    <td style={{ padding: '6px 0', textAlign: 'center' }}>
                      <button type="button" onClick={() => removeItem(idx)} style={{ color: '#EF4444', border: 'none', background: 'none', cursor: 'pointer' }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#111827', marginBottom: '14px' }}>Totals Summary</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifycontent: 'space-between' }}>
                <span>Subtotal</span>
                <span>{fmt(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center' }}>
                <span>Include GST Tax</span>
                <input type="checkbox" checked={form.is_gst_invoice} onChange={e => setField('is_gst_invoice', e.target.checked)} />
              </div>
              {form.is_gst_invoice && (
                <div style={{ display: 'flex', justifycontent: 'space-between' }}>
                  <span>Calculated GST Tax</span>
                  <span>{fmt(tax)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifycontent: 'space-between' }}>
                <Input label="Additional Order Discount (₹)" type="number" value={form.discount} onChange={e => setField('discount', parseFloat(e.target.value) || 0)} />
                <Input label="Shipping Cost (₹)" type="number" value={form.shipping_cost} onChange={e => setField('shipping_cost', parseFloat(e.target.value) || 0)} />
              </div>
              <div style={{ display: 'flex', justifycontent: 'space-between', borderTop: '1px solid #E5E7EB', paddingTop: '10px', fontSize: '16px', fontWeight: '700' }}>
                <span>Total Amount Due</span>
                <span>{fmt(total)}</span>
              </div>
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}
