import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Card, PageHeader, Btn, Table, SearchBox, Modal, Grid, Input, Textarea, Spinner } from '../components/UI';
import { useAuth } from '../utils/AuthContext';

const EMPTY = { name:'', company_name:'', gstin:'', pan:'', email:'', phone:'', address:'', city:'', state:'', pincode:'', country:'India', bank_name:'', bank_account:'', bank_ifsc:'', payment_terms:'', notes:'' };

export default function Suppliers() {
  const { canWrite, canModify } = useAuth();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try { const { data } = await api.get(`/suppliers?search=${search}`); setRows(data||[]); } catch(e) {}
    setLoading(false);
  };

  useEffect(() => { const t=setTimeout(fetch,400); return()=>clearTimeout(t); }, [search]);

  const sf = (k,v) => setForm(f=>({...f,[k]:v}));
  const openNew = () => { setForm(EMPTY); setEditId(null); setShowModal(true); };
  const openEdit = (r) => { setForm(r); setEditId(r.id); setShowModal(true); };

  const save = async () => {
    if (!form.name) return toast.error('Name required');
    setSaving(true);
    try {
      if (editId) await api.put(`/suppliers/${editId}`, form);
      else await api.post('/suppliers', form);
      toast.success('Saved'); setShowModal(false); fetch();
    } catch(e) { toast.error('Error'); }
    setSaving(false);
  };

  const cols = [
    { label:'Name', render:r=><div><div style={{fontWeight:600}}>{r.name}</div><div style={{fontSize:11,color:'var(--muted)'}}>{r.company_name}</div></div> },
    { label:'GSTIN', key:'gstin' },
    { label:'Contact', render:r=><div><div>{r.phone}</div><div style={{fontSize:11,color:'var(--muted)'}}>{r.email}</div></div> },
    { label:'City', key:'city' },
    { label:'State', key:'state' },
    { label:'Terms', key:'payment_terms' },
    { label:'Actions', render:r=>canModify&&<Btn size="sm" variant="outline" onClick={()=>openEdit(r)}>✏️ Edit</Btn> }
  ];

  return (
    <div>
      <PageHeader title="🏪 Suppliers" subtitle={`${rows.length} suppliers`} actions={canWrite&&<Btn onClick={openNew}>➕ Add Supplier</Btn>} />
      <Card style={{marginBottom:16}}><SearchBox value={search} onChange={setSearch} placeholder="Search suppliers..." /></Card>
      <Card>{loading?<Spinner/>:<Table cols={cols} rows={rows} />}</Card>
      <Modal open={showModal} onClose={()=>setShowModal(false)} title={editId?'Edit Supplier':'New Supplier'} width={700}>
        <Grid cols={2} gap={12}>
          <Input label="Name *" value={form.name} onChange={e=>sf('name',e.target.value)} />
          <Input label="Company Name" value={form.company_name||''} onChange={e=>sf('company_name',e.target.value)} />
          <Input label="GSTIN" value={form.gstin||''} onChange={e=>sf('gstin',e.target.value)} />
          <Input label="PAN" value={form.pan||''} onChange={e=>sf('pan',e.target.value)} />
          <Input label="Email" value={form.email||''} onChange={e=>sf('email',e.target.value)} />
          <Input label="Phone" value={form.phone||''} onChange={e=>sf('phone',e.target.value)} />
          <Input label="City" value={form.city||''} onChange={e=>sf('city',e.target.value)} />
          <Input label="State" value={form.state||''} onChange={e=>sf('state',e.target.value)} />
          <Input label="Bank Name" value={form.bank_name||''} onChange={e=>sf('bank_name',e.target.value)} />
          <Input label="Account No" value={form.bank_account||''} onChange={e=>sf('bank_account',e.target.value)} />
          <Input label="IFSC" value={form.bank_ifsc||''} onChange={e=>sf('bank_ifsc',e.target.value)} />
          <Input label="Payment Terms" value={form.payment_terms||''} onChange={e=>sf('payment_terms',e.target.value)} />
          <div style={{gridColumn:'span 2'}}><Textarea label="Address" value={form.address||''} onChange={e=>sf('address',e.target.value)} /></div>
        </Grid>
        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
          <Btn variant="ghost" onClick={()=>setShowModal(false)}>Cancel</Btn>
          <Btn onClick={save} disabled={saving}>{saving?'Saving...':'💾 Save'}</Btn>
        </div>
      </Modal>
    </div>
  );
}
