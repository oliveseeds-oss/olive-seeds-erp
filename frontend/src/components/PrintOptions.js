import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { buildBillHTML, openPrintWindow, fetchLogoBase64, fetchSignatureBase64 } from '../utils/printUtils';
import api from '../utils/api';

export default function PrintOptions({ open, onClose, billData, settings = {} }) {
  const [paperSize, setPaperSize] = useState('A4');
  const [copies, setCopies] = useState(1);
  const [printing, setPrinting] = useState(false);

  if (!open) return null;

  const handlePrintNow = async () => {
    setPrinting(true);
    try {
      const logoBase64 = await fetchLogoBase64(api);
      const signatureBase64 = await fetchSignatureBase64(api, billData?.created_by || billData?.userId);
      const paperSz = paperSize === 'THERMAL_80' ? '80mm' : paperSize === 'THERMAL_58' ? '58mm' : paperSize;
      
      const billHTML = buildBillHTML(billData, paperSz, settings, signatureBase64, logoBase64);

      // Extract style contents from billHTML to prevent nested document issues
      const styleMatch = billHTML.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      const extractedStyles = styleMatch ? styleMatch[1] : '';

      // Extract body contents from billHTML
      const bodyMatch = billHTML.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const extractedBody = bodyMatch ? bodyMatch[1] : billHTML;

      // Margins and @page rules based on paper size
      let pageCSS = '';
      if (paperSz === 'A4') pageCSS = '@page { size: A4; margin: 15mm; }';
      else if (paperSz === 'A5') pageCSS = '@page { size: A5; margin: 10mm; }';
      else if (paperSz === '80mm') pageCSS = '@page { size: 80mm auto; margin: 3mm; }';
      else if (paperSz === '58mm') pageCSS = '@page { size: 58mm auto; margin: 2mm; }';

      const printCSS = `
        ${extractedStyles}
        ${pageCSS}
        body { -webkit-print-color-adjust: exact; font-family: Arial, sans-serif; color: #000; }
        .no-print { display: none !important; }
        ${paperSz === '80mm' || paperSz === '58mm' ? `
          body { width: ${paperSz === '80mm' ? '74mm' : '54mm'}; margin: 0 auto; padding: 0; font-size: 8pt; }
        ` : `
          body { font-size: 10pt; line-height: 1.4; }
        `}
      `;

      // Generate HTML with multiple copies repeated
      let repeatedContent = '';
      for (let i = 0; i < copies; i++) {
        repeatedContent += `<div class="print-page" style="${i > 0 ? 'page-break-before: always;' : ''}">${extractedBody}</div>`;
      }

      const finalHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Bill - ${billData.bill_number}</title>
          <style>${printCSS}</style>
        </head>
        <body>
          ${repeatedContent}
        </body>
        </html>
      `;

      openPrintWindow(finalHTML);
      toast.success('Print job sent');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Print failed: ' + err.message);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.4)'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: '280px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          padding: '20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginBottom: '16px', textAlign: 'center' }}>
          🖨️ Print Options
        </div>

        <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
          Select Paper Size:
        </div>

        {/* Paper Size Selector Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          {[
            { id: 'A4', label: 'A4 Standard' },
            { id: 'A5', label: 'A5 Compact' },
            { id: 'THERMAL_80', label: '80mm Thermal' },
            { id: 'THERMAL_58', label: '58mm Thermal' }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setPaperSize(opt.id)}
              style={{
                padding: '8px 4px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '6px',
                border: '1px solid',
                borderColor: paperSize === opt.id ? '#1A1A2E' : '#D1D5DB',
                backgroundColor: paperSize === opt.id ? '#1A1A2E' : '#FFFFFF',
                color: paperSize === opt.id ? '#FFFFFF' : '#374151',
                cursor: 'pointer',
                transition: 'all 100ms ease'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Copies Counter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Number of Copies:</label>
          <input
            type="number"
            min="1"
            max="10"
            value={copies}
            onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
            style={{
              width: '60px',
              padding: '6px',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              textAlign: 'center',
              fontSize: '13px'
            }}
          />
        </div>

        {/* Cancel / Print Now */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={onClose}
            disabled={printing}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: '600',
              color: '#374151',
              backgroundColor: '#FFFFFF',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button 
            onClick={handlePrintNow}
            disabled={printing}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: '600',
              color: '#FFFFFF',
              backgroundColor: '#10B981',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            {printing ? 'Preparing...' : 'Print Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
