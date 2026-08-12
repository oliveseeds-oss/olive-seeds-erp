import React, { useState, useRef, useEffect } from 'react';
import { exportToCSV } from '../utils/exportUtils';
import { Btn } from './UI';

export default function ExportButton({ data, pageName, dateField = 'date' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [rangeType, setRangeType] = useState('All Time');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = () => {
    let filtered = [...data];
    const now = new Date();

    const getStartOfDay = (d) => {
      const copy = new Date(d);
      copy.setHours(0, 0, 0, 0);
      return copy;
    };

    if (rangeType === 'Today') {
      const today = getStartOfDay(now);
      filtered = data.filter(item => getStartOfDay(item[dateField] || item.createdAt || now) >= today);
    } else if (rangeType === 'This Week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = data.filter(item => new Date(item[dateField] || item.createdAt || now) >= oneWeekAgo);
    } else if (rangeType === 'This Month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      filtered = data.filter(item => new Date(item[dateField] || item.createdAt || now) >= startOfMonth);
    } else if (rangeType === 'This Year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      filtered = data.filter(item => new Date(item[dateField] || item.createdAt || now) >= startOfYear);
    } else if (rangeType === 'Custom') {
      if (fromDate) {
        filtered = filtered.filter(item => new Date(item[dateField] || item.createdAt || now) >= getStartOfDay(fromDate));
      }
      if (toDate) {
        const endOfToDate = new Date(toDate);
        endOfToDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(item => new Date(item[dateField] || item.createdAt || now) <= endOfToDate);
      }
    }

    exportToCSV(filtered, pageName);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <Btn variant="outline" onClick={() => setIsOpen(!isOpen)}>
        Export CSV
      </Btn>

      {isOpen && (
        <div 
          style={{
            position: 'absolute',
            right: 0,
            top: '40px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            padding: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 500,
            width: '220px'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
            Select Date Range
          </div>
          <select 
            value={rangeType} 
            onChange={(e) => setRangeType(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              borderRadius: '6px',
              border: '1px solid #D1D5DB',
              fontSize: '12px',
              marginBottom: '10px',
              backgroundColor: '#FFFFFF',
              color: '#111827'
            }}
          >
            <option>Today</option>
            <option>This Week</option>
            <option>This Month</option>
            <option>This Year</option>
            <option>All Time</option>
            <option>Custom</option>
          </select>

          {rangeType === 'Custom' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '10px', color: '#6B7280', display: 'block' }}>From</label>
                <input 
                  type="date" 
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  style={{ width: '100%', padding: '4px 6px', fontSize: '11px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: '#6B7280', display: 'block' }}>To</label>
                <input 
                  type="date" 
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  style={{ width: '100%', padding: '4px 6px', fontSize: '11px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                />
              </div>
            </div>
          )}

          <Btn 
            variant="primary" 
            onClick={handleExport}
            style={{ width: '100%', padding: '6px 12px', fontSize: '11px' }}
          >
            Download CSV
          </Btn>
        </div>
      )}
    </div>
  );
}
