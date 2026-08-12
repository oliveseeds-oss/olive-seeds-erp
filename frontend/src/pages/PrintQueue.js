import React, { useEffect, useState } from 'react';
import { useTheme } from '../utils/AuthContext';
import { Card, PageHeader, Btn, Table, Select, Spinner } from '../components/UI';
import { getPrintQueue, removeFromPrintQueue, clearPrintQueue, PRINT_PROFILES, injectThermalStyles } from '../utils/printUtils';
import toast from 'react-hot-toast';

export default function PrintQueue() {
  const theme = useTheme();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState('A4');
  const [copies, setCopies] = useState(1);

  useEffect(() => {
    setQueue(getPrintQueue());
    setLoading(false);
  }, []);

  const handleRemove = (id) => {
    removeFromPrintQueue(id);
    setQueue(getPrintQueue());
    toast.success('Removed from print queue');
  };

  const handleClearAll = () => {
    clearPrintQueue();
    setQueue([]);
    toast.success('Print queue cleared');
  };

  const handleBatchPrint = () => {
    if (queue.length === 0) {
      toast.error('Print queue is empty.');
      return;
    }
    
    injectThermalStyles(selectedProfile);
    
    // Trigger batch print
    window.print();
    toast.success(`Sent ${queue.length} invoices to printer using profile ${PRINT_PROFILES[selectedProfile].name}`);
    
    // Clear queue after printing
    handleClearAll();
  };

  const cols = [
    { label: 'Invoice No', key: 'invoiceNo', isId: true },
    { label: 'Customer', key: 'customerName' },
    { label: 'Date', key: 'date' },
    { label: 'Amount', render: (r) => <strong>₹ {r.amount}</strong> },
    {
      label: 'Actions',
      render: (r) => (
        <Btn size="sm" variant="danger" onClick={() => handleRemove(r.id)}>✕ Remove</Btn>
      )
    }
  ];

  return (
    <div style={{ animation: 'fadeUp 200ms ease-out forwards' }}>
      
      <PageHeader 
        title="Print Queue Manager" 
        subtitle="Manage batch invoice prints and layout profiles" 
        icon="🖨️"
        actions={
          queue.length > 0 && (
            <Btn variant="danger" onClick={handleClearAll}>✕ Clear Queue</Btn>
          )
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: '20px', marginTop: '14px' }}>
        
        {/* Left Side: Queue Invoices List */}
        <div>
          {loading ? <Spinner /> : (
            <Table cols={cols} rows={queue} emptyMsg="No invoices waiting in the print queue." />
          )}
        </div>

        {/* Right Side: Print Settings Profile Control */}
        <div>
          <Card>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#101828', marginBottom: '14px' }}>
              🔧 Print Batch Settings
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#667085', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Target Layout Profile
                </label>
                <Select value={selectedProfile} onChange={(e) => setSelectedProfile(e.target.value)} style={{ marginBottom: 0 }}>
                  {Object.values(PRINT_PROFILES).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#667085', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Copies per invoice
                </label>
                <input 
                  type="number" 
                  value={copies} 
                  onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #D0D5DD',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div style={{ marginTop: '10px' }}>
                <Btn 
                  variant="primary" 
                  onClick={handleBatchPrint}
                  disabled={queue.length === 0}
                  style={{ width: '100%', padding: '12px' }}
                >
                  🖨️ Print Batch Now ({queue.length} items)
                </Btn>
              </div>
            </div>
          </Card>
        </div>

      </div>

    </div>
  );
}
