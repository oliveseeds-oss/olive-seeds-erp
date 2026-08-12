import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../utils/AuthContext';
import { Card, PageHeader, Btn, Input, Select, Textarea, TableSkeleton, showToast } from '../components/UI';

export default function Settings() {
  const { user } = useAuth();
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = () => {
    setLoading(true);
    api.get('/settings')
      .then(res => {
        setForm(res.data || {});
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (user?.role !== 'admin') {
      setLoading(false);
      return;
    }
    fetchSettings();
  }, [user]);

  const saveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', form);
      showToast('Settings saved successfully', 'success');
      fetchSettings();
    } catch (err) {
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('logo', file);
    try {
      const res = await api.post('/settings/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setForm(prev => ({ ...prev, logo_path: res.data.logo_path }));
      showToast('Logo uploaded successfully', 'success');
      fetchSettings();
    } catch (err) {
      showToast('Logo upload failed', 'error');
    }
  };

  const removeLogo = async () => {
    try {
      await api.put('/settings', { remove_logo: 'true' });
      setForm(prev => ({ ...prev, logo_path: null }));
      showToast('Logo removed', 'success');
      fetchSettings();
    } catch (err) {
      showToast('Logo removal failed', 'error');
    }
  };

  const handleCompanySignatureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('signature', file);
    try {
      const res = await api.post('/settings/signature', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setForm(prev => ({ ...prev, default_signature_path: res.data.default_signature_path }));
      showToast('Default signature uploaded successfully', 'success');
      fetchSettings();
    } catch (err) {
      showToast('Signature upload failed', 'error');
    }
  };

  const removeCompanySignature = async () => {
    try {
      await api.put('/settings', { remove_signature: 'true' });
      setForm(prev => ({ ...prev, default_signature_path: null }));
      showToast('Default signature removed', 'success');
      fetchSettings();
    } catch (err) {
      showToast('Signature removal failed', 'error');
    }
  };

  if (user?.role !== 'admin') {
    return (
      <Card style={{ padding: '24px', textAlign: 'center', color: '#EF4444' }}>
        Access Denied. You do not have permission to view this page.
      </Card>
    );
  }

  if (loading) return <Card><TableSkeleton cols={2} rows={4} /></Card>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <PageHeader 
        title="Settings"
        actions={
          <Btn variant="primary" onClick={saveSettings} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Btn>
        }
      />

      <form onSubmit={saveSettings}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          <Card>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Company Information</div>
            <Input label="Company Name" value={form.company_name || ''} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            <Input label="GSTIN" value={form.gstin || ''} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
            <Input label="PAN" value={form.pan || ''} onChange={(e) => setForm({ ...form, pan: e.target.value })} />
            <Input label="IEC" value={form.iec || ''} onChange={(e) => setForm({ ...form, iec: e.target.value })} />
            <Input label="Contact Email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Contact Phone" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Textarea label="Address" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <Input label="City" value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Input label="State" value={form.state || ''} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            <Input label="Pincode" value={form.pincode || ''} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
            <Input label="Country" value={form.country || ''} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <Card>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Billing & Financials Setup</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Input label="Invoice Prefix" value={form.invoice_prefix || ''} onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value })} />
                <Input label="Invoice Counter" type="number" value={form.invoice_counter || ''} onChange={(e) => setForm({ ...form, invoice_counter: parseInt(e.target.value) || 1 })} />
              </div>
              <Input label="Currency" value={form.currency || 'INR'} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
              <Input label="Bank Name" value={form.bank_name || ''} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
              <Input label="Account Number" value={form.bank_account || ''} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} />
              <Input label="IFSC Code" value={form.bank_ifsc || ''} onChange={(e) => setForm({ ...form, bank_ifsc: e.target.value })} />
              <Input label="Bank Branch" value={form.bank_branch || ''} onChange={(e) => setForm({ ...form, bank_branch: e.target.value })} />
              <Input label="UPI ID" value={form.upi_id || ''} onChange={(e) => setForm({ ...form, upi_id: e.target.value })} />
              <Textarea label="Terms & Conditions" value={form.terms_conditions || ''} onChange={(e) => setForm({ ...form, terms_conditions: e.target.value })} />
              <Textarea label="Invoice Footer" value={form.invoice_footer || ''} onChange={(e) => setForm({ ...form, invoice_footer: e.target.value })} />
            </Card>

            <Card>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Logo & Signature Settings</div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Company Logo</label>
                {form.logo_path ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src={form.logo_path} style={{ maxHeight: '60px', border: '1px solid #E5E7EB', padding: '4px' }} alt="Company Logo" />
                    <Btn type="button" variant="danger" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={removeLogo}>Remove Logo</Btn>
                  </div>
                ) : (
                  <input type="file" accept=".png,.jpg,.jpeg" onChange={handleLogoUpload} />
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Default Company Signature</label>
                <span style={{ display: 'block', fontSize: '11px', color: '#6B7280', marginBottom: '8px' }}>Used when staff member has no personal signature</span>
                {form.default_signature_path ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src={form.default_signature_path} style={{ maxHeight: '60px', border: '1px solid #E5E7EB', padding: '4px' }} alt="Company Signature" />
                    <Btn type="button" variant="danger" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={removeCompanySignature}>Remove Signature</Btn>
                  </div>
                ) : (
                  <input type="file" accept=".png,.jpg,.jpeg" onChange={handleCompanySignatureUpload} />
                )}
              </div>
            </Card>
          </div>

        </div>
      </form>
    </div>
  );
}
