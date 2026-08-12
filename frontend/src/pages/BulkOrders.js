import React, { useEffect, useState, useRef } from 'react';
import api from '../utils/api';
import { useAuth } from '../utils/AuthContext';
import { Card, PageHeader, Btn, TableSkeleton, fmtDate, showToast } from '../components/UI';

export default function BulkOrders() {
  const { user, canWrite } = useAuth();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bulk/batches');
      setBatches(res.data);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load bulk batches', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const downloadTemplate = async () => {
    try {
      const res = await api.get('/bulk/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bulk_order_template.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast('Template downloaded successfully', 'success');
    } catch (err) {
      showToast('Failed to download template', 'error');
    }
  };

  const uploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const res = await api.post('/bulk/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showToast(`Batch BTCH-${res.data.batch_id} processed successfully: ${res.data.created} orders created`, 'success');
      fetchBatches();
    } catch (err) {
      showToast(err.response?.data?.error || 'Upload failed', 'error');
    } finally {
      setUploading(false);
      fileRef.current.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <PageHeader 
        title="Bulk Orders"
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <Btn variant="outline" onClick={downloadTemplate}>
              Download Template
            </Btn>
            {canWrite && (
              <Btn variant="primary" onClick={() => fileRef.current.click()} disabled={uploading}>
                {uploading ? 'Uploading...' : 'Upload Excel/CSV'}
              </Btn>
            )}
            <input ref={fileRef} type="file" accept=".csv,.xlsx" onChange={uploadFile} style={{ display: 'none' }} />
          </div>
        }
      />

      {/* Guide Banner */}
      <Card style={{ background: '#EEF2FF', borderLeft: '4px solid #3B5BDB' }}>
        <div style={{ fontWeight: '700', color: '#1E3A8A', marginBottom: '6px' }}>Bulk Orders Upload Instructions</div>
        <ol style={{ fontSize: '13px', color: '#374151', paddingLeft: '20px', lineHeight: '1.6' }}>
          <li>Download the template file above.</li>
          <li>Add order information (customer info, SKU, price, quantity, HSN, etc.) to the spreadsheet.</li>
          <li>Upload the finished document using the "Upload Excel/CSV" button.</li>
        </ol>
      </Card>

      {/* Batches Table */}
      <Card style={{ padding: '0px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Batch ID</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Name</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Orders Count</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Source File</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Status</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Uploaded By</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={7} rows={3} />
            ) : batches.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>No upload batches found.</td>
              </tr>
            ) : (
              batches.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>BTCH-{row.id}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.name || 'Bulk Sync'}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '700' }}>{row.total_orders}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.source_file}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className="badge-status status-completed">{row.status}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.created_by_name || 'Admin'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{fmtDate(row.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
