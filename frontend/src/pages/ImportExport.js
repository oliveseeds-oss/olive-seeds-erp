import React, { useState } from 'react';
import api from '../utils/api';
import { Card, PageHeader, Btn, Select, Input } from '../components/UI';
import toast from 'react-hot-toast';

export default function ImportExport() {
  const [activeTab, setActiveTab] = useState('import'); // 'import' | 'export'
  const [importEntity, setImportEntity] = useState('customers');
  const [exportEntity, setExportEntity] = useState('customers');
  const [exportFormat, setExportFormat] = useState('xlsx');
  
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const downloadTemplate = async (entity) => {
    try {
      setLoading(true);
      const res = await api.get(
        `/import-export/template/${entity}`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entity}_template.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded successfully');
    } catch (err) {
      toast.error('Download failed: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  };

  const exportData = async (entity, format) => {
    try {
      setExporting(true);
      const params = { format };
      if (exportFrom) params.from = exportFrom;
      if (exportTo) params.to = exportTo;
      
      const res = await api.get(
        `/import-export/export/${entity}`,
        { params, responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entity}_export.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success(`${entity} exported successfully`);
    } catch (err) {
      toast.error('Export failed: ' + (err.message || 'Error'));
    } finally {
      setExporting(false);
    }
  };

  const uploadFile = async (entity, file) => {
    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    setUploadResult(null);
    try {
      const res = await api.post(
        `/import-export/upload/${entity}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      toast.success(
        `Imported: ${res.data.created} created, ${res.data.failed} failed`
      );
      setUploadResult(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px' }}>
      <PageHeader title="Data Import & Export" />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #E5E7EB', paddingBottom: '4px' }}>
        <Btn variant={activeTab === 'import' ? 'primary' : 'outline'} onClick={() => setActiveTab('import')}>
          📥 Import Data
        </Btn>
        <Btn variant={activeTab === 'export' ? 'primary' : 'outline'} onClick={() => setActiveTab('export')}>
          📤 Export Data
        </Btn>
      </div>

      {activeTab === 'import' && (
        <Card style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: 'bold' }}>1. Choose Entity to Import</h3>
            <Select value={importEntity} onChange={(e) => { setImportEntity(e.target.value); setUploadResult(null); }}>
              <option value="customers">Customers</option>
              <option value="products">Products</option>
              <option value="expenses">Expenses</option>
              <option value="suppliers">Suppliers</option>
            </Select>
          </div>

          <div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: 'bold' }}>2. Download XLSX Template</h3>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 12px 0' }}>
              Download the structured spreadsheet template for this entity. Fill out your rows and keep headers unchanged.
            </p>
            <Btn variant="outline" onClick={() => downloadTemplate(importEntity)} disabled={loading}>
              {loading ? 'Downloading...' : 'Download Template'}
            </Btn>
          </div>

          <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '20px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: 'bold' }}>3. Upload File</h3>
            <input 
              type="file" 
              accept=".xlsx,.xls"
              onChange={(e) => setSelectedFile(e.target.files[0])}
              style={{
                display: 'block',
                margin: '0 0 12px 0',
                fontSize: '13px',
                color: '#374151'
              }}
            />
            <Btn variant="primary" onClick={() => uploadFile(importEntity, selectedFile)} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Import Spreadsheet'}
            </Btn>
          </div>

          {uploadResult && (
            <div style={{
              marginTop: '10px',
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: uploadResult.failed > 0 ? '#FEF2F2' : '#ECFDF3',
              border: `1px solid ${uploadResult.failed > 0 ? '#FCA5A5' : '#86EFAC'}`,
              fontSize: '13px'
            }}>
              <h4 style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#111827' }}>Import Results:</h4>
              <p style={{ margin: '0 0 4px 0' }}>Total Records Processed: <strong>{uploadResult.total}</strong></p>
              <p style={{ margin: '0 0 4px 0', color: '#166534' }}>Successfully Created: <strong>{uploadResult.created}</strong></p>
              <p style={{ margin: '0 0 4px 0', color: '#991B1B' }}>Failed / Skipped: <strong>{uploadResult.failed}</strong></p>
              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#7F1D1D' }}>
                  <span style={{ fontWeight: 'bold' }}>Recent Errors:</span>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    {uploadResult.errors.map((e, idx) => <li key={idx}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'export' && (
        <Card style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: 'bold' }}>1. Choose Entity to Export</h3>
            <Select value={exportEntity} onChange={(e) => setExportEntity(e.target.value)}>
              <option value="customers">Customers</option>
              <option value="products">Products</option>
              <option value="orders">Orders</option>
              <option value="invoices">Invoices</option>
              <option value="payments">Payments</option>
              <option value="expenses">Expenses</option>
              <option value="suppliers">Suppliers</option>
              <option value="shipments">Shipments</option>
              <option value="quotations">Quotations</option>
            </Select>
          </div>

          <div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: 'bold' }}>2. Select Date Range (Optional)</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Input label="From Date" type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} />
              <Input label="To Date" type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} />
            </div>
          </div>

          <div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: 'bold' }}>3. Format</h3>
            <Select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV (.csv)</option>
            </Select>
          </div>

          <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '20px' }}>
            <Btn variant="primary" onClick={() => exportData(exportEntity, exportFormat)} disabled={exporting}>
              {exporting ? 'Exporting...' : 'Export Data'}
            </Btn>
          </div>
        </Card>
      )}
    </div>
  );
}
