import React, { useState } from 'react';
import { useTheme } from '../utils/AuthContext';
import { parseCSV, SCHEMAS, validateImportData } from '../utils/importUtils';
import toast from 'react-hot-toast';
import { Btn, Card, Table } from './UI';

export default function ImportWizard({ open, onClose, schemaKey, onImportComplete }) {
  const theme = useTheme();
  
  // Step 1: Upload, Step 2: Mapping, Step 3: Validate, Step 4: Import Progress
  const [step, setStep] = useState(1);
  const [fileData, setFileData] = useState([]);
  const [fileHeaders, setFileHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [validationResults, setValidationResults] = useState({ validRows: [], errors: [] });
  const [importProgress, setImportProgress] = useState(0);

  const schema = SCHEMAS[schemaKey] || [];

  if (!open) return null;

  // Step 1: File parsing
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const parsed = parseCSV(text);
      if (parsed.length <= 1) {
        toast.error("File is empty or invalid.");
        return;
      }
      
      const headers = parsed[0].map(h => h.trim());
      const rows = parsed.slice(1);
      
      setFileHeaders(headers);
      setFileData(rows);

      // Pre-map matches
      const initialMap = {};
      schema.forEach(field => {
        const matchingHeader = headers.find(h => h.toLowerCase() === field.label.toLowerCase() || h.toLowerCase() === field.key.toLowerCase());
        if (matchingHeader !== undefined) {
          initialMap[field.key] = headers.indexOf(matchingHeader);
        }
      });
      setMapping(initialMap);
      setStep(2);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target.result;
        const parsed = parseCSV(text);
        if (parsed.length <= 1) {
          toast.error("File is empty or invalid.");
          return;
        }
        const headers = parsed[0].map(h => h.trim());
        const rows = parsed.slice(1);
        setFileHeaders(headers);
        setFileData(rows);
        const initialMap = {};
        schema.forEach(field => {
          const match = headers.find(h => h.toLowerCase() === field.label.toLowerCase() || h.toLowerCase() === field.key.toLowerCase());
          if (match !== undefined) initialMap[field.key] = headers.indexOf(match);
        });
        setMapping(initialMap);
        setStep(2);
      };
      reader.readAsText(file);
    }
  };

  // Step 2: Mapping configuration
  const handleMappingChange = (fieldKey, headerIndex) => {
    setMapping(prev => ({
      ...prev,
      [fieldKey]: headerIndex === "" ? undefined : parseInt(headerIndex)
    }));
  };

  const handleStartValidation = () => {
    // Check if required mappings are configured
    const missingRequired = schema.filter(f => f.required && mapping[f.key] === undefined);
    if (missingRequired.length > 0) {
      toast.error(`Please map required fields: ${missingRequired.map(f => f.label).join(', ')}`);
      return;
    }

    // Run verification
    const results = validateImportData(fileData, schemaKey, mapping);
    setValidationResults(results);
    setStep(3);
  };

  // Step 3: Run final import
  const handleTriggerImport = () => {
    setStep(4);
    setImportProgress(10);
    
    // Simulate background worker imports
    const interval = setInterval(() => {
      setImportProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          toast.success(`Successfully imported ${validationResults.validRows.length} records!`);
          if (onImportComplete) {
            onImportComplete(validationResults.validRows);
          }
          // Enable undo window
          const mockUndoSession = setTimeout(() => {
            console.log('Undo window expired.');
          }, 30 * 60 * 1000);
          return 100;
        }
        return prev + 30;
      });
    }, 400);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000, 
      background: 'rgba(12, 17, 29, 0.45)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{
        width: '100%', maxWidth: '720px', maxHeight: '90vh',
        backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E4E7EC',
        boxShadow: '0 12px 32px rgba(16,24,40,0.12)', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', animation: 'scaleIn 220ms ease-out'
      }}>
        
        {/* Wizard Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #EAECF0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#101828' }}>
            📥 Import {schemaKey.charAt(0).toUpperCase() + schemaKey.slice(1)} Wizard - Step {step} of 4
          </h3>
          <button onClick={onClose} style={{ fontSize: '18px', color: '#98A2B3', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Steps Indicators */}
        <div style={{ display: 'flex', borderBottom: '1px solid #EAECF0', padding: '10px 20px', gap: '20px' }}>
          {['Upload File', 'Map Columns', 'Verify Data', 'Complete'].map((sName, sIdx) => (
            <div key={sIdx} style={{
              fontSize: '12px', fontWeight: 600, paddingBottom: '4px',
              borderBottom: step === sIdx + 1 ? `2.5px solid var(--primary)` : '2.5px solid transparent',
              color: step === sIdx + 1 ? 'var(--primary)' : '#98A2B3'
            }}>
              {sIdx + 1}. {sName}
            </div>
          ))}
        </div>

        {/* Wizard Body content */}
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
          
          {/* STEP 1: Upload */}
          {step === 1 && (
            <div>
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                style={{
                  border: '2px dashed #D0D5DD', borderRadius: '12px', padding: '40px 20px',
                  textAlign: 'center', backgroundColor: '#F9FAFB', cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onClick={() => document.getElementById('file-import-input').click()}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#344054' }}>
                  Drag & drop your CSV or Excel file here
                </p>
                <p style={{ fontSize: '12px', color: '#98A2B3', marginTop: '4px' }}>
                  or click to browse — max 10MB — .csv format supported
                </p>
                <input 
                  id="file-import-input" 
                  type="file" 
                  accept=".csv" 
                  style={{ display: 'none' }} 
                  onChange={handleFileUpload} 
                />
              </div>

              {/* Template Download center */}
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#667085' }}>Download Sample Template:</span>
                <a 
                  href={`data:text/csv;charset=utf-8,${encodeURIComponent(
                    schema.map(f => f.label).join(',') + '\n' +
                    schema.map(f => f.required ? 'Required field description' : 'Optional description').join(',') + '\n' +
                    schema.map((f, i) => i === 0 ? 'Example_Value' : '').join(',')
                  )}`}
                  download={`${schemaKey}_template.csv`}
                  style={{
                    fontSize: '11px', color: 'var(--primary)', fontWeight: 600, border: '1px solid var(--primary)',
                    borderRadius: '4px', padding: '4px 8px', textDecoration: 'none'
                  }}
                >
                  📥 Download {schemaKey.charAt(0).toUpperCase() + schemaKey.slice(1)} Template
                </a>
              </div>
            </div>
          )}

          {/* STEP 2: Column Mapper */}
          {step === 2 && (
            <div>
              <p style={{ fontSize: '13px', color: '#667085', marginBottom: '14px' }}>
                Map your file headers to system fields. Required fields must be mapped.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {schema.map(field => {
                  const mappedIdx = mapping[field.key];
                  const hasMatch = mappedIdx !== undefined;
                  
                  return (
                    <div key={field.key} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px', borderRadius: '8px', border: '1px solid #E4E7EC',
                      backgroundColor: hasMatch ? 'var(--light-tint)' : '#FFFFFF'
                    }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: '#101828' }}>
                          {field.label}
                        </span>
                        {field.required && <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>➔</span>
                        <select 
                          value={mappedIdx !== undefined ? mappedIdx : ""} 
                          onChange={(e) => handleMappingChange(field.key, e.target.value)}
                          style={{
                            padding: '6px 12px', fontSize: '13px', borderRadius: '6px',
                            border: '1px solid #D0D5DD', backgroundColor: '#FFFFFF'
                          }}
                        >
                          <option value="">[ Skip this column ]</option>
                          {fileHeaders.map((header, hIdx) => (
                            <option key={hIdx} value={hIdx}>{header}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Verification */}
          {step === 3 && (
            <div>
              <div style={{
                backgroundColor: validationResults.errors.length > 0 ? '#FFF1F2' : 'var(--light-tint)',
                borderLeft: validationResults.errors.length > 0 ? '4px solid #EF4444' : '4px solid var(--primary)',
                padding: '12px', borderRadius: '4px', marginBottom: '14px'
              }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#101828' }}>
                  Validation Summary
                </h4>
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', marginTop: '6px' }}>
                  <span>✅ Ready: <strong>{validationResults.validRows.length} rows</strong></span>
                  <span>❌ Errors: <strong>{validationResults.errors.length} rows</strong></span>
                </div>
              </div>

              {validationResults.errors.length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 600, color: '#DC2626', marginBottom: '6px' }}>Issues List:</h4>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #FEE2E2', borderRadius: '8px' }}>
                    <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                      <thead style={{ background: '#FFF1F2', position: 'sticky', top: 0 }}>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid #FEE2E2' }}>
                          <th style={{ padding: '6px' }}>Row</th>
                          <th style={{ padding: '6px' }}>Column</th>
                          <th style={{ padding: '6px' }}>Issue</th>
                          <th style={{ padding: '6px' }}>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validationResults.errors.map((err, idx) => (
                          err.issues.map((iss, iIdx) => (
                            <tr key={`${idx}-${iIdx}`} style={{ borderBottom: '1px solid #FFE4E6' }}>
                              <td style={{ padding: '6px', fontWeight: 'bold' }}>{err.rowNum}</td>
                              <td style={{ padding: '6px' }}>{iss.column}</td>
                              <td style={{ padding: '6px', color: '#DC2626' }}>{iss.issue}</td>
                              <td style={{ padding: '6px', fontStyle: 'italic' }}>"{iss.value}"</td>
                            </tr>
                          ))
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Completion */}
          {step === 4 && (
            <div style={{ textAlign: 'center', padding: '30px 10px' }}>
              {importProgress < 100 ? (
                <div>
                  <div style={{ fontSize: '28px', marginBottom: '10px' }}>⚙️</div>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>Importing records...</h4>
                  <div style={{ width: '100%', height: '8px', backgroundColor: '#EAECF0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${importProgress}%`, backgroundColor: 'var(--primary)', transition: 'width 0.2s' }} />
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '36px', marginBottom: '10px' }}>🎉</div>
                  <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#166534' }}>Import Complete!</h4>
                  <p style={{ fontSize: '13px', color: '#667085', marginTop: '6px' }}>
                    {validationResults.validRows.length} records have been successfully added to your list.
                  </p>
                  <div style={{ marginTop: '20px' }}>
                    <Btn variant="outline" onClick={onClose}>Close Wizard</Btn>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Wizard Footer controls */}
        {step < 4 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #EAECF0', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            {step === 2 && <Btn variant="ghost" onClick={() => setStep(1)}>Back</Btn>}
            {step === 3 && <Btn variant="ghost" onClick={() => setStep(2)}>Back</Btn>}
            
            {step === 1 && <Btn variant="primary" disabled={fileData.length === 0} onClick={() => setStep(2)}>Next</Btn>}
            {step === 2 && <Btn variant="primary" onClick={handleStartValidation}>Verify & Map</Btn>}
            {step === 3 && <Btn variant="primary" onClick={handleTriggerImport}>Import {validationResults.validRows.length} Rows</Btn>}
          </div>
        )}

      </div>
    </div>
  );
}
