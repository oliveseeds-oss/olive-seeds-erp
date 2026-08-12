import React, { useState } from 'react';
import api from '../utils/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, PageHeader, Btn, TableSkeleton, fmt, showToast } from '../components/UI';
import ExportButton from '../components/ExportButton';

export default function Reports() {
  const [tab, setTab] = useState('sales');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [groupBy, setGroupBy] = useState('day');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (tab === 'sales') params.set('group_by', groupBy);
      const res = await api.get(`/reports/${tab}?${params}`);
      setData(res.data);
      showToast('Report generated successfully', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to generate report', 'error');
    } finally {
      setLoading(false);
    }
  };

  const TABS = [
    { key: 'sales', label: 'Sales' },
    { key: 'products', label: 'Products' },
    { key: 'customers', label: 'Customers' },
    { key: 'profit', label: 'Profit' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <PageHeader 
        title="Reports"
        actions={
          <Btn variant="primary" onClick={fetchReport} disabled={loading}>
            {loading ? 'Generating...' : 'Generate Report'}
          </Btn>
        }
      />

      {/* Tab Selection */}
      <div style={{ display: 'flex', gap: '10px' }}>
        {TABS.map(t => (
          <Btn 
            key={t.key} 
            variant={tab === t.key ? 'primary' : 'outline'} 
            onClick={() => { setTab(t.key); setData(null); }}
          >
            {t.label}
          </Btn>
        ))}
      </div>

      {/* Filter Bar */}
      <Card style={{ padding: '12px 20px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#374151' }}>From:</span>
            <input 
              type="date" 
              value={from} 
              onChange={(e) => setFrom(e.target.value)}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                backgroundColor: '#FFFFFF',
                color: '#111827'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#374151' }}>To:</span>
            <input 
              type="date" 
              value={to} 
              onChange={(e) => setTo(e.target.value)}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                backgroundColor: '#FFFFFF',
                color: '#111827'
              }}
            />
          </div>

          {tab === 'sales' && (
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                backgroundColor: '#FFFFFF',
                color: '#111827'
              }}
            >
              <option value="day">Day</option>
              <option value="month">Month</option>
              <option value="year">Year</option>
            </select>
          )}

          <div style={{ marginLeft: 'auto' }}>
            {data && <ExportButton data={Array.isArray(data) ? data : [data]} pageName={`Report_${tab}`} />}
          </div>
        </div>
      </Card>

      {/* Main Report View */}
      {loading ? (
        <Card><TableSkeleton cols={4} rows={5} /></Card>
      ) : !data ? (
        <Card style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>
          Select dates and click "Generate Report" to view analytics.
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {tab === 'sales' && Array.isArray(data) && (
            <>
              <Card>
                <div style={{ fontWeight: '700', marginBottom: '14px' }}>Sales Trend</div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip formatter={(v) => fmt(v)} />
                    <Bar dataKey="revenue" fill="#1A1A2E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card style={{ padding: '0px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
                      <th style={{ padding: '12px 16px', color: '#6B7280' }}>Period</th>
                      <th style={{ padding: '12px 16px', color: '#6B7280' }}>Orders Count</th>
                      <th style={{ padding: '12px 16px', color: '#6B7280' }}>Revenue</th>
                      <th style={{ padding: '12px 16px', color: '#6B7280' }}>Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #E5E7EB' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.period}</td>
                        <td style={{ padding: '12px 16px' }}>{row.orders}</td>
                        <td style={{ padding: '12px 16px', fontWeight: '700' }}>{fmt(row.revenue)}</td>
                        <td style={{ padding: '12px 16px' }}>{fmt(row.tax)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}

          {tab === 'products' && Array.isArray(data) && (
            <Card style={{ padding: '0px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', color: '#6B7280' }}>Product SKU</th>
                    <th style={{ padding: '12px 16px', color: '#6B7280' }}>Product Name</th>
                    <th style={{ padding: '12px 16px', color: '#6B7280' }}>Qty Sold</th>
                    <th style={{ padding: '12px 16px', color: '#6B7280' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.sku}</td>
                      <td style={{ padding: '12px 16px' }}>{row.product_name}</td>
                      <td style={{ padding: '12px 16px' }}>{row.qty_sold}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '700' }}>{fmt(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {tab === 'customers' && Array.isArray(data) && (
            <Card style={{ padding: '0px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', color: '#6B7280' }}>Customer Name</th>
                    <th style={{ padding: '12px 16px', color: '#6B7280' }}>Orders Placed</th>
                    <th style={{ padding: '12px 16px', color: '#6B7280' }}>Total Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.name}</td>
                      <td style={{ padding: '12px 16px' }}>{row.orders}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '700' }}>{fmt(row.spent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {tab === 'profit' && (
            <Card style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <Card>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>Total Revenue</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#16A34A', marginTop: '4px' }}>{fmt(data.revenue || 0)}</div>
                </Card>
                <Card>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>Total Expenses</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#DC2626', marginTop: '4px' }}>{fmt(data.expenses || 0)}</div>
                </Card>
                <Card>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>Net profit</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#1A1A2E', marginTop: '4px' }}>{fmt(data.net_profit || 0)}</div>
                </Card>
              </div>
            </Card>
          )}
        </div>
      )}

    </div>
  );
}
