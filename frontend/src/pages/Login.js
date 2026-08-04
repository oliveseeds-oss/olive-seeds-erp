import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email:'', password:'' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await login(form.email, form.password);
    if (res.success) { toast.success('Welcome back!'); navigate('/'); }
    else toast.error(res.error);
  };

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#1a5276 0%,#2980b9 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'#fff', borderRadius:16, padding:40, width:'100%', maxWidth:400, boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:48, marginBottom:8 }}>🌿</div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#1a5276' }}>Olive Seeds ERP</h1>
          <p style={{ fontSize:13, color:'#718096', marginTop:4 }}>Design Studio Management System</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'#333', display:'block', marginBottom:4 }}>Email Address</label>
            <input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required placeholder="admin@oliveseeds.com"
              style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'10px 12px', fontSize:14, outline:'none' }} />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'#333', display:'block', marginBottom:4 }}>Password</label>
            <input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required placeholder="••••••••"
              style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'10px 12px', fontSize:14, outline:'none' }} />
          </div>
          <button type="submit" disabled={loading} style={{ background:'#1a5276', color:'#fff', border:'none', borderRadius:8, padding:'12px', fontSize:15, fontWeight:700, cursor: loading?'not-allowed':'pointer', marginTop:8, opacity:loading?0.7:1 }}>
            {loading ? '⏳ Signing in...' : '🔐 Sign In'}
          </button>
        </form>
        <div style={{ marginTop:24, padding:16, background:'#f8f9fa', borderRadius:8, fontSize:12, color:'#555' }}>
          <p style={{ fontWeight:700, marginBottom:8 }}>Default Accounts:</p>
          <p>👑 Admin: admin@oliveseeds.com</p>
          <p>👨‍💼 Employee: employee@oliveseeds.com</p>
          <p>👁️ Viewer: viewer@oliveseeds.com</p>
          <p style={{ marginTop:6, color:'#e74c3c' }}>Default password: <strong>password</strong></p>
        </div>
      </div>
    </div>
  );
}
