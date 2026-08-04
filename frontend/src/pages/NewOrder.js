import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Card, PageHeader, Btn, Input, Select, Textarea, Grid, fmt } from '../components/UI';

export default function NewOrder() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    customer_id:'', customer_name:'', customer_email:'', customer_phone:'',
    billing_address:'', shipping_address:'', shipping_city:'', shipping_state:'',
    shipping_pincode:'', shipping_country:'India',
    source:'manual', order_type:'regular', is_gst_invoice:true, is_international:false,
    currency:'INR', exchange_rate:1, discount:0, shipping_cost:0,
    notes:'', personalization_notes:'', payment_method:'',
    items:[]
  });

  useEffect(() => {
    api.get('/customers?limit=200').then(r=>setCustomers(r.data.customers||[]));
    api.get('/products?limit=500').then(r=>setProducts(r.data.products||[]));
  }, []);

  useEffect(() => {
    if (productSearch.length > 1) {
      setFilteredProducts(products.filter(p=>p.name.toLowerCase().includes(productSearch.toLowerCase())||p.sku?.toLowerCase().includes(productSearch.toLowerCase())).slice(0,10));
    } else setFilteredProducts([]);
  }, [productSearch, products]);

  const setField = (k, v) => setForm(f=>({...f, [k]:v}));

  const selectCustomer = (cid) => {
    const c = customers.find(x=>x.id===parseInt(cid));
    if (c) {
      setForm(f=>({...f, customer_id:cid, customer_name:c.name, customer_email:c.email||'', customer_phone:c.phone||'',
        billing_address:c.billing_address||'', shipping_address:c.shipping_address||c.billing_address||'',
        shipping_city:c.shipping_city||c.billing_city||'', shipping_state:c.shipping_state||c.billing_state||'',
        shipping_pincode:c.shipping_pincode||c.billing_pincode||'', shipping_country:c.shipping_country||'India'}));
    }
  };

  const addProduct = (p) => {
    setProductSearch('');
    setFilteredProducts([]);
    const existing = form.items.findIndex(i=>i.product_id===p.id);
    if (existing>=0) {
      const items=[...form.items];
      items[existing].quantity++;
      items[existing].total = items[existing].quantity * items[existing].unit_price;
      setField('items', items);
    } else {
      setField('items', [...form.items, {
        product_id:p.id, product_name:p.name, sku:p.sku||'', hsn_code:p.hsn_code||'',
        quantity:1, unit_price:p.selling_price, discount:0, gst_percent:p.gst_percent||0,
        total:p.selling_price, personalization:''
      }]);
    }
  };

  const updateItem = (idx, field, val) => {
    const items = [...form.items];
    items[idx][field] = val;
    items[idx].total = (items[idx].quantity * items[idx].unit_price) - (items[idx].discount||0);
    setField('items', items);
  };

  const removeItem = (idx) => setField('items', form.items.filter((_,i)=>i!==idx));

  const calcTotals = () => {
    const subtotal = form.items.reduce((s,i)=>s+parseFloat(i.total||0), 0);
    const isInterstate = form.shipping_state && form.shipping_state.toLowerCase() !== 'tamil nadu';
    let cgst=0, sgst=0, igst=0;
    if (form.is_gst_invoice && !form.is_international) {
      form.items.forEach(item=>{
        const taxable = parseFloat(item.total||0);
        const gst = taxable * (parseFloat(item.gst_percent)||0) / 100;
        if (isInterstate) igst+=gst; else { cgst+=gst/2; sgst+=gst/2; }
      });
    }
    const total_tax = cgst+sgst+igst;
    const total = subtotal - parseFloat(form.discount||0) + total_tax + parseFloat(form.shipping_cost||0);
    return { subtotal, cgst, sgst, igst, total_tax, total };
  };

  const { subtotal, cgst, sgst, igst, total_tax, total } = calcTotals();

  const handleSubmit = async () => {
    if (!form.items.length) return toast.error('Add at least one product');
    if (!form.customer_name) return toast.error('Customer name required');
    setSaving(true);
    try {
      const { data } = await api.post('/orders', { ...form, items: form.items });
      toast.success(`Order ${data.order_id} created!`);
      navigate(`/orders/${data.id}`);
    } catch(e) { toast.error(e.response?.data?.error||'Error creating order'); }
    setSaving(false);
  };

  return (
    <div>
      <PageHeader title="➕ New Order" subtitle="Create a new order"
        actions={<><Btn variant="ghost" onClick={()=>navigate('/orders')}>Cancel</Btn><Btn onClick={handleSubmit} disabled={saving}>{saving?'Saving...':'💾 Save Order'}</Btn></>} />

      <Grid cols={2} gap={16}>
        {/* Left */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <Card>
            <h3 style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>📋 Order Details</h3>
            <Grid cols={2} gap={12}>
              <Select label="Source" value={form.source} onChange={e=>setField('source',e.target.value)}>
                {['manual','website','amazon','flipkart','etsy','instagram','whatsapp','walkin'].map(s=><option key={s} value={s} style={{textTransform:'capitalize'}}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </Select>
              <Select label="Order Type" value={form.order_type} onChange={e=>setField('order_type',e.target.value)}>
                <option value="regular">Regular</option>
                <option value="bulk">Bulk</option>
                <option value="digital">Digital</option>
                <option value="service">Service</option>
              </Select>
              <Select label="Currency" value={form.currency} onChange={e=>setField('currency',e.target.value)}>
                {['INR','USD','EUR','GBP','AED','SGD','AUD','CAD'].map(c=><option key={c}>{c}</option>)}
              </Select>
              <Select label="Payment Method" value={form.payment_method} onChange={e=>setField('payment_method',e.target.value)}>
                <option value="">Select...</option>
                {['cash','upi','card','netbanking','bank_transfer','paypal','cod','advance'].map(m=><option key={m} value={m}>{m.toUpperCase()}</option>)}
              </Select>
            </Grid>
            <div style={{ display:'flex', gap:16, marginTop:12 }}>
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}>
                <input type="checkbox" checked={form.is_gst_invoice} onChange={e=>setField('is_gst_invoice',e.target.checked)} />GST Invoice
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}>
                <input type="checkbox" checked={form.is_international} onChange={e=>setField('is_international',e.target.checked)} />International Order
              </label>
            </div>
          </Card>

          <Card>
            <h3 style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>👤 Customer</h3>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:4 }}>Select Existing Customer</label>
              <select onChange={e=>selectCustomer(e.target.value)} style={{ width:'100%', border:'1px solid var(--border)', borderRadius:6, padding:'8px 10px', fontSize:13 }}>
                <option value="">-- Walk-in / New Customer --</option>
                {customers.map(c=><option key={c.id} value={c.id}>{c.name} {c.phone?`(${c.phone})`:''}</option>)}
              </select>
            </div>
            <Grid cols={2} gap={10}>
              <Input label="Customer Name *" value={form.customer_name} onChange={e=>setField('customer_name',e.target.value)} required />
              <Input label="Phone" value={form.customer_phone} onChange={e=>setField('customer_phone',e.target.value)} />
              <Input label="Email" type="email" value={form.customer_email} onChange={e=>setField('customer_email',e.target.value)} style={{ gridColumn:'span 1' }} />
            </Grid>
          </Card>

          <Card>
            <h3 style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>📍 Shipping Address</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <Textarea label="Address" value={form.shipping_address} onChange={e=>setField('shipping_address',e.target.value)} style={{ minHeight:60 }} />
              <Grid cols={2} gap={10}>
                <Input label="City" value={form.shipping_city} onChange={e=>setField('shipping_city',e.target.value)} />
                <Input label="State" value={form.shipping_state} onChange={e=>setField('shipping_state',e.target.value)} />
                <Input label="Pincode" value={form.shipping_pincode} onChange={e=>setField('shipping_pincode',e.target.value)} />
                <Input label="Country" value={form.shipping_country} onChange={e=>setField('shipping_country',e.target.value)} />
              </Grid>
            </div>
          </Card>

          <Card>
            <h3 style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>📝 Notes</h3>
            <Textarea label="Order Notes" value={form.notes} onChange={e=>setField('notes',e.target.value)} style={{ minHeight:60 }} />
            <div style={{ marginTop:10 }}>
              <Textarea label="Personalization / Engraving Notes" value={form.personalization_notes} onChange={e=>setField('personalization_notes',e.target.value)} style={{ minHeight:60 }} />
            </div>
          </Card>
        </div>

        {/* Right */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <Card>
            <h3 style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>🔍 Add Products</h3>
            <div style={{ position:'relative' }}>
              <input value={productSearch} onChange={e=>setProductSearch(e.target.value)} placeholder="Search product by name or SKU..."
                style={{ width:'100%', border:'1px solid var(--border)', borderRadius:6, padding:'9px 12px', fontSize:13, outline:'none' }} />
              {filteredProducts.length > 0 && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1px solid var(--border)', borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', zIndex:50, maxHeight:280, overflowY:'auto' }}>
                  {filteredProducts.map(p=>(
                    <div key={p.id} onClick={()=>addProduct(p)} style={{ padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}
                      onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'} onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600 }}>{p.name}</div>
                        <div style={{ fontSize:11, color:'var(--muted)' }}>SKU: {p.sku||'-'} | Stock: {p.stock} | HSN: {p.hsn_code||'-'}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontWeight:700, color:'var(--primary)' }}>{fmt(p.selling_price)}</div>
                        <div style={{ fontSize:11, color:'var(--muted)' }}>GST: {p.gst_percent}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <h3 style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>🛍️ Order Items</h3>
            {form.items.length === 0
              ? <p style={{ color:'var(--muted)', textAlign:'center', padding:20, fontSize:13 }}>No items added yet. Search and add products above.</p>
              : form.items.map((item, idx) => (
                <div key={idx} style={{ border:'1px solid var(--border)', borderRadius:8, padding:12, marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                    <span style={{ fontWeight:600, fontSize:13 }}>{item.product_name}</span>
                    <button onClick={()=>removeItem(idx)} style={{ background:'none', border:'none', color:'var(--danger)', cursor:'pointer', fontSize:16 }}>✕</button>
                  </div>
                  <Grid cols={4} gap={8}>
                    <div>
                      <label style={{ fontSize:11, color:'var(--muted)' }}>Qty</label>
                      <input type="number" min="1" value={item.quantity} onChange={e=>updateItem(idx,'quantity',parseInt(e.target.value)||1)}
                        style={{ width:'100%', border:'1px solid var(--border)', borderRadius:5, padding:'5px 8px', fontSize:13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize:11, color:'var(--muted)' }}>Unit Price</label>
                      <input type="number" step="0.01" value={item.unit_price} onChange={e=>updateItem(idx,'unit_price',parseFloat(e.target.value)||0)}
                        style={{ width:'100%', border:'1px solid var(--border)', borderRadius:5, padding:'5px 8px', fontSize:13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize:11, color:'var(--muted)' }}>Discount</label>
                      <input type="number" step="0.01" value={item.discount} onChange={e=>updateItem(idx,'discount',parseFloat(e.target.value)||0)}
                        style={{ width:'100%', border:'1px solid var(--border)', borderRadius:5, padding:'5px 8px', fontSize:13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize:11, color:'var(--muted)' }}>GST %</label>
                      <input type="number" step="0.01" value={item.gst_percent} onChange={e=>updateItem(idx,'gst_percent',parseFloat(e.target.value)||0)}
                        style={{ width:'100%', border:'1px solid var(--border)', borderRadius:5, padding:'5px 8px', fontSize:13 }} />
                    </div>
                  </Grid>
                  <div style={{ marginTop:8 }}>
                    <input value={item.personalization} onChange={e=>updateItem(idx,'personalization',e.target.value)} placeholder="Personalization / engraving text..."
                      style={{ width:'100%', border:'1px solid var(--border)', borderRadius:5, padding:'5px 8px', fontSize:12 }} />
                  </div>
                  <div style={{ textAlign:'right', marginTop:6, fontWeight:700, color:'var(--primary)' }}>{fmt(item.total)}</div>
                </div>
              ))
            }

            {/* Totals */}
            {form.items.length > 0 && (
              <div style={{ borderTop:'2px solid var(--border)', paddingTop:12, marginTop:4 }}>
                <Grid cols={2} gap={10} style={{ marginBottom:8 }}>
                  <Input label="Order Discount (₹)" type="number" value={form.discount} onChange={e=>setField('discount',e.target.value)} />
                  <Input label="Shipping Cost (₹)" type="number" value={form.shipping_cost} onChange={e=>setField('shipping_cost',e.target.value)} />
                </Grid>
                {[
                  ['Subtotal', fmt(subtotal)],
                  cgst > 0 ? ['CGST', fmt(cgst)] : null,
                  sgst > 0 ? ['SGST', fmt(sgst)] : null,
                  igst > 0 ? ['IGST', fmt(igst)] : null,
                  parseFloat(form.discount) > 0 ? ['Discount', `-${fmt(form.discount)}`] : null,
                  parseFloat(form.shipping_cost) > 0 ? ['Shipping', fmt(form.shipping_cost)] : null,
                ].filter(Boolean).map(([l,v],i)=>(
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', fontSize:13, color:'var(--muted)' }}>
                    <span>{l}</span><span>{v}</span>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', fontSize:17, fontWeight:800, color:'var(--primary)', borderTop:'1px solid var(--border)', marginTop:8 }}>
                  <span>TOTAL</span><span>{fmt(total)}</span>
                </div>
              </div>
            )}
          </Card>

          <Btn onClick={handleSubmit} disabled={saving} size="lg" style={{ width:'100%', justifyContent:'center' }}>
            {saving ? '⏳ Saving Order...' : '✅ Create Order'}
          </Btn>
        </div>
      </Grid>
    </div>
  );
}
