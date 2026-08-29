import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function Backup() {
  const [status, setStatus] = useState({
    connected: false, email: null, message: 'Checking...'
  });
  const [settings, setSettings] = useState({
    frequency: 'manual', keep_count: 10,
    google_drive_folder: 'OliveSeeds ERP Backups'
  });
  const [history, setHistory] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [restoreWord, setRestoreWord] = useState('');
  const popupRef = useRef(null);
  const messageListenerRef = useRef(null);

  useEffect(() => {
    fetchStatus();
    fetchSettings();
    fetchHistory();
    return () => {
      // Cleanup message listener on unmount
      if (messageListenerRef.current) {
        window.removeEventListener('message', messageListenerRef.current);
      }
    };
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/backup/google-status');
      setStatus(res.data);
    } catch {
      setStatus({ connected: false, email: null, message: 'Error checking status' });
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get('/backup/settings');
      setSettings(res.data);
    } catch {}
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get('/backup/history');
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch {
      setHistory([]);
    }
  };


  // ── CONNECT GOOGLE DRIVE ───────────────────────────────
  const connectGoogleDrive = async () => {
    setConnecting(true);
    try {
      // Step 1: Get the auth URL from backend
      const res = await api.get('/backup/google-auth-url');
      const { url } = res.data;
      if (!url) {
        toast.error('Could not get Google auth URL. Check server config.');
        setConnecting(false);
        return;
      }
      // Step 2: Open popup window for Google OAuth
      const width = 500;
      const height = 600;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const popup = window.open(
        url,
        'google_auth_popup',
        `width=${width},height=${height},left=${left},top=${top},` +
        'resizable=yes,scrollbars=yes'
      );
      if (!popup) {
        toast.error(
          'Popup blocked! Please allow popups for this site and try again.'
        );
        setConnecting(false);
        return;
      }
      popupRef.current = popup;
      // Step 3: Listen for message from popup callback page
      const handleMessage = (event) => {
        // Accept messages from any origin
        // (the callback comes from your domain)
        if (!event.data || !event.data.type) return;
        if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
          // Successfully connected
          toast.success(
            `Google Drive connected as ${event.data.email} `
          );
          setStatus({
            connected: true,
            email: event.data.email,
            message: 'Connected'
          });
          setConnecting(false);
          fetchHistory();
          // Cleanup
          window.removeEventListener('message', handleMessage);
          messageListenerRef.current = null;
          if (popup && !popup.closed) popup.close();
        } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
          toast.error('Google Drive connection failed: ' + event.data.error);
          setConnecting(false);
          // Cleanup
          window.removeEventListener('message', handleMessage);
          messageListenerRef.current = null;
        }
      };
      window.addEventListener('message', handleMessage);
      messageListenerRef.current = handleMessage;
      // Step 4: Also poll to detect if popup was closed manually
      const pollInterval = setInterval(() => {
        if (popup && popup.closed) {
          clearInterval(pollInterval);
          // If still connecting (no success/error message received)
          if (connecting || setConnecting) {
            setConnecting(false);
            // Re-check status in case it succeeded
            setTimeout(fetchStatus, 500);
          }
          window.removeEventListener('message', handleMessage);
          messageListenerRef.current = null;
        }
      }, 500);
      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (popup && !popup.closed) popup.close();
        setConnecting(false);
        window.removeEventListener('message', handleMessage);
        messageListenerRef.current = null;
      }, 5 * 60 * 1000);
    } catch (err) {
      toast.error('Connection error: ' + (err.response?.data?.error || err.message));
      setConnecting(false);
    }
  };

  // ── DISCONNECT GOOGLE DRIVE ────────────────────────────
  const disconnectDrive = async () => {
    if (!window.confirm('Disconnect Google Drive?')) return;
    try {
      await api.post('/backup/google-disconnect');
      setStatus({ connected: false, email: null, message: 'Disconnected' });
      toast.success('Google Drive disconnected');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error disconnecting');
    }
  };

  // ── DOWNLOAD BACKUP ────────────────────────────────────
  const downloadBackup = async () => {
    setDownloading(true);
    try {
      const response = await api.get('/backup/download', {
        responseType: 'blob',
        timeout: 120000
      });
      // Check for JSON error response
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        const text = await response.data.text();
        const json = JSON.parse(text);
        throw new Error(json.error || 'Backup failed');
      }
      // Trigger download
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `OliveSeeds_Backup_${timestamp}.zip`;
      const url = window.URL.createObjectURL(
        new Blob([response.data], { type: 'application/zip' })
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
      toast.success(`Backup downloaded: ${filename} `);
      fetchHistory();
    } catch (err) {
      toast.error('Download failed: ' + (err.message || 'Unknown error'));
    } finally {
      setDownloading(false);
    }
  };

  // ── UPLOAD TO GOOGLE DRIVE ────────────────────────────
  const uploadToDrive = async () => {
    if (!status.connected) {
      toast.error('Please connect Google Drive first');
      return;
    }
    setUploading(true);
    try {
      const res = await api.post('/backup/google-save', {
        folderName: settings.google_drive_folder || 'OliveSeeds ERP Backups'
      }, { timeout: 180000 });
      toast.success(`Uploaded to Google Drive \n${res.data.filename}`);
      fetchHistory();
      if (res.data.web_link) {
        const open = window.confirm('Open in Google Drive?');
        if (open) window.open(res.data.web_link, '_blank');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Upload failed';
      if (msg.includes('not connected') || msg.includes('Token expired')) {
        setStatus({ connected: false, email: null, message: msg });
        toast.error('Google Drive disconnected. Please reconnect.');
      } else {
        toast.error('Upload failed: ' + msg);
      }
    } finally {
      setUploading(false);
    }
  };

  // ── SAVE BACKUP SETTINGS ──────────────────────────────
  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.post('/backup/settings', settings);
      toast.success('Backup settings saved ');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSavingSettings(false);
    }
  };

  const fmtDate = (d) =>
    d ? new Date(d).toLocaleString('en-IN') : '-';

  // ── RENDER ────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A2E' }}>
          Backup & Restore
        </h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
          Download your data or save to Google Drive
        </p>
      </div>

      {/* ── SECTION A: MANUAL DOWNLOAD ── */}
      <div style={cardStyle}>
        <h2 style={sectionTitle}>Download Backup</h2>
        <p style={sectionDesc}>
          Download all your data as a ZIP file containing CSV exports
          of every table. Keep this file safe — it can be used to restore
          your data.
        </p>
        <button
          onClick={downloadBackup}
          disabled={downloading}
          style={btnPrimary(downloading)}
        >
          {downloading ? 'Preparing backup...' : 'Download Backup Now'}
        </button>
      </div>

      {/* ── SECTION B: GOOGLE DRIVE ── */}
      <div style={cardStyle}>
        <h2 style={sectionTitle}>Google Drive Backup</h2>
        {/* Connection Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: status.connected ? '#F0FDF4' : '#FFF7ED',
          border: `1px solid ${status.connected ? '#86EFAC' : '#FED7AA'}`,
          borderRadius: 8,
          marginBottom: 20
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: status.connected ? '#16A34A' : '#F97316',
            flexShrink: 0
          }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>
              {status.connected
                ? `Connected: ${status.email}`
                : 'Not Connected'}
            </div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>
              {status.message}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {status.connected ? (
              <>
                <button onClick={uploadToDrive} disabled={uploading}
                  style={btnSuccess(uploading)}>
                  {uploading ? 'Uploading...' : 'Upload Backup'}
                </button>
                <button onClick={disconnectDrive} style={btnDanger}>
                  Disconnect
                </button>
              </>
            ) : (
              <button onClick={connectGoogleDrive} disabled={connecting}
                style={btnPrimary(connecting)}>
                {connecting ? 'Connecting...' : 'Connect Google Drive'}
              </button>
            )}
          </div>
        </div>

        {/* Setup Instructions (shown when not connected) */}
        {!status.connected && (
          <div style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: 16,
            marginBottom: 16
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
              How to connect Google Drive:
            </p>
            {[
              'Go to console.cloud.google.com',
              'Create a project → Enable Google Drive API',
              'Create OAuth 2.0 Client ID credentials (Web Application)',
              `Add Authorized Redirect URI: ${process.env.REACT_APP_API_URL || window.location.origin}/api/backup/google-callback`,
              'Copy Client ID and Client Secret to your .env file',
              'Restart your Docker container',
              'Click "Connect Google Drive" above'
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 6, alignItems: 'flex-start' }}>
                <span style={{
                  width: 22, height: 22, background: '#1A1A2E', color: '#fff',
                  borderRadius: '50%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 11, fontWeight: 700,
                  flexShrink: 0, marginTop: 1
                }}>{i + 1}</span>
                <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                  {step}
                </span>
              </div>
            ))}
            <div style={{
              marginTop: 12, padding: '10px 14px',
              background: '#FEF9C3', border: '1px solid #FCD34D',
              borderRadius: 6, fontSize: 12, color: '#92400E'
            }}>
              <strong>Required .env variables:</strong><br />
              GOOGLE_CLIENT_ID=your_client_id<br />
              GOOGLE_CLIENT_SECRET=your_client_secret<br />
              GOOGLE_REDIRECT_URI=https://yourdomain.com/api/backup/google-callback
            </div>
          </div>
        )}

        {/* Backup Settings */}
        {status.connected && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Backup Frequency</label>
                <select
                  value={settings.frequency}
                  onChange={e => setSettings(s => ({ ...s, frequency: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="manual">Manual only</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly (Recommended)</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Keep last N backups</label>
                <input
                  type="number" min="1" max="50"
                  value={settings.keep_count}
                  onChange={e => setSettings(s => ({ ...s, keep_count: parseInt(e.target.value) || 10 }))}
                  style={inputStyle}
                />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Google Drive Folder Name</label>
                <input
                  type="text"
                  value={settings.google_drive_folder}
                  onChange={e => setSettings(s => ({ ...s, google_drive_folder: e.target.value }))}
                  style={inputStyle}
                  placeholder="OliveSeeds ERP Backups"
                />
              </div>
            </div>
            <button onClick={saveSettings} disabled={savingSettings} style={btnOutline}>
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}
      </div>

      {/* ── SECTION C: BACKUP HISTORY ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ ...sectionTitle, marginBottom: 0 }}>Backup History</h2>
          <button onClick={fetchHistory} style={btnOutline}>Refresh</button>
        </div>
        {history.length === 0 ? (
          <p style={{ color: '#9CA3AF', textAlign: 'center', padding: 24 }}>
            No backups yet
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['Date', 'Filename', 'Type', 'Size', 'Status', 'Location', 'By'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#6B7280', fontWeight: 600, borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={tdStyle}>{fmtDate(row.created_at)}</td>
                    <td style={tdStyle}>{row.filename}</td>
                    <td style={tdStyle}>
                      <span style={{ background: row.type === 'google_drive' ? '#DBEAFE' : '#F3F4F6', color: row.type === 'google_drive' ? '#1E40AF' : '#374151', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>
                        {row.type === 'google_drive' ? 'Drive' : 'Manual'}
                      </span>
                    </td>
                    <td style={tdStyle}>{row.file_size || '-'}</td>
                    <td style={tdStyle}>
                      <span style={{ color: row.status === 'success' ? '#16A34A' : '#DC2626', fontWeight: 600 }}>
                        {row.status === 'success' ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {row.location && row.location.startsWith('http') ? (
                        <a href={row.location} target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB', fontSize: 11 }}>
                          View in Drive
                        </a>
                      ) : (row.location || '-')}
                    </td>
                    <td style={tdStyle}>{row.created_by_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── SECTION D: RESTORE ── */}
      <div style={{ ...cardStyle, background: '#FFF5F5', border: '1px solid #FECACA' }}>
        <h2 style={{ ...sectionTitle, color: '#991B1B' }}>Restore Data</h2>
        <p style={{ fontSize: 13, color: '#7F1D1D', marginBottom: 16, lineHeight: 1.7 }}>
          <strong>WARNING:</strong> Restoring will overwrite ALL existing data.
          This cannot be undone. Download a fresh backup before restoring.
        </p>
        {!showRestore ? (
          <button onClick={() => setShowRestore(true)} style={btnDanger}>
            Show Restore Options
          </button>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: '#991B1B', marginBottom: 10 }}>
              Type <strong>RESTORE</strong> to confirm:
            </p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="text"
                value={restoreWord}
                onChange={e => setRestoreWord(e.target.value)}
                placeholder="Type RESTORE"
                style={{ ...inputStyle, maxWidth: 200 }}
              />
              <button
                onClick={() => {
                  if (restoreWord !== 'RESTORE') {
                    toast.error('Type exactly: RESTORE');
                    return;
                  }
                  toast.error('Restore via file upload — feature coming soon. Use database import for now.');
                }}
                disabled={restoreWord !== 'RESTORE'}
                style={btnDanger}
              >
                Restore
              </button>
              <button onClick={() => { setShowRestore(false); setRestoreWord(''); }} style={btnOutline}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── STYLES ──────────────────────────────────────────────
const cardStyle = {
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: 10,
  padding: 24,
  marginBottom: 16,
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
};

const sectionTitle = {
  fontSize: 16,
  fontWeight: 700,
  color: '#1A1A2E',
  marginBottom: 8
};

const sectionDesc = {
  fontSize: 13,
  color: '#6B7280',
  marginBottom: 16,
  lineHeight: 1.6
};

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 5
};

const inputStyle = {
  width: '100%',
  border: '1.5px solid #D1D5DB',
  borderRadius: 7,
  padding: '9px 12px',
  fontSize: 13,
  color: '#111827',
  background: '#FFFFFF',
  boxSizing: 'border-box'
};

const tdStyle = {
  padding: '8px 10px',
  color: '#374151',
  fontSize: 12
};

const btnPrimary = (disabled) => ({
  background: disabled ? '#9CA3AF' : '#1A1A2E',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: 7,
  padding: '9px 18px',
  fontSize: 13,
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.7 : 1
});

const btnSuccess = (disabled) => ({
  background: disabled ? '#9CA3AF' : '#16A34A',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: 7,
  padding: '9px 18px',
  fontSize: 13,
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.7 : 1
});

const btnDanger = {
  background: '#DC2626',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: 7,
  padding: '9px 18px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer'
};

const btnOutline = {
  background: '#FFFFFF',
  color: '#374151',
  border: '1px solid #D1D5DB',
  borderRadius: 7,
  padding: '9px 18px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer'
};
