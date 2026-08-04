import React, { useEffect, useState, useRef } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Card, PageHeader, Btn, Table, Badge, Spinner, fmtDate } from '../components/UI';
import { useAuth } from '../utils/AuthContext';

export default function BulkOrders() {
  const { canWrite } = useAuth();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const fetch = async () => {
    setLoading(true);
    try { const { data } = await api.get('/bulk/batches'); setBatches(data||[]); }
    catch(e) {} setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const downloadTemplate = () => { window.open('/api/bulk/template', '_blank'); };

  const uploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const { data } = await api.post('/bulk/upload', formData, { headers:{'Content-Type':'multipart/form-data'} });
      toast.success(`✅ Batch ${data.batch_id}: ${data.created} orders created, ${data.failed} failed`);
      fetch();
    } catch(e) { toast.error(e.response?.data?.error||'Upload failed'); }
    setUploading(false);
    fileRef.current.value = '';
  };

  const cols = [
    { label:'Batch ID', key:'batch_id' },
    { label:'Name', key:'name' },
    { label:'Orders', render:r=><span style={{fontWeight:700}}>{r.total_orders}</span> },
    { label:'Source File', key:'source_file' },
    { label:'Status', render:r=><Badge color={r.status==='completed'?'green':r.status==='failed'?'red':'yellow'}>{r.status}</Badge> },
    { label:'Created By', key:'created_by_name' },
    { label:'Date', render:r=>fmtDate(r.created_at) }
  ];

  return (
    <div>
      <PageHeader title="📋 Bulk Orders" subtitle="Upload Excel/CSV for mass order creation"
        actions={
          <div style={{display:'flex',gap:8}}>
            <Btn variant="outline" onClick={downloadTemplate}>⬇️ Download Template</Btn>
            {canWrite && <Btn onClick={()=>fileRef.current.click()} disabled={uploading}>{uploading?'⏳ Uploading...':'📤 Upload Excel/CSV'}</Btn>}
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={uploadFile} style={{display:'none'}} />
          </div>
        } />

      <Card style={{marginBottom:16,background:'linear-gradient(135deg,#f0f9ff,#e0f2fe)',border:'1px solid #bae6fd'}}>
        <h3 style={{fontSize:14,fontWeight:700,color:'#0369a1',marginBottom:8}}>📋 How to use Bulk Orders</h3>
        <ol style={{fontSize:13,color:'#0c4a6e',lineHeight:1.8,paddingLeft:20}}>
          <li>Click <strong>"Download Template"</strong> to get the Excel template</li>
          <li>Fill in customer details, product info, and pricing</li>
          <li>Upload the filled Excel/CSV file</li>
          <li>System will auto-create all orders, calculate GST, and update inventory</li>
          <li>Then go to Orders page to generate invoices in bulk</li>
        </ol>
        <div style={{marginTop:12,fontSize:12,color:'#0369a1'}}>
          <strong>Template Columns:</strong> Customer Name, Email, Phone, Address, City, State, Pincode, Country, Product Name, SKU, HSN Code, Quantity, Unit Price, GST%, Shipping, GST Invoice (Yes/No), Source, Notes
        </div>
      </Card>

      <Card><h3 style={{fontSize:14,fontWeight:700,marginBottom:12}}>📦 Upload History</h3>
        {loading?<Spinner/>:<Table cols={cols} rows={batches} emptyMsg="No bulk uploads yet" />}
      </Card>
    </div>
  );
}
