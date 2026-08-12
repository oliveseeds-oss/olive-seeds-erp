import React, { useState } from 'react';
import { useTheme } from '../utils/AuthContext';
import { exportToCSV, exportToExcel } from '../utils/exportUtils';
import toast from 'react-hot-toast';

export default function ExportDrawer({ open, onClose, data = [], columns = [], filename = 'export', entityName = 'Records' }) {
  const theme = useTheme();

  const [format, setFormat] = useState('excel');
  const [selectedCols, setSelectedCols] = useState(() => columns.map(c => c.key || c));
  const [customFilename, setCustomFilename] = useState(filename);
  const [dateRange, setDateRange] = useState('this-month');
  const [exporting, setExporting] = useState(false);

  if (!open) return null;

  const handleSelectAll = () => {
    setSelectedCols(columns.map(c => c.key || c));
  };

  const handleDeselectAll = () => {
    setSelectedCols([]);
  };

  const handleToggleCol = (colKey) => {
    setSelectedCols(prev => 
      prev.includes(colKey) ? prev.filter(c => c !== colKey) : [...prev, colKey]
    );
  };

  const handleDownload = async () => {
    if (!data.length) {
      toast.error('No data available to export.');
      return;
    }
    if (!selectedCols.length) {
      toast.error('Select at least one column to include.');
      return;
    }

    setExporting(true);
    
    // Filter columns
    const finalData = data.map(row => {
      const obj = {};
      selectedCols.forEach(col => {
        obj[col] = row[col] !== undefined ? row[col] : '';
      });
      return obj;
    });

    setTimeout(async () => {
      try {
        if (format === 'excel') {
          await exportToExcel(finalData, customFilename, selectedCols);
        } else {
          exportToCSV(finalData, customFilename, selectedCols);
        }
        toast.success(`Exported ${data.length} ${entityName} successfully!`);
        onClose();
      } catch (err) {
        toast.error('Export failed');
      } finally {
        setExporting(false);
      }
    }, 800);
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(12, 17, 29, 0.4)',
        backdropFilter: 'blur(2px)',
        zIndex: 2500,
        display: 'flex',
        justifyContent: 'flex-end'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: '350px',
          height: '100%',
          backgroundColor: '#FFFFFF',
          borderLeft: '1px solid #E4E7EC',
          boxShadow: '-4px 0 24px rgba(16,24,40,0.1)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 280ms ease-out',
          boxSizing: 'border-box'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #E4E7EC', paddingBottom: '10px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#101828' }}>
            📤 Export {entityName}
          </h3>
          <button onClick={onClose} style={{ fontSize: '18px', color: '#98A2B3', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Date range selection */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#667085', marginBottom: '6px', textTransform: 'uppercase' }}>
              Date Range
            </label>
            <select 
              value={dateRange} 
              onChange={(e) => setDateRange(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #D0D5DD', fontSize: '13px' }}
            >
              <option value="this-month">This Month</option>
              <option value="today">Today</option>
              <option value="this-week">This Week</option>
              <option value="all-time">All Time</option>
            </select>
          </div>

          {/* Columns selection check list */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#667085', textTransform: 'uppercase' }}>
                Columns to Include
              </label>
              <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                <span onClick={handleSelectAll} style={{ color: theme.primary, cursor: 'pointer', fontWeight: 600 }}>Select All</span>
                <span style={{ color: '#D0D5DD' }}>|</span>
                <span onClick={handleDeselectAll} style={{ color: theme.primary, cursor: 'pointer', fontWeight: 600 }}>Deselect</span>
              </div>
            </div>

            <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #D0D5DD', borderRadius: '6px', padding: '10px' }}>
              {columns.map(col => {
                const key = col.key || col;
                const label = col.label || col;
                const checked = selectedCols.includes(key);
                return (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '13px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={checked} 
                      onChange={() => handleToggleCol(key)}
                      style={{ accentColor: theme.primary }}
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Export format format selection */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#667085', marginBottom: '6px', textTransform: 'uppercase' }}>
              Format
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <label style={{
                flex: 1, border: format === 'excel' ? `1.5px solid ${theme.primary}` : '1px solid #D0D5DD',
                borderRadius: '6px', padding: '10px', textAlign: 'center', cursor: 'pointer', display: 'block'
              }}>
                <input type="radio" name="fmt" checked={format === 'excel'} onChange={() => setFormat('excel')} style={{ display: 'none' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: format === 'excel' ? theme.primary : '#344054' }}>📊 Excel (.xlsx)</span>
              </label>
              <label style={{
                flex: 1, border: format === 'csv' ? `1.5px solid ${theme.primary}` : '1px solid #D0D5DD',
                borderRadius: '6px', padding: '10px', textAlign: 'center', cursor: 'pointer', display: 'block'
              }}>
                <input type="radio" name="fmt" checked={format === 'csv'} onChange={() => setFormat('csv')} style={{ display: 'none' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: format === 'csv' ? theme.primary : '#344054' }}>📄 CSV (.csv)</span>
              </label>
            </div>
          </div>

          {/* File Name input */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#667085', marginBottom: '6px', textTransform: 'uppercase' }}>
              File Name
            </label>
            <input 
              type="text" 
              value={customFilename}
              onChange={(e) => setCustomFilename(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #D0D5DD',
                fontSize: '13px', boxSizing: 'border-box'
              }}
            />
          </div>

        </div>

        {/* Action controls */}
        <div style={{ marginTop: '20px', borderTop: '1px solid #E4E7EC', paddingTop: '16px' }}>
          <div style={{ fontSize: '12px', color: '#667085', marginBottom: '12px', textAlign: 'center' }}>
            Will export <strong>{data.length}</strong> records.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={onClose}
              style={{
                flex: 1, padding: '10px', fontSize: '13px', fontWeight: 600,
                color: '#344054', backgroundColor: '#FFFFFF', border: '1px solid #D0D5DD',
                borderRadius: '6px', cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button 
              onClick={handleDownload}
              disabled={exporting}
              style={{
                flex: 1, padding: '10px', fontSize: '13px', fontWeight: 600,
                color: '#FFFFFF', backgroundColor: theme.primary, border: 'none',
                borderRadius: '6px', cursor: exporting ? 'not-allowed' : 'pointer'
              }}
            >
              {exporting ? 'Preparing...' : 'Download Now'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
