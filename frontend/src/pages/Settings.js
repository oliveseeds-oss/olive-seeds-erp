import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Card, PageHeader, Btn, Grid, Input, Textarea, Spinner } from '../components/UI';

export default function Settings() {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings').then(r => { setForm(r.data || {}); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try { await api.put('/settings', form); toast.success('Settings saved ✅'); }
    catch (e) { toast.error('Error saving settings'); }
    setSaving(false);
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="⚙️ Settings" subtitle="Company and system configuration"
        actions={<Btn onClick={save} disabled={saving}>{saving ? 'Saving...' : '💾 Save Settings'}</Btn>} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--primary)' }}>🏢 Company Information</h3>
          <Grid cols={2} gap={12}>
            <Input label="Company Name" value={form.company_name || ''} onChange={e => sf('company_name', e.target.value)} />
            <Input label="GSTIN" value={form.gstin || ''} onChange={e => sf('gstin', e.target.value)} />
            <Input label="PAN" value={form.pan || ''} onChange={e => sf('pan', e.target.value)} />
            <Input label="IEC (Export Code)" value={form.iec || ''} onChange={e => sf('iec', e.target.value)} />
            <Input label="Email" type="email" value={form.email || ''} onChange={e => sf('email', e.target.value)} />
            <Input label="Phone" value={form.phone || ''} onChange={e => sf('phone', e.target.value)} />
            <Input label="City" value={form.city || ''} onChange={e => sf('city', e.target.value)} />
            <Input label="State" value={form.state || ''} onChange={e => sf('state', e.target.value)} />
            <Input label="Pincode" value={form.pincode || ''} onChange={e => sf('pincode', e.target.value)} />
            <Input label="Country" value={form.country || 'India'} onChange={e => sf('country', e.target.value)} />
            <div style={{ gridColumn: 'span 2' }}>
              <Textarea label="Full Address" value={form.address || ''} onChange={e => sf('address', e.target.value)} />
            </div>
          </Grid>
        </Card>

        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--primary)' }}>🧾 Invoice Settings</h3>
          <Grid cols={3} gap={12}>
            <Input label="Invoice Prefix" value={form.invoice_prefix || 'OS'} onChange={e => sf('invoice_prefix', e.target.value)} placeholder="OS" />
            <Input label="Currency" value={form.currency || 'INR'} onChange={e => sf('currency', e.target.value)} />
          </Grid>
          <div style={{ marginTop: 12 }}>
            <Textarea label="Terms & Conditions" value={form.terms_conditions || ''} onChange={e => sf('terms_conditions', e.target.value)} />
          </div>
          <div style={{ marginTop: 12 }}>
            <Textarea label="Invoice Footer Note" value={form.invoice_footer || ''} onChange={e => sf('invoice_footer', e.target.value)} style={{ minHeight: 60 }} />
          </div>
        </Card>

        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--primary)' }}>🏦 Bank Details</h3>
          <Grid cols={2} gap={12}>
            <Input label="Bank Name" value={form.bank_name || ''} onChange={e => sf('bank_name', e.target.value)} />
            <Input label="Account Number" value={form.bank_account || ''} onChange={e => sf('bank_account', e.target.value)} />
            <Input label="IFSC Code" value={form.bank_ifsc || ''} onChange={e => sf('bank_ifsc', e.target.value)} />
            <Input label="Branch" value={form.bank_branch || ''} onChange={e => sf('bank_branch', e.target.value)} />
            <Input label="UPI ID" value={form.upi_id || ''} onChange={e => sf('upi_id', e.target.value)} placeholder="yourname@upi" />
          </Grid>
        </Card>

        <Card style={{ background: '#fffbeb', border: '1px solid #fcd34d' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: '#92400e' }}>🔐 Default Login Credentials</h3>
          <div style={{ fontSize: 13, color: '#78350f', lineHeight: 2 }}>
            <p>👑 <strong>Admin:</strong> admin@oliveseeds.com — Full access (create, read, update, delete)</p>
            <p>👨‍💼 <strong>Employee:</strong> employee@oliveseeds.com — Can create new entries only. Cannot edit/delete. Must submit change requests to admin.</p>
            <p>👁️ <strong>Viewer:</strong> viewer@oliveseeds.com — Read-only. Cannot create, edit, or delete anything.</p>
            <p style={{ marginTop: 8, color: '#dc2626', fontWeight: 700 }}>⚠️ Change all passwords immediately after first login!</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
