import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { syncOfflineQueue } from '../utils/api';
import { showToast } from './UI';

const NAV = [
  { to: '/', label: 'Dashboard', exact: true },
  
  { section: '─── BILLING ───' },
  { to: '/quickbill', label: 'Quick Bill', adminOnly: true },
  { to: '/orders/new', label: 'New Order', adminOnly: true },
  { to: '/orders', label: 'Orders' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/digital-invoices', label: 'Digital Invoices' },
  { to: '/quotations', label: 'Quotations' },
  
  { section: '─── DATA ───' },
  { to: '/customers', label: 'Customers' },
  { to: '/products', label: 'Products' },
  { to: '/suppliers', label: 'Suppliers' },
  { to: '/inventory', label: 'Inventory' },
  
  { section: '─── FINANCE ───' },
  { to: '/payments', label: 'Payments' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/gst', label: 'GST Reports' },
  { to: '/reports', label: 'Reports' },
  
  { section: '─── OPERATIONS ───' },
  { to: '/bulk', label: 'Bulk Orders' },
  { to: '/import-export', label: 'Import / Export' },
  { to: '/shipping', label: 'Shipping' },
  
  { section: '─── SYSTEM ───' },
  { to: '/changes', label: 'Change Requests' },
  { to: '/backup', label: 'Backup' },
  { to: '/settings', label: 'Settings', adminOnly: true },
  { to: '/users', label: 'Users', adminOnly: true }
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [sideCollapsed, setSideCollapsed] = useState(window.innerWidth >= 768 && window.innerWidth <= 1024);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setMobileOpen(false);
      } else if (window.innerWidth <= 1024) {
        setSideCollapsed(true);
      } else {
        setSideCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      syncOfflineQueue().then(n => {
        if (n > 0) showToast(`Synced ${n} offline requests successfully`, 'success');
      });
    };
    const handleOffline = () => {
      setOnline(false);
      showToast('Offline mode activated', 'error');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = NAV.filter(item => !item.adminOnly || isAdmin);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const formatDate = () => {
    const d = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const getPageTitle = () => {
    const current = NAV.find(item => item.to === location.pathname);
    return current ? current.label : 'ERP';
  };

  const getRoleBadge = (role) => {
    if (role === 'admin') return { bg: '#EEF2FF', text: '#3B5BDB', label: 'ADMIN' };
    if (role === 'employee') return { bg: '#ECFDF3', text: '#166534', label: 'EMPLOYEE' };
    return { bg: '#F3E8FF', text: '#7E22CE', label: 'VIEWER' };
  };

  const badge = getRoleBadge(user?.role);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F0F2F5' }}>
      <style>{`
        .nav-item-link {
          height: 40px;
          padding: 0 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          font-weight: 500;
          color: #A0AEC0;
          background-color: transparent;
          border-left: 3px solid transparent;
          text-decoration: none;
          transition: background 120ms, color 120ms;
        }
        .nav-item-link:hover {
          color: #FFFFFF;
          background-color: rgba(255,255,255,0.05);
        }
        .nav-item-link.active {
          color: #FFFFFF;
          background-color: rgba(255,255,255,0.10);
          border-left: 3px solid #4F8EF7;
        }
        @media (max-width: 767px) {
          .desktop-sidebar-container { display: none !important; }
          .main-content-layout { margin-left: 0 !important; padding-bottom: 70px !important; }
          .mobile-navigation-bar { display: flex !important; }
        }
        @media (min-width: 768px) and (max-width: 1024px) {
          .desktop-sidebar-container { width: 56px !important; }
          .main-content-layout { margin-left: 56px !important; }
          .sidebar-app-title { display: none !important; }
          .sidebar-item-label { display: none !important; }
          .sidebar-username { display: none !important; }
          .sidebar-role { display: none !important; }
        }
      `}</style>

      {/* Desktop Fixed Sidebar */}
      <aside 
        className="desktop-sidebar-container no-print"
        style={{
          width: sideCollapsed ? '56px' : '240px',
          backgroundColor: '#1A1A2E',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 100,
          transition: 'width 120ms ease'
        }}
      >
        {/* Top brand */}
        <div style={{
          padding: '20px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          height: '52px',
          display: 'flex',
          alignItems: 'center',
          boxSizing: 'border-box'
        }}>
          {!sideCollapsed ? (
            <span className="sidebar-app-title" style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>
              Olive Seeds ERP
            </span>
          ) : (
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF' }}>OS</span>
          )}
        </div>

        {/* Navigation list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
          {NAV.map((item, idx) => {
            if (item.section) {
              if (sideCollapsed) return null;
              return (
                <div 
                  key={idx}
                  style={{
                    fontSize: '9px',
                    textTransform: 'uppercase',
                    color: '#6B7280',
                    padding: '16px 16px 4px',
                    letterSpacing: '0.1em',
                    fontWeight: '700'
                  }}
                >
                  {item.section}
                </div>
              );
            }

            if (item.adminOnly && !isAdmin) return null;

            return (
              <NavLink 
                key={item.to} 
                to={item.to} 
                end={item.exact}
                className="nav-item-link"
              >
                {!sideCollapsed && <span className="sidebar-item-label" style={{ marginLeft: '12px' }}>{item.label}</span>}
                {sideCollapsed && <span style={{ fontSize: '10px', color: '#FFF' }}>{item.label.slice(0, 2)}</span>}
              </NavLink>
            );
          })}
        </div>

        {/* Separator */}
        <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.08)' }} />

        {/* Bottom User Info Row */}
        <div style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          justifyContent: sideCollapsed ? 'center' : 'space-between',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              backgroundColor: '#4F8EF7',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 700,
              flexShrink: 0
            }}>
              {getInitials(user?.name)}
            </div>
            {!sideCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="sidebar-username" style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>
                  {user?.name || 'User'}
                </span>
                <span className="sidebar-role" style={{ fontSize: '11px', color: '#A0AEC0' }}>
                  {user?.role || 'Viewer'}
                </span>
              </div>
            )}
          </div>
          {!sideCollapsed && (
            <button 
              onClick={handleLogout}
              style={{ color: '#A0AEC0', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#FFFFFF'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#A0AEC0'}
            >
              🚪
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Pane */}
      <div 
        className="main-content-layout"
        style={{
          marginLeft: sideCollapsed ? '56px' : '240px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          transition: 'margin-left 120ms ease'
        }}
      >
        {/* Sticky Header */}
        <header 
          className="no-print"
          style={{
            height: '52px',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #E5E7EB',
            position: 'sticky',
            top: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            zIndex: 99,
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              onClick={() => {
                if (window.innerWidth < 768) {
                  setMobileOpen(!mobileOpen);
                } else {
                  setSideCollapsed(!sideCollapsed);
                }
              }}
              style={{ fontSize: '20px', color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              ☰
            </button>
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>
              {getPageTitle()}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Status Badge */}
            <span style={{
              borderRadius: '20px',
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: 500,
              backgroundColor: online ? '#D1FAE5' : '#FEE2E2',
              color: online ? '#065F46' : '#991B1B'
            }}>
              {online ? 'Online' : 'Offline'}
            </span>

            {/* Date format "25 Jan 2025" */}
            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
              {formatDate()}
            </span>

            {/* User Initials Circle */}
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              backgroundColor: '#1A1A2E',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 700
            }}>
              {getInitials(user?.name)}
            </div>

            {/* Role badge */}
            <span style={{
              backgroundColor: badge.bg,
              color: badge.text,
              fontSize: '10px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '20px'
            }}>
              {badge.label}
            </span>
          </div>
        </header>

        {/* Content Outlet with notices */}
        <main style={{ flex: 1, padding: '20px', boxSizing: 'border-box' }}>
          {/* Employee Notice bar */}
          {user?.role === 'employee' && (
            <div style={{
              backgroundColor: '#ECFDF3',
              borderLeft: '3px solid #6EE7B7',
              padding: '10px 16px',
              color: '#065F46',
              fontSize: '13px',
              marginBottom: '16px',
              borderRadius: '4px'
            }} className="no-print">
              You can upload/import new records. To edit existing records, submit a change request — your admin will approve.
            </div>
          )}

          {/* Viewer Notice bar */}
          {user?.role === 'viewer' && (
            <div style={{
              backgroundColor: '#F5F3FF',
              borderLeft: '3px solid #C4B5FD',
              padding: '10px 16px',
              color: '#6D28D9',
              fontSize: '13px',
              marginBottom: '16px',
              borderRadius: '4px'
            }} className="no-print">
              View-only mode. You can see all data but cannot make changes.
            </div>
          )}

          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (below 768px) */}
      <nav 
        className="mobile-navigation-bar no-print"
        style={{
          display: 'none',
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '56px',
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid #E5E7EB',
          zIndex: 200,
          justifyContent: 'space-around',
          alignItems: 'center',
          boxSizing: 'border-box'
        }}
      >
        {[
          { to: '/', label: 'Home', icon: 'H', exact: true },
          { to: '/quickbill', label: 'Bill', icon: 'B' },
          { to: '/orders', label: 'Orders', icon: 'O' },
          { to: '/invoices', label: 'Invoices', icon: 'I' },
          { to: '#', label: 'More', icon: 'M', isMore: true }
        ].map(item => {
          const isActive = item.isMore ? mobileOpen : (location.pathname === item.to || (item.exact === false && location.pathname.startsWith(item.to)));
          const activeColor = badge.text || '#1A1A2E';

          return (
            <button
              key={item.label}
              onClick={() => {
                if (item.isMore) {
                  setMobileOpen(true);
                } else {
                  navigate(item.to);
                }
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                height: '100%'
              }}
            >
              <span style={{ fontSize: '18px', color: isActive ? activeColor : '#9CA3AF' }}>{item.icon}</span>
              <span style={{ fontSize: '10px', color: isActive ? activeColor : '#9CA3AF', marginTop: '2px' }}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Mobile slide-up/side-out more drawer */}
      {mobileOpen && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            zIndex: 300,
            display: 'flex',
            justifyContent: 'flex-end'
          }}
          onClick={() => setMobileOpen(false)}
        >
          <div 
            style={{
              width: '280px',
              backgroundColor: '#FFFFFF',
              height: '100%',
              boxShadow: '-2px 0 10px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: '#111827', fontSize: '14px' }}>All Navigation</span>
              <button onClick={() => setMobileOpen(false)} style={{ fontSize: '18px', color: '#9CA3AF', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {NAV.map((item, idx) => {
                if (item.section) {
                  return (
                    <div 
                      key={idx}
                      style={{
                        fontSize: '9px',
                        textTransform: 'uppercase',
                        color: '#6B7280',
                        padding: '16px 16px 4px',
                        letterSpacing: '0.1em',
                        fontWeight: '700'
                      }}
                    >
                      {item.section}
                    </div>
                  );
                }

                if (item.adminOnly && !isAdmin) return null;

                return (
                  <NavLink 
                    key={item.to} 
                    to={item.to} 
                    end={item.exact}
                    onClick={() => setMobileOpen(false)}
                    style={({ isActive }) => ({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      height: '44px',
                      padding: '0 16px',
                      color: isActive ? (badge.text || '#1A1A2E') : '#374151',
                      backgroundColor: isActive ? '#F9FAFB' : 'transparent',
                      textDecoration: 'none',
                      fontWeight: isActive ? 600 : 500,
                      fontSize: '14px'
                    })}
                  >
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
            <div style={{ padding: '16px', borderTop: '1px solid #E5E7EB' }}>
              <button 
                onClick={handleLogout}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
