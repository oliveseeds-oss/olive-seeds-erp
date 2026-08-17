import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const res = await login(email, password);
    if (res.success) {
      navigate('/');
    } else {
      setErrorMsg(res.error || 'Invalid email or password. Please try again.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      background: '#F0F2F5',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'sans-serif',
      boxSizing: 'border-box',
      margin: 0,
      padding: 0
    }}>
      <style>{`
        .login-input:focus {
          border-color: #3B5BDB !important;
          outline: none !important;
          box-shadow: 0 0 0 3px rgba(59, 91, 219, 0.12) !important;
        }
        .login-button:hover {
          background-color: #2D2D44 !important;
        }
        .login-spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-right: 8px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{
        width: '420px',
        backgroundColor: '#FFFFFF',
        border: '1px solid #E0E0E0',
        borderRadius: '12px',
        padding: '40px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        boxSizing: 'border-box'
      }}>
        <form onSubmit={handleSubmit}>
          {/* 1. App name text */}
          <div style={{
            fontSize: '22px',
            fontWeight: '700',
            color: '#1A1A2E',
            textAlign: 'center',
            marginBottom: '4px'
          }}>
            Olive Seeds ERP
          </div>

          {/* 2. Subtitle text */}
          <div style={{
            fontSize: '13px',
            fontWeight: '400',
            color: '#6B7280',
            textAlign: 'center',
            marginBottom: '32px'
          }}>
            Business Management System
          </div>

          {/* 3. Email Address */}
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '16px' }}>
            <label style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '5px'
            }}>
              Email Address
            </label>
            <input
              type="email"
              className="login-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              style={{
                background: '#FFFFFF',
                border: '1.5px solid #D1D5DB',
                borderRadius: '8px',
                padding: '11px 14px',
                fontSize: '14px',
                color: '#111827',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* 4. Password */}
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '24px', position: 'relative' }}>
            <label style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '5px'
            }}>
              Password
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{
                  background: '#FFFFFF',
                  border: '1.5px solid #D1D5DB',
                  borderRadius: '8px',
                  padding: '11px 40px 11px 14px',
                  fontSize: '14px',
                  color: '#111827',
                  boxSizing: 'border-box',
                  width: '100%'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#9CA3AF',
                  cursor: 'pointer',
                  fontSize: '13px',
                  padding: 0,
                  outline: 'none',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* 5. Sign In Button */}
          <button
            type="submit"
            className="login-button"
            disabled={loading}
            style={{
              width: '100%',
              height: '44px',
              background: '#1A1A2E',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: '600',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '0px'
            }}
          >
            {loading ? (
              <>
                <span className="login-spinner" />Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>

          {/* 6. Error Message */}
          {errorMsg && (
            <div style={{
              marginTop: '12px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '6px',
              padding: '10px 14px',
              boxSizing: 'border-box'
            }}>
              <span style={{
                color: '#B91C1C',
                fontSize: '13px'
              }}>
                {errorMsg}
              </span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
