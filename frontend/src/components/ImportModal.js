import React, { useState, useRef } from 'react';
import { parseCSV, validateImportData, SCHEMAS } from '../utils/importUtils';
import { showToast, Modal, Btn } from './UI';
import api from '../utils/api';

export default function ImportModal({ open, onClose, entityName, onImportSuccess }) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [validationResult, setValidationResult] = useState({ validRows: [], errors: [] });
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  if (!open) return null;

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const processFile = (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const parsed = parseCSV(text);
      if (parsed.length > 0) {
        const fileHeaders = parsed[0];
        setHeaders(fileHeaders);
        setCsvData(parsed.slice(1));
        
        // Auto map based on match
        const schema = SCHEMAS[entityName] || [];
        const newMapping = {};
        schema.forEach(field => {
          const idx = fileHeaders.findIndex(h => h.toLowerCase().trim() === field.key.toLowerCase() || h.toLowerCase().trim() === field.label.toLowerCase());
          if (idx !== -1) {
            newMapping[field.key] = idx;
          }
        });
        setMapping(newMapping);
        setStep(2);
      } else {
        showToast('Empty CSV file', 'error');
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const downloadTemplate = () => {
    const schema = SCHEMAS[entityName];
    if (!schema) return;
    const headersStr = schema.map(s => s.label).join(',');
    const exampleStr = schema.map(s => s.key === 'price' || s.key === 'stock' || s.key === 'outstanding' || s.key === 'total' || s.key === 'amount' ? '100' : 'Example').join(',');
    const csvContent = '\uFEFF' + [headersStr, exampleStr].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `OliveSeeds_${entityName}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMappingChange = (fieldKey, headerIdx) => {
    setMapping(prev => ({
      ...prev,
      [fieldKey]: headerIdx === '' ? undefined : parseInt(headerIdx)
    }));
  };

  const handleValidate = () => {
    const result = validateImportData(csvData, entityName, mapping);
    setValidationResult(result);
    setStep(3);
  };

  const handleImport = async () => {
    setImporting(true);
    const { validRows } = validationResult;
    try {
      for (let i = 0; i < validRows.length; i++) {
        setImportProgress(Math.round(((i + 1) / validRows.length) * 100));
        // Call entity POST route
        await api.post(`/${entityName}`, validRows[i]);
      }
      showToast(`Imported ${validRows.length} rows successfully`, 'success');
      if (onImportSuccess) onImportSuccess();
      onClose();
      resetState();
    } catch (err) {
      showToast(err.response?.data?.error || 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  const resetState = () => {
    setStep(1);
    setFile(null);
    setCsvData([]);
    setHeaders([]);
    setMapping({});
    setValidationResult({ validRows: [], errors: [] });
    setImportProgress(0);
  };

  return (
    <Modal open={open} onClose={() => { onClose(); resetState(); }} title={`Import CSV for ${entityName}`} width={640}>
      {step === 1 && (
        <div>
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current.click()}
            style={{
              border: isDragOver ? '2px dashed #3B5BDB' : '2px dashed #D1D5DB',
              borderRadius: '10px',
              backgroundColor: isDragOver ? '#EEF2FF' : '#F9FAFB',
              padding: '40px',
              textAlign: 'center',
              cursor: 'pointer',
              marginBottom: '20px',
              transition: 'all 120ms'
            }}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept=".csv" 
              onChange={handleFileSelect} 
            />
            <div style={{ fontSize: '14px', color: '#6B7280', fontWeight: '500' }}>
              Drag & drop your CSV file here
            </div>
            <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>
              Supports .csv - max 10MB
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Btn variant="secondary" onClick={downloadTemplate}>
              Download Template for {entityName}
            </Btn>
            <Btn variant="secondary" onClick={() => onClose()}>Cancel</Btn>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3 style={{ fontSize: '13px', color: '#1F2937', marginBottom: '12px', fontWeight: '600' }}>Preview File Columns Map</h3>
          <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '20px', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  {headers.map((h, i) => (
                    <th key={i} style={{ padding: '8px 12px', textAlign: 'left', color: '#6B7280' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvData.slice(0, 5).map((row, rIdx) => (
                  <tr key={rIdx} style={{ borderBottom: '1px solid #E5E7EB' }}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} style={{ padding: '8px 12px', color: '#374151' }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ fontSize: '13px', color: '#1F2937', marginBottom: '12px', fontWeight: '600' }}>Header Mapping</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {(SCHEMAS[entityName] || []).map(field => (
              <div key={field.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ fontWeight: '500', color: '#374151' }}>
                  {field.label} {field.required && <span style={{ color: '#DC2626' }}>*</span>}
                </span>
                <select
                  value={mapping[field.key] !== undefined ? mapping[field.key] : ''}
                  onChange={(e) => handleMappingChange(field.key, e.target.value)}
                  style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #D1D5DB', minWidth: '180px' }}
                >
                  <option value="">-- Ignore / Skip --</option>
                  {headers.map((h, idx) => (
                    <option key={idx} value={idx}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <Btn variant="secondary" onClick={() => setStep(1)}>Back</Btn>
            <Btn variant="primary" onClick={handleValidate}>Validate</Btn>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h3 style={{ fontSize: '14px', color: '#111827', fontWeight: '600', marginBottom: '12px' }}>
            Validation Summary
          </h3>
          <div style={{ padding: '12px 16px', backgroundColor: '#F9FAFB', borderRadius: '8px', marginBottom: '16px', border: '1px solid #E5E7EB' }}>
            <div style={{ color: '#16A34A', fontWeight: '600', fontSize: '13px' }}>
              {validationResult.validRows.length} rows valid
            </div>
            <div style={{ color: '#DC2626', fontWeight: '600', fontSize: '13px', marginTop: '4px' }}>
              {validationResult.errors.length} rows have issues
            </div>
          </div>

          {validationResult.errors.length > 0 && (
            <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '20px', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px', backgroundColor: '#FEF2F2' }}>
              {validationResult.errors.map((err, idx) => (
                <div key={idx} style={{ marginBottom: '8px', fontSize: '12px', color: '#B91C1C' }}>
                  <strong>Row {err.rowNum}:</strong>
                  {err.issues.map((issue, iIdx) => (
                    <div key={iIdx} style={{ marginLeft: '12px' }}>
                      • Column "{issue.column}": {issue.issue} ({issue.suggestion})
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {importing ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontWeight: '600', color: '#1A1A2E', marginBottom: '8px' }}>
                Importing... {importProgress}%
              </div>
              <div style={{ height: '6px', width: '100%', backgroundColor: '#E5E7EB', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${importProgress}%`, backgroundColor: '#1A1A2E', transition: 'width 0.1s' }} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Btn variant="secondary" onClick={() => setStep(2)}>Back</Btn>
              <Btn 
                variant="primary" 
                onClick={handleImport}
                disabled={validationResult.validRows.length === 0}
              >
                Import {validationResult.validRows.length} Rows
              </Btn>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
