import React, { useState } from 'react';
import api from '../utils/api';
import { Card, PageHeader, Btn, Table, Spinner, fmt } from '../components/UI';

export default function GSTReports() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth()+1);
  const [year, setYear] = useState(now.getFullYear());
  const [tab, setTab] = useState('gstr1');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get(`/gst/${tab}?month=${month}&year=${year}`);
      setData(d);
    } catch(e) {}
    setLoading(false);
  };

  const exportExcel = () => {
    if (!data) return;
    const rows = tab==='gstr1' ? (data.b2b||[]) : [];
    const csv = [Object.keys(rows[0]||{}).join(','), ...rows.map(r=>Object.values(r).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `${tab}_${year}_${month}.csv`;
    a.click();
  };

  const b2bCols = [
    { label:'GSTIN', key:'gstin' }, { label:'Customer', key:'customer_name' },
    { label:'Invoice No', key:'invoice_number' }, { label:'Total', render:r=>fmt(r.total) },
    { label:'CGST', render:r=>fmt(r.cgst) }, { label:'SGST', render:r=>fmt(r.sgst) },
    { label:'IGST', render:r=>fmt(r.igst) }, { label:'Tax', render:r=>fmt(r.total_tax) }
  ];

  return (
    <div>
      <PageHeader title="📑 GST Reports" subtitle="GSTR-1 and GSTR-3B summaries"
        actions={<Btn variant="success" onClick={exportExcel} disabled={!data}>⬇️ Export CSV</Btn>} />

      <Card style={{marginBottom:16}}>
        <div style={{display:'flex',gap:12,alignItems:'flex-end',flexWrap:'wrap'}}>
          <div>
            <label style={{fontSize:12,fontWeight:600,display:'block',marginBottom:3}}>Month</label>
            <select value={month} onChange={e=>setMonth(e.target.value)} style={{border:'1px solid var(--border)',borderRadius:6,padding:'7px 10px',fontSize:13}}>
              {Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{new Date(2000,i).toLocaleString('default',{month:'long'})}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:600,display:'block',marginBottom:3}}>Year</label>
            <select value={year} onChange={e=>setYear(e.target.value)} style={{border:'1px solid var(--border)',borderRadius:6,padding:'7px 10px',fontSize:13}}>
              {[2023,2024,2025,2026].map(y=><option key={y}>{y}</option>)}
            </select>
          </div>
          <div style={{display:'flex',gap:8}}>
            {[['gstr1','GSTR-1'],['gstr3b','GSTR-3B'],['hsn','HSN Summary']].map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)} style={{padding:'7px 14px',borderRadius:7,border:'none',background:tab===k?'var(--primary)':'#e2e8f0',color:tab===k?'#fff':'#555',fontWeight:600,fontSize:13,cursor:'pointer'}}>{l}</button>
            ))}
          </div>
          <Btn onClick={fetchReport}>📊 Generate</Btn>
        </div>
      </Card>

      {loading && <Spinner />}

      {data && !loading && (
        <>
          {tab==='gstr1' && (
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
                {[['Taxable', fmt(data.totals?.subtotal)],['CGST', fmt(data.totals?.cgst)],['SGST', fmt(data.totals?.sgst)],['IGST', fmt(data.totals?.igst)]].map(([l,v])=>(
                  <Card key={l}><p style={{fontSize:12,color:'var(--muted)'}}>{l}</p><p style={{fontSize:20,fontWeight:700,color:'var(--primary)'}}>{v}</p></Card>
                ))}
              </div>
              <Card><h3 style={{fontSize:14,fontWeight:700,marginBottom:12}}>B2B Invoices (GST Registered)</h3><Table cols={b2bCols} rows={data.b2b||[]} emptyMsg="No B2B invoices this period" /></Card>
              <Card>
                <h3 style={{fontSize:14,fontWeight:700,marginBottom:12}}>B2C Summary (Unregistered)</h3>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
                  {[['Taxable',fmt(data.b2c?.taxable)],['CGST',fmt(data.b2c?.cgst)],['SGST',fmt(data.b2c?.sgst)],['IGST',fmt(data.b2c?.igst)]].map(([l,v])=>(
                    <div key={l} style={{padding:12,background:'#f8fafc',borderRadius:8}}><p style={{fontSize:12,color:'var(--muted)'}}>{l}</p><p style={{fontSize:16,fontWeight:700}}>{v}</p></div>
                  ))}
                </div>
              </Card>
            </div>
          )}
          {tab==='gstr3b' && (
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
                {[['Total GST Collected',fmt(data.outward?.tax),'var(--danger)'],['Input Tax Credit',fmt(data.input_credit),'var(--accent)'],['Net Tax Payable',fmt(data.net_tax_payable),'var(--primary)']].map(([l,v,c])=>(
                  <Card key={l}><p style={{fontSize:12,color:'var(--muted)'}}>{l}</p><p style={{fontSize:22,fontWeight:700,color:c}}>{v}</p></Card>
                ))}
              </div>
              <Card>
                <h3 style={{fontSize:14,fontWeight:700,marginBottom:12}}>Outward Supplies Summary</h3>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
                  {[['Taxable',fmt(data.outward?.taxable)],['CGST',fmt(data.outward?.cgst)],['SGST',fmt(data.outward?.sgst)],['IGST',fmt(data.outward?.igst)]].map(([l,v])=>(
                    <div key={l} style={{padding:12,background:'#f8fafc',borderRadius:8}}><p style={{fontSize:12,color:'var(--muted)'}}>{l}</p><p style={{fontSize:16,fontWeight:700}}>{v}</p></div>
                  ))}
                </div>
              </Card>
            </div>
          )}
          {tab==='hsn' && (
            <Card>
              <h3 style={{fontSize:14,fontWeight:700,marginBottom:12}}>HSN-wise Summary</h3>
              <Table cols={[
                {label:'HSN Code',key:'hsn_code'},{label:'Qty',key:'qty'},
                {label:'Taxable',render:r=>fmt(r.taxable)},{label:'CGST',render:r=>fmt(r.cgst)},
                {label:'SGST',render:r=>fmt(r.sgst)},{label:'IGST',render:r=>fmt(r.igst)}
              ]} rows={data||[]} emptyMsg="No HSN data this period" />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
