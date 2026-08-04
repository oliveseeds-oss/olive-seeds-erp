import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Card, PageHeader, Btn, Table, SearchBox, Modal, Grid, Input, Select, Textarea, Spinner, fmtDate, fmt } from '../components/UI';
import { useAuth } from '../utils/AuthContext';

const EMPTY = { name:'', customer_type:'personal', company_name:'', gstin:'', pan:'', email:'', phone:'', billing_address:'', billing_city:'', billing_state:'', billing_pincode:'', billing_country:'India', shipping_address:'', shipping_city:'', shipping_state:'', shipping_pincode:'', shipping_country:'India', currency:'INR', notes:'' };

export default function Customers() {
  const { canWrite } = useAuth();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit:100 });
      if (search) params.set('search',search);
      if (type) params.set('type',type);
      const { data } = await api.get(`/customers?${params}`);
      setRows(data.customers||[]); setTotal(data.total||0);
    } catch(e) {}
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [type]);
  useEffect(() => { const t=setTimeout(fetch,400); return()=>clearTimeout(t); }, [search]);

  const openNew = () => { setForm(EMPTY); setEditId(null); setShowModal(true); };
  const openEdit = (r) => { setForm(r); setEditId(r.id); setShowModal(true); };

  const save = async () => {
    if (!form.name) return toast.error('Name required');
    setSaving(true);
    try {
      if (editId) await api.put(`/customers/${editId}`, form);
      else await api.post('/customers', form);
      toast.success(editId?'Customer updated':'Customer created');
      setShowModal(false); fetch();
    } catch(e) { toast.error(e.response?.data?.error||'Error'); }
    setSaving(false);
  };

  const sf = (k,v) => setForm(f=>({...f,[k]:v}));

  const cols = [
    { label:'ID', key:'customer_id' },
    { label:'Name', render:r=><div><div style={{fontWeight:600}}>{r.name}</div><div style={{fontSize:11,color:'var(--muted)'}}>{r.company_name}</div></div> },
    { label:'Type', render:r=><span style={{textTransform:'capitalize'}}>{r.customer_type}</span> },
    { label:'Contact', render:r=><div><div style={{fontSize:13}}>{r.phone}</div><div style={{fontSize:11,color:'var(--muted)'}}>{r.email}</div></div> },
    { label:'GSTIN', key:'gstin' },
    { label:'City', key:'billing_city' },
    { label:'Actions', render:r=>(
      <div style={{display:'flex',gap:6}}>
        {canWrite && <Btn size="sm" variant="outline" onClick={()=>openEdit(r)}>✏️ Edit</Btn>}
      </div>
    )}
  ];

  return (
    <div>
      <PageHeader title="👥 Customers" subtitle={`${total} customers`}
        actions={canWrite && <Btn onClick={openNew}>➕ Add Customer</Btn>} />
      <Card style={{marginBottom:16}}>
        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
          <SearchBox value={search} onChange={setSearch} placeholder="Search name, phone, email..." />
          <select value={type} onChange={e=>setType(e.target.value)} style={{border:'1px solid var(--border)',borderRadius:7,padding:'8px 10px',fontSize:13}}>
            <option value="">All Types</option>
            {['personal','business','wholesale','corporate','international'].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
          </select>
        </div>
      </Card>
      <Card>{loading?<Spinner/>:<Table cols={cols} rows={rows} />}</Card>

      <Modal open={showModal} onClose={()=>setShowModal(false)} title={editId?'Edit Customer':'New Customer'} width={700}>
        <Grid cols={2} gap={12}>
          <Input label="Full Name *" value={form.name} onChange={e=>sf('name',e.target.value)} />
          <Select label="Type" value={form.customer_type} onChange={e=>sf('customer_type',e.target.value)}>
            {['personal','business','wholesale','corporate','international'].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
          </Select>
          <Input label="Company Name" value={form.company_name||''} onChange={e=>sf('company_name',e.target.value)} />
          <Input label="GSTIN" value={form.gstin||''} onChange={e=>sf('gstin',e.target.value)} />
          <Input label="PAN" value={form.pan||''} onChange={e=>sf('pan',e.target.value)} />
          <Input label="Phone" value={form.phone||''} onChange={e=>sf('phone',e.target.value)} />
          <Input label="Email" type="email" value={form.email||''} onChange={e=>sf('email',e.target.value)} />
          <Select label="Currency" value={form.currency||'INR'} onChange={e=>sf('currency',e.target.value)}>
            {['INR','USD','EUR','GBP','AED','SGD','AUD'].map(c=><option key={c}>{c}</option>)}
          </Select>
        </Grid>
        <div style={{marginTop:12}}>
          <Textarea label="Billing Address" value={form.billing_address||''} onChange={e=>sf('billing_address',e.target.value)} />
          <Grid cols={3} gap={10} style={{marginTop:8}}>
            <Input label="City" value={form.billing_city||''} onChange={e=>sf('billing_city',e.target.value)} />
            <Input label="State" value={form.billing_state||''} onChange={e=>sf('billing_state',e.target.value)} />
            <Input label="Pincode" value={form.billing_pincode||''} onChange={e=>sf('billing_pincode',e.target.value)} />
          </Grid>
          <Input label="Country" value={form.billing_country||'India'} onChange={e=>sf('billing_country',e.target.value)} style={{marginTop:8}} />
          <Textarea label="Notes" value={form.notes||''} onChange={e=>sf('notes',e.target.value)} style={{marginTop:8}} />
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
          <Btn variant="ghost" onClick={()=>setShowModal(false)}>Cancel</Btn>
          <Btn onClick={save} disabled={saving}>{saving?'Saving...':'💾 Save'}</Btn>
        </div>
      </Modal>
    </div>
  );
}
