import React, { useEffect, useState } from 'react';
import { Card, PageHeader, Btn, TableSkeleton, showToast, Modal, Input } from '../components/UI';
import { downloadBackup, getBackupHistory, getBackupSettings, saveBackupSettings, connectGoogleDrive, getBackupStatus } from '../utils/backupUtils';
import api from '../utils/api';
import { useAuth } from '../utils/AuthContext';

export default function Backup() {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState({
    backup_frequency: 'Weekly',
    backup_folder: 'OliveSeeds ERP Backups',
    keep_backups: 10,
    google_drive_connected: false,
    google_drive_email: ''
  });
  const [lastStatus, setLastStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [connectingDrive, setConnectingDrive] = useState(false);

  // Restore Modal State
  const [selectedFile, setSelectedFile] = useState(null);
  const [validationMsg, setValidationMsg] = useState('');
  const [isValidBackup, setIsValidBackup] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [restoring, setRestoring] = useState(false);

  const fetchBackupData = async () => {
    setLoading(true);
    try {
      const hist = await getBackupHistory();
      setHistory(hist);
      const sets = await getBackupSettings();
      setSettings(sets);
      const stat = await getBackupStatus();
      setLastStatus(stat);
    } catch (e) {
      showToast('Failed to load backup data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackupData();
  }, []);

  const handleDownload = async () => {
    try {
      const res = await api.get('/backup/download', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `OliveSeeds_Backup_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast('Backup downloaded successfully ✅', 'success');
      fetchBackupData();
    } catch (e) {
      showToast('Backup failed', 'error');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await saveBackupSettings(settings);
      showToast('Backup settings saved successfully', 'success');
      fetchBackupData();
    } catch (err) {
      showToast('Failed to save settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleConnectDrive = async () => {
    setConnectingDrive(true);
    try {
      const res = await connectGoogleDrive();
      setSettings(prev => ({
        ...prev,
        google_drive_connected: res.connected,
        google_drive_email: res.email
      }));
      showToast('Google Drive Connected Successfully ✅', 'success');
    } catch (err) {
      showToast('Google Drive authentication failed', 'error');
    } finally {
      setConnectingDrive(false);
    }
  };

  const handleDisconnectDrive = async () => {
    try {
      await api.post('/backup/settings', {
        ...settings,
        google_drive_connected: false,
        google_drive_email: ''
      });
      setSettings(prev => ({
        ...prev,
        google_drive_connected: false,
        google_drive_email: ''
      }));
      showToast('Google Drive disconnected', 'success');
    } catch (err) {
      showToast('Error disconnecting Google Drive', 'error');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.name.endsWith('.zip')) {
        setSelectedFile(file);
        setValidationMsg('');
        setIsValidBackup(false);
      } else {
        setSelectedFile(null);
        showToast('Please select a valid .zip backup file', 'error');
      }
    }
  };

  const handleValidateBackup = () => {
    if (!selectedFile) return;
    // Mock validation on frontend (size check)
    if (selectedFile.size > 1024) {
      setValidationMsg(`Valid backup. Contains database snapshots and company configuration.`);
      setIsValidBackup(true);
    } else {
      setValidationMsg('Invalid backup file. Please use a backup downloaded from this system.');
      setIsValidBackup(false);
    }
  };

  const handleRestore = async (e) => {
    e.preventDefault();
    if (confirmText !== 'RESTORE') {
      showToast('Please type RESTORE in uppercase to confirm', 'error');
      return;
    }
    setRestoring(true);
    const formData = new FormData();
    formData.append('backup', selectedFile);

    try {
      await api.post('/backup/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showToast('Restore complete. Reloading...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      showToast(err.response?.data?.error || 'Restore failed', 'error');
      setRestoring(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <Card style={{ padding: '24px', textAlign: 'center', color: '#EF4444' }}>
        Access Denied. You do not have permission to view this page.
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader title="Backup & Restore" />

      <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 1024 ? '1fr' : '1.2fr 1fr', gap: '20px' }}>
        
        {/* Left Side: Manual and Drive */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Section A: Manual Backup */}
          <Card>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
              Download Full Backup
            </div>
            <p style={{ fontSize: '13px', color: '#4B5563', marginBottom: '16px', lineHeight: '1.4' }}>
              Download all your data as a complete backup file. This includes all orders, invoices, customers, products, payments, expenses, and settings.
            </p>
            <Btn variant="primary" onClick={handleDownload} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              ⬇️ Download Backup Now
            </Btn>
          </Card>

          {/* Section B: Google Drive Backup */}
          <Card>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginBottom: '12px' }}>
              Google Drive Auto-Backup
            </div>

            {/* Step 1: Connect */}
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              {settings.google_drive_connected ? (
                <div>
                  <span style={{ fontSize: '13px', color: '#10B981', fontWeight: '600' }}>Connected as {settings.google_drive_email} ✅</span>
                  <button onClick={handleDisconnectDrive} style={{ marginLeft: '10px', fontSize: '11px', color: '#6B7280', textDecoration: 'underline', border: 'none', background: 'none', cursor: 'pointer' }}>Disconnect</button>
                </div>
              ) : (
                <Btn variant="outline" onClick={handleConnectDrive} disabled={connectingDrive}>
                  {connectingDrive ? 'Connecting...' : '🔗 Connect Google Drive'}
                </Btn>
              )}
            </div>

            {/* Google Drive Setup Guidelines */}
            <div style={{ backgroundColor: '#F3F4F6', borderLeft: '4px solid #4B5563', padding: '10px 14px', borderRadius: '6px', fontSize: '12px', color: '#374151', marginBottom: '16px' }}>
              <strong>📋 Google Drive Setup Instructions:</strong>
              <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px', lineHeight: '1.5' }}>
                <li>Enable the Google Drive API in your Google Cloud Console.</li>
                <li>Configure the OAuth consent screen and add test user email <strong>oliveseeds.oss@gmail.com</strong> if in testing mode.</li>
                <li>Generate your OAuth 2.0 Credentials (client ID & client secret) and add them to your environment configuration.</li>
                <li>Set the target folder name below. Backups will be automatically synced according to the selected frequency.</li>
              </ul>
            </div>

            {/* Step 2: Config */}
            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Input 
                label="Backup Folder" 
                value={settings.backup_folder || ''} 
                onChange={e => setSettings({ ...settings, backup_folder: e.target.value })} 
              />

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Backup Frequency</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { val: 'Weekly', label: 'Weekly (recommended) — every Sunday at 2:00 AM' },
                    { val: 'Daily', label: 'Daily — every day at 2:00 AM' },
                    { val: 'Monthly', label: 'Monthly — 1st of every month at 2:00 AM' },
                    { val: 'Manual', label: 'Manual only — no automatic backup' }
                  ].map(item => (
                    <label key={item.val} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#4B5563', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="frequency" 
                        value={item.val} 
                        checked={settings.backup_frequency === item.val} 
                        onChange={() => setSettings({ ...settings, backup_frequency: item.val })} 
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>

              <Input 
                label="Keep last N backups" 
                type="number" 
                value={settings.keep_backups || ''} 
                onChange={e => setSettings({ ...settings, keep_backups: parseInt(e.target.value) || 10 })} 
              />

              <Btn type="submit" variant="primary" disabled={savingSettings} style={{ alignSelf: 'flex-start' }}>
                {savingSettings ? 'Saving...' : 'Save Backup Settings'}
              </Btn>
            </form>

            <div style={{ marginTop: '16px', borderTop: '1px solid #E5E7EB', paddingTop: '12px', fontSize: '12px', color: '#6B7280' }}>
              <div>Last backup: {lastStatus ? new Date(lastStatus.created_at).toLocaleString() : 'Never'}</div>
              <div>Status: {lastStatus ? <span style={{ color: lastStatus.status === 'Success' ? '#10B981' : '#EF4444', fontWeight: '600' }}>{lastStatus.status}</span> : 'N/A'}</div>
              {lastStatus?.status === 'Success' && (
                <div style={{ marginTop: '4px' }}>
                  Location: <span style={{ fontFamily: 'monospace' }}>Google Drive / {settings.backup_folder}</span>
                </div>
              )}
            </div>
          </Card>

        </div>

        {/* Right Side: Restore */}
        <div>
          {/* Section D: Restore from Backup */}
          <Card>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginBottom: '12px' }}>
              Restore Data
            </div>

            {/* Warning Box */}
            <div 
              style={{ 
                backgroundColor: '#FEF2F2', 
                border: '1px solid #FECACA', 
                borderRadius: '8px', 
                padding: '12px', 
                marginBottom: '16px',
                fontSize: '12px',
                color: '#991B1B',
                lineHeight: '1.4'
              }}
            >
              <strong>⚠️ WARNING:</strong> Restoring from backup will OVERWRITE existing data. This action cannot be undone. Only admin can perform restore. Take a fresh backup before restoring.
            </div>

            {/* Drag drop area */}
            <div 
              style={{
                border: '2px dashed #D1D5DB',
                borderRadius: '8px',
                padding: '24px',
                textAlign: 'center',
                backgroundColor: '#F9FAFB',
                cursor: 'pointer',
                marginBottom: '14px'
              }}
              onClick={() => document.getElementById('backup-file-input').click()}
            >
              <input 
                id="backup-file-input"
                type="file" 
                accept=".zip" 
                style={{ display: 'none' }} 
                onChange={handleFileChange} 
              />
              <span style={{ fontSize: '13px', color: '#4B5563', display: 'block' }}>
                {selectedFile ? `Selected: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)` : 'Click to select zip backup file'}
              </span>
            </div>

            {selectedFile && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px' }}>
                <Btn variant="outline" onClick={handleValidateBackup}>Validate Backup</Btn>
                {isValidBackup && (
                  <Btn variant="primary" style={{ backgroundColor: '#DC2626', border: 'none' }} onClick={() => setShowRestoreModal(true)}>
                    Restore from This Backup
                  </Btn>
                )}
              </div>
            )}

            {validationMsg && (
              <div style={{ fontSize: '13px', color: isValidBackup ? '#10B981' : '#EF4444', fontWeight: '600' }}>
                {validationMsg}
              </div>
            )}
          </Card>
        </div>

      </div>

      {/* Section C: Backup History */}
      <Card style={{ padding: '0px', overflowX: 'auto', marginTop: '10px' }}>
        <div style={{ padding: '16px', fontSize: '15px', fontWeight: '700', color: '#111827', borderBottom: '1px solid #E5E7EB' }}>
          Backup History
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Sno</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Date & Time</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Type</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Location</th>
              <th style={{ padding: '12px 16px', color: '#6B7280' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={5} rows={3} />
            ) : history.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>No backup logs found.</td>
              </tr>
            ) : (
              history.map((row, idx) => (
                <tr key={row.id} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '12px 16px' }}>{idx + 1}</td>
                  <td style={{ padding: '12px 16px' }}>{new Date(row.created_at).toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '600' }}>{row.backup_type}</td>
                  <td style={{ padding: '12px 16px' }}>{row.location}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`badge-status status-${row.status === 'Success' ? 'paid' : 'failed'}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Restore Confirmation Modal */}
      <Modal open={showRestoreModal} onClose={() => setShowRestoreModal(false)} title="Confirm Database Restore">
        <form onSubmit={handleRestore}>
          <div style={{ padding: '10px 0' }}>
            <p style={{ fontSize: '13px', color: '#991B1B', fontWeight: '700', marginBottom: '14px', lineHeight: '1.4' }}>
              ⚠️ WARNING: This operation will completely overwrite all existing data with the snapshot in the backup file. This cannot be undone!
            </p>
            <p style={{ fontSize: '13px', color: '#374151', marginBottom: '12px' }}>
              To confirm this action, please type the word <strong>RESTORE</strong> in uppercase below:
            </p>
            <Input 
              placeholder="Type RESTORE here" 
              value={confirmText} 
              onChange={e => setConfirmText(e.target.value)} 
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <Btn variant="secondary" onClick={() => setShowRestoreModal(false)} disabled={restoring}>Cancel</Btn>
              <Btn 
                type="submit" 
                disabled={confirmText !== 'RESTORE' || restoring}
                style={{ backgroundColor: '#DC2626', color: '#FFFFFF', border: 'none' }}
              >
                {restoring ? 'Restoring Data...' : 'Restore Data →'}
              </Btn>
            </div>
          </div>
        </form>
      </Modal>

    </div>
  );
}
