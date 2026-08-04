import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { syncOfflineQueue } from '../utils/api';
import toast from 'react-hot-toast';

const NAV = [
  { to:'/', label:'Dashboard', icon:'📊', exact:true },
  { to:'/orders', label:'Orders', icon:'🛒' },
  { to:'/orders/new', label:'New Order', icon:'➕' },
  { to:'/customers', label:'Customers', icon:'👥' },
  { to:'/products', label:'Products', icon:'📦' },
  { to:'/invoices', label:'Invoices', icon:'🧾' },
  { to:'/inventory', label:'Inventory', icon:'🏭' },
  { to:'/suppliers', label:'Suppliers', icon:'🏪' },
  { to:'/payments', label:'Payments', icon:'💳' },
  { to:'/expenses', label:'Expenses', icon:'💰' },
  { to:'/bulk', label:'Bulk Orders', icon:'📋' },
  { to:'/shipping', label:'Shipping', icon:'🚚' },
  { to:'/gst', label:'GST Reports', icon:'📑' },
  { to:'/reports', label:'Reports', icon:'📈' },
  { to:'/changes', label:'Change Requests', icon:'✏️' },
  { to:'/settings', label:'Settings', icon:'⚙️', adminOnly:true },
  { to:'/users', label:'Users', icon:'👤', adminOnly:true },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [sideOpen, setSideOpen] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => { setOnline(true); syncOfflineQueue().then(n => n>0 && toast.success(`Synced ${n} offline records`)); };
    const off = () => { setOnline(false); toast('You are offline. Data saved locally.', {icon:'📴'}); };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const navItems = NAV.filter(n => !n.adminOnly || isAdmin);

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      {/* Sidebar */}
      <aside style={{
        width: sideOpen ? 220 : 56,
        background:'var(--primary)',
        color:'#fff',
        display:'flex',
        flexDirection:'column',
        transition:'width 0.2s',
        flexShrink:0,
        overflow:'hidden',
        position:'fixed',
        top:0, left:0, bottom:0,
        zIndex:100
      }}>
        <div style={{ padding:'16px 12px', borderBottom:'1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:22 }}>🌿</span>
          {sideOpen && <span style={{ fontWeight:700, fontSize:13, lineHeight:1.2 }}>Olive Seeds<br/><span style={{fontWeight:400,fontSize:11,opacity:0.7}}>Design Studio</span></span>}
        </div>
        <nav style={{ flex:1, overflowY:'auto', padding:'8px 0' }}>
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.exact}
              style={({ isActive }) => ({
                display:'flex', alignItems:'center', gap:10,
                padding:'9px 14px', color:'#fff', fontSize:13,
                background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                borderLeft: isActive ? '3px solid #fff' : '3px solid transparent',
                textDecoration:'none', whiteSpace:'nowrap', transition:'background 0.15s'
              })}>
              <span style={{ fontSize:16, flexShrink:0 }}>{item.icon}</span>
              {sideOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding:'12px', borderTop:'1px solid rgba(255,255,255,0.1)' }}>
          {sideOpen && <div style={{ fontSize:11, opacity:0.7, marginBottom:8 }}>
            <div style={{ fontWeight:600 }}>{user?.name}</div>
            <div style={{ textTransform:'capitalize' }}>{user?.role}</div>
          </div>}
          <button onClick={handleLogout} style={{ background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', padding:'6px 10px', borderRadius:6, fontSize:12, width:'100%' }}>
            {sideOpen ? '🚪 Logout' : '🚪'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div style={{ marginLeft: sideOpen ? 220 : 56, flex:1, display:'flex', flexDirection:'column', minWidth:0, transition:'margin-left 0.2s' }}>
        {/* Top bar */}
        <header style={{ background:'#fff', borderBottom:'1px solid var(--border)', padding:'0 20px', height:52, display:'flex', alignItems:'center', gap:12, position:'sticky', top:0, zIndex:50 }}>
          <button onClick={() => setSideOpen(!sideOpen)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'var(--primary)' }}>☰</button>
          <span style={{ fontWeight:600, color:'var(--primary)', fontSize:15 }}>Olive Seeds ERP</span>
          <div style={{ flex:1 }} />
          <span style={{ fontSize:11, padding:'3px 8px', borderRadius:20, background: online?'#d4edda':'#f8d7da', color: online?'#155724':'#721c24' }}>
            {online ? '🟢 Online' : '🔴 Offline'}
          </span>
          <span style={{ fontSize:12, color:'var(--muted)' }}>{new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>
        </header>
        <main style={{ flex:1, padding:20, overflowX:'hidden' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
