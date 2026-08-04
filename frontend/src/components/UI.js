import React from 'react';

export const Card = ({ children, style={} }) => (
  <div style={{ background:'#fff', borderRadius:10, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,0.07)', ...style }}>{children}</div>
);

export const PageHeader = ({ title, subtitle, actions }) => (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
    <div>
      <h1 style={{ fontSize:22, fontWeight:700, color:'var(--primary)' }}>{title}</h1>
      {subtitle && <p style={{ fontSize:13, color:'var(--muted)', marginTop:2 }}>{subtitle}</p>}
    </div>
    {actions && <div style={{ display:'flex', gap:8 }}>{actions}</div>}
  </div>
);

export const Btn = ({ children, onClick, variant='primary', size='md', type='button', disabled=false, style={} }) => {
  const colors = {
    primary: { bg:'var(--primary)', color:'#fff' },
    success: { bg:'var(--accent)', color:'#fff' },
    danger: { bg:'var(--danger)', color:'#fff' },
    warning: { bg:'var(--warning)', color:'#fff' },
    outline: { bg:'#fff', color:'var(--primary)', border:'1px solid var(--primary)' },
    ghost: { bg:'transparent', color:'var(--muted)', border:'1px solid var(--border)' },
  };
  const sizes = { sm:{ padding:'4px 10px', fontSize:12 }, md:{ padding:'8px 16px', fontSize:13 }, lg:{ padding:'10px 22px', fontSize:15 } };
  const c = colors[variant]||colors.primary;
  const s = sizes[size]||sizes.md;
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      ...c, ...s, border: c.border||'none', borderRadius:7, fontWeight:600,
      cursor: disabled?'not-allowed':'pointer', opacity: disabled?0.6:1,
      display:'inline-flex', alignItems:'center', gap:6, ...style
    }}>{children}</button>
  );
};

export const Input = ({ label, error, style={}, ...props }) => (
  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
    {label && <label style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{label}</label>}
    <input {...props} style={{
      border:`1px solid ${error?'var(--danger)':'var(--border)'}`, borderRadius:6, padding:'8px 10px', fontSize:13,
      outline:'none', width:'100%', ...style
    }} />
    {error && <span style={{ fontSize:11, color:'var(--danger)' }}>{error}</span>}
  </div>
);

export const Select = ({ label, error, children, style={}, ...props }) => (
  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
    {label && <label style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{label}</label>}
    <select {...props} style={{
      border:`1px solid ${error?'var(--danger)':'var(--border)'}`, borderRadius:6, padding:'8px 10px', fontSize:13,
      outline:'none', width:'100%', background:'#fff', ...style
    }}>{children}</select>
    {error && <span style={{ fontSize:11, color:'var(--danger)' }}>{error}</span>}
  </div>
);

export const Textarea = ({ label, error, style={}, ...props }) => (
  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
    {label && <label style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{label}</label>}
    <textarea {...props} style={{
      border:`1px solid ${error?'var(--danger)':'var(--border)'}`, borderRadius:6, padding:'8px 10px', fontSize:13,
      outline:'none', width:'100%', resize:'vertical', minHeight:80, ...style
    }} />
    {error && <span style={{ fontSize:11, color:'var(--danger)' }}>{error}</span>}
  </div>
);

export const Badge = ({ children, color='blue' }) => {
  const colors = {
    blue:{bg:'#dbeafe',text:'#1e40af'}, green:{bg:'#dcfce7',text:'#166534'},
    red:{bg:'#fee2e2',text:'#991b1b'}, yellow:{bg:'#fef9c3',text:'#854d0e'},
    gray:{bg:'#f3f4f6',text:'#374151'}, purple:{bg:'#ede9fe',text:'#5b21b6'},
    orange:{bg:'#ffedd5',text:'#9a3412'},
  };
  const c = colors[color]||colors.gray;
  return <span style={{ background:c.bg, color:c.text, padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>{children}</span>;
};

export const StatusBadge = ({ status }) => {
  const map = {
    pending:{label:'Pending',color:'yellow'}, processing:{label:'Processing',color:'blue'},
    manufacturing:{label:'Manufacturing',color:'purple'}, engraving:{label:'Engraving',color:'purple'},
    qc:{label:'QC Check',color:'orange'}, packing:{label:'Packing',color:'orange'},
    ready:{label:'Ready',color:'blue'}, shipped:{label:'Shipped',color:'blue'},
    delivered:{label:'Delivered',color:'green'}, cancelled:{label:'Cancelled',color:'red'},
    returned:{label:'Returned',color:'red'}, refunded:{label:'Refunded',color:'gray'},
    paid:{label:'Paid',color:'green'}, partial:{label:'Partial',color:'yellow'},
    unpaid:{label:'Unpaid',color:'red'}, active:{label:'Active',color:'green'},
    inactive:{label:'Inactive',color:'gray'},
  };
  const m = map[status]||{label:status,color:'gray'};
  return <Badge color={m.color}>{m.label}</Badge>;
};

export const Table = ({ cols, rows, emptyMsg='No records found' }) => (
  <div style={{ overflowX:'auto' }}>
    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
      <thead>
        <tr style={{ background:'#f8fafc' }}>
          {cols.map((c,i) => <th key={i} style={{ padding:'10px 12px', textAlign:'left', fontWeight:600, color:'var(--muted)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{c.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.length===0
          ? <tr><td colSpan={cols.length} style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>{emptyMsg}</td></tr>
          : rows.map((row,i) => (
            <tr key={i} style={{ borderBottom:'1px solid var(--border)', transition:'background 0.1s' }}
              onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
              onMouseLeave={e=>e.currentTarget.style.background=''}>
              {cols.map((c,j) => <td key={j} style={{ padding:'9px 12px', ...c.style }}>{c.render ? c.render(row) : row[c.key]}</td>)}
            </tr>
          ))
        }
      </tbody>
    </table>
  </div>
);

export const Modal = ({ open, onClose, title, children, width=560 }) => {
  if (!open) return null;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:width, maxHeight:'90vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h2 style={{ fontSize:16, fontWeight:700 }}>{title}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'var(--muted)' }}>✕</button>
        </div>
        <div style={{ padding:20 }}>{children}</div>
      </div>
    </div>
  );
};

export const Grid = ({ cols=2, gap=16, children }) => (
  <div style={{ display:'grid', gridTemplateColumns:`repeat(${cols},1fr)`, gap }}>{children}</div>
);

export const Stat = ({ label, value, sub, color='var(--primary)', icon }) => (
  <Card>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
      <div>
        <p style={{ fontSize:12, color:'var(--muted)', marginBottom:6 }}>{label}</p>
        <p style={{ fontSize:24, fontWeight:700, color }}>{value}</p>
        {sub && <p style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>{sub}</p>}
      </div>
      {icon && <span style={{ fontSize:28 }}>{icon}</span>}
    </div>
  </Card>
);

export const Spinner = () => (
  <div style={{ display:'flex', justifyContent:'center', padding:40 }}>
    <div style={{ width:32, height:32, border:'3px solid var(--border)', borderTop:'3px solid var(--primary)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

export const SearchBox = ({ value, onChange, placeholder='Search...' }) => (
  <div style={{ position:'relative' }}>
    <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--muted)' }}>🔍</span>
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{ border:'1px solid var(--border)', borderRadius:7, padding:'8px 10px 8px 32px', fontSize:13, outline:'none', width:260 }} />
  </div>
);

export const fmt = (n) => `₹${parseFloat(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '-';
