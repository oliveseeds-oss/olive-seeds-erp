import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../utils/AuthContext';
import { Card, PageHeader, Btn, TableSkeleton, fmt, fmtDate } from '../components/UI';
import ConfirmDelete from '../components/ConfirmDelete';
import ImportModal from '../components/ImportModal';

const STATUSES = ['pending', 'processing', 'manufacturing', 'engraving', 'qc', 'packing', 'ready', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'];
const SOURCES = ['website', 'amazon', 'flipkart', 'etsy', 'instagram', 'whatsapp', 'manual', 'walkin'];

export default function Orders() {
  const { user, canWrite, canModify, isEmployee } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');

  // Modals
  const [importOpen, setImportOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders');
      setRows(res.data.orders || res.data || []);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, type) => {
    import('../components/UI').then(m => m.showToast(msg, type));
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleUpdateStatus = async (id, status) => {
    try {
      await api.patch(`/orders/${id}/status`, { status });
      showToast('Order status updated successfully', 'success');
      fetchOrders();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update order status', 'error');
    }
  };

  const handleDetailedExport = async () => {
    try {
      const res = await api.get('/orders/export/detailed');
      const data = res.data;
      const { exportToCSV } = await import('../utils/exportUtils');
      const today = new Date().toISOString().split('T')[0];
      exportToCSV(data, `OliveSeeds_Detailed_Orders_${today}.csv`);
    } catch (err) {
      showToast('Export failed', 'error');
    }
  };

  const confirmDeleteOrder = async () => {
    try {
      await api.delete(`/orders/${deleteId}`);
      setRows(prev => prev.filter(item => item.id !== deleteId));
      setDeleteId(null);
      showToast('Order deleted successfully', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Delete failed', 'error');
      setDeleteId(null);
    }
  };

  const filteredRows = rows.filter(item => {
    const matchesSearch = item.order_id?.toLowerCase().includes(search.toLowerCase()) || 
                          item.customer_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus ? item.status === filterStatus : true;
    const matchesSource = filterSource ? item.source === filterSource : true;
    return matchesSearch && matchesStatus && matchesSource;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <PageHeader 
        title="Orders"
        actions={
          <>
            {user?.role === 'admin' && (
              <Btn variant="primary" onClick={() => navigate('/orders/new')}>
                New Order
              </Btn>
            )}
            {(user?.role === 'admin' || user?.role === 'employee') && (
              <Btn variant="outline" onClick={() => setImportOpen(true)}>
                📤 Upload CSV
              </Btn>
            )}
          </>
        }
      />

      {/* Filter Bar */}
      <Card style={{ padding: '12px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '240px' }}>
            <input 
              type="text"
              placeholder="Search by order ID or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                width: '100%',
                maxWidth: '280px',
                backgroundColor: '#FFFFFF',
                color: '#111827'
              }}
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                backgroundColor: '#FFFFFF',
                color: '#111827'
              }}
            >
              <option value="">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                backgroundColor: '#FFFFFF',
                color: '#111827'
              }}
            >
              <option value="">All Sources</option>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Btn variant="outline" onClick={handleDetailedExport}>
              📤 Export CSV
            </Btn>
            {canWrite && (
              <Btn variant="outline" onClick={() => setImportOpen(true)}>Import CSV</Btn>
            )}
          </div>
        </div>
      </Card>

      {/* Data Table */}
      <Card style={{ padding: '0px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '1600px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', color: '#6B7280', position: 'sticky', left: 0, backgroundColor: '#F9FAFB', zIndex: 2 }}>Order ID</th>
              <th style={{ padding: '12px 16px', color: '#6B7280', position: 'sticky', left: '100px', backgroundColor: '#F9FAFB', zIndex: 2 }}>Type</th>
              <th style={{ padding: '12px 16px', color: '#6B7280', position: 'sticky', left: '200px', backgroundColor: '#F9FAFB', zIndex: 2 }}>Source</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Marketplace ID</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Customer Name</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Customer Email</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Customer Phone</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Billing Address</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Shipping Address</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Shipping City</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Shipping State</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Shipping Pincode</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Shipping Country</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Status</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Subtotal</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Discount</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>CGST</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>SGST</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>IGST</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Total Tax</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Shipping Cost</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Total</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Currency</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Payment Status</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Payment Method</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Is GST</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Is International</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Tracking No</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Courier</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Courier Name</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>AWB</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Shipped At</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Delivered At</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Order Time</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Paid Amount</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Balance Due</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Personalization Text</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Remark</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Discount%</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Items Count</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Created By</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Created At</th>
              <th style={{ padding: '12px 16px', color: '#6B7280', textAlign: 'right', position: 'sticky', right: 0, backgroundColor: '#F9FAFB', zIndex: 2 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={43} rows={5} />
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={43} style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>No orders found.</td>
              </tr>
            ) : (
              filteredRows.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827', position: 'sticky', left: 0, backgroundColor: '#FFFFFF', zIndex: 1 }}>
                    <span 
                      style={{ cursor: 'pointer', color: '#3B5BDB' }}
                      onClick={() => navigate(`/orders/${row.id}`)}
                    >
                      {row.order_id}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#374151', position: 'sticky', left: '100px', backgroundColor: '#FFFFFF', zIndex: 1 }}>{row.order_type || 'regular'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151', textTransform: 'capitalize', position: 'sticky', left: '200px', backgroundColor: '#FFFFFF', zIndex: 1 }}>{row.source}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.marketplace_order_id || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.customer_name}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.customer_email || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.customer_phone || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.billing_address || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.shipping_address || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.shipping_city || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.shipping_state || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.shipping_pincode || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.shipping_country || '-'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`badge-status status-${String(row.status || '').toLowerCase()}`}>
                      {row.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{fmt(row.subtotal)}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{fmt(row.discount)}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{fmt(row.cgst)}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{fmt(row.sgst)}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{fmt(row.igst)}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{fmt(row.total_tax)}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{fmt(row.shipping_cost)}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '700', color: '#111827' }}>{fmt(row.total)}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.currency}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.payment_status}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.payment_method || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.is_gst_invoice ? 'Yes' : 'No'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.is_international ? 'Yes' : 'No'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.tracking_number || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.courier || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.courier_name || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.awb_number || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.shipped_at ? fmtDate(row.shipped_at) : '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.delivered_at ? fmtDate(row.delivered_at) : '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.order_time || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{fmt(row.paid_amount)}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{fmt(row.balance_due)}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.personalization_text || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.remark || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.discount_percent}%</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.items_count}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{row.created_by_name || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{fmtDate(row.created_at)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', position: 'sticky', right: 0, backgroundColor: '#FFFFFF', zIndex: 1 }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <Btn variant="outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => navigate(`/orders/${row.id}`)}>
                        View
                      </Btn>
                      {(canModify || isEmployee) && (
                        <select
                          value={row.status}
                          onChange={(e) => handleUpdateStatus(row.id, e.target.value)}
                          style={{
                            padding: '4px 6px',
                            fontSize: '11px',
                            border: '1px solid #D1D5DB',
                            borderRadius: '4px',
                            backgroundColor: '#FFFFFF',
                            color: '#374151'
                          }}
                        >
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                      {user?.role === 'admin' && (
                        <Btn variant="danger" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => setDeleteId(row.id)}>
                          Delete
                        </Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onImportSuccess={fetchOrders} schemaKey="orders" />

      <ConfirmDelete 
        isOpen={deleteId !== null} 
        onClose={() => setDeleteId(null)} 
        onConfirm={confirmDeleteOrder} 
      />
    </div>
  );
}
