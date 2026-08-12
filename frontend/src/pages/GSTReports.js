import React, { useState } from 'react';
import api from '../utils/api';
import { Card, PageHeader, Btn, TableSkeleton, fmt, Select, showToast } from '../components/UI';
import ExportButton from '../components/ExportButton';

export default function GSTReports() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [tab, setTab] = useState('gstr1');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/gst/${tab}?month=${month}&year=${year}`);
      setData(res.data);
      showToast('GST Report generated successfully', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to generate GST report', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <PageHeader 
        title="GST Reports"
        actions={
          <Btn variant="primary" onClick={fetchReport} disabled={loading}>
            {loading ? 'Generating...' : 'Generate Report'}
          </Btn>
        }
      />

      {/* Filter Bar */}
      <Card style={{ padding: '12px 20px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              backgroundColor: '#FFFFFF',
              color: '#111827'
            }}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2000, i).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>

          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              backgroundColor: '#FFFFFF',
              color: '#111827'
            }}
          >
            {[2023, 2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <select
            value={tab}
            onChange={(e) => { setTab(e.target.value); setData(null); }}
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              backgroundColor: '#FFFFFF',
              color: '#111827'
            }}
          >
            <option value="gstr1">GSTR-1</option>
            <option value="gstr3b">GSTR-3B</option>
            <option value="hsn">HSN Summary</option>
          </select>

          <div style={{ marginLeft: 'auto' }}>
            {data && <ExportButton data={tab === 'hsn' ? data : (data.b2b || [])} pageName={`GST_${tab}`} />}
          </div>
        </div>
      </Card>

      {/* Report Summary Data Table */}
      {loading ? (
        <Card><TableSkeleton cols={5} rows={5} /></Card>
      ) : !data ? (
        <Card style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>
          Select parameters and click "Generate Report" to view GST data.
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {tab === 'gstr1' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                <Card>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>Taxable Value</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginTop: '4px' }}>{fmt(data.totals?.subtotal || 0)}</div>
                </Card>
                <Card>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>CGST Collected</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginTop: '4px' }}>{fmt(data.totals?.cgst || 0)}</div>
                </Card>
                <Card>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>SGST Collected</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginTop: '4px' }}>{fmt(data.totals?.sgst || 0)}</div>
                </Card>
                <Card>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>IGST Collected</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginTop: '4px' }}>{fmt(data.totals?.igst || 0)}</div>
                </Card>
              </div>

              <Card style={{ padding: '0px', overflowX: 'auto' }}>
                <div style={{ padding: '16px', fontWeight: '700', borderBottom: '1px solid #E5E7EB' }}>B2B Invoices</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
                      <th style={{ padding: '12px 16px', color: '#6B7280' }}>GSTIN</th>
                      <th style={{ padding: '12px 16px', color: '#6B7280' }}>Customer</th>
                      <th style={{ padding: '12px 16px', color: '#6B7280' }}>Invoice No</th>
                      <th style={{ padding: '12px 16px', color: '#6B7280' }}>Total</th>
                      <th style={{ padding: '12px 16px', color: '#6B7280' }}>CGST</th>
                      <th style={{ padding: '12px 16px', color: '#6B7280' }}>SGST</th>
                      <th style={{ padding: '12px 16px', color: '#6B7280' }}>IGST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.b2b || []).length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>No B2B invoices found.</td>
                      </tr>
                    ) : (
                      (data.b2b || []).map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #E5E7EB' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.gstin}</td>
                          <td style={{ padding: '12px 16px' }}>{row.customer_name}</td>
                          <td style={{ padding: '12px 16px' }}>{row.invoice_number}</td>
                          <td style={{ padding: '12px 16px', fontWeight: '700' }}>{fmt(row.total)}</td>
                          <td style={{ padding: '12px 16px' }}>{fmt(row.cgst)}</td>
                          <td style={{ padding: '12px 16px' }}>{fmt(row.sgst)}</td>
                          <td style={{ padding: '12px 16px' }}>{fmt(row.igst)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </Card>
            </>
          )}

          {tab === 'gstr3b' && (
            <Card style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <Card>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>Total Outward Tax</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#DC2626', marginTop: '4px' }}>{fmt(data.outward?.tax || 0)}</div>
                </Card>
                <Card>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>Input Tax Credit</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#16A34A', marginTop: '4px' }}>{fmt(data.input_credit || 0)}</div>
                </Card>
                <Card>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>Net Tax Payable</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#1A1A2E', marginTop: '4px' }}>{fmt(data.net_tax_payable || 0)}</div>
                </Card>
              </div>
            </Card>
          )}

          {tab === 'hsn' && (
            <Card style={{ padding: '0px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', color: '#6B7280' }}>HSN Code</th>
                    <th style={{ padding: '12px 16px', color: '#6B7280' }}>Qty</th>
                    <th style={{ padding: '12px 16px', color: '#6B7280' }}>Taxable</th>
                    <th style={{ padding: '12px 16px', color: '#6B7280' }}>CGST</th>
                    <th style={{ padding: '12px 16px', color: '#6B7280' }}>SGST</th>
                    <th style={{ padding: '12px 16px', color: '#6B7280' }}>IGST</th>
                  </tr>
                </thead>
                <tbody>
                  {(data || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>No HSN summary records found.</td>
                    </tr>
                  ) : (
                    (data || []).map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #E5E7EB' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.hsn_code}</td>
                        <td style={{ padding: '12px 16px' }}>{row.qty}</td>
                        <td style={{ padding: '12px 16px', fontWeight: '700' }}>{fmt(row.taxable)}</td>
                        <td style={{ padding: '12px 16px' }}>{fmt(row.cgst)}</td>
                        <td style={{ padding: '12px 16px' }}>{fmt(row.sgst)}</td>
                        <td style={{ padding: '12px 16px' }}>{fmt(row.igst)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

    </div>
  );
}
