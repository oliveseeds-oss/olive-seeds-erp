// ── OPEN PRINT WINDOW ──────────────────────────────
export function openPrintWindow(htmlString) {
  setTimeout(() => {
    try {
      const printWindow = window.open(
        '',
        'print_' + Date.now(),
        'width=950,height=800,scrollbars=yes,resizable=yes'
      );
      if (!printWindow) {
        alert(
          'Popup blocked! Please allow popups for this site in your browser settings, then try again.'
        );
        return;
      }
      printWindow.document.open();
      printWindow.document.write(htmlString);
      printWindow.document.close();
      
      printWindow.onload = function() {
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          printWindow.close();
        }, 500);
      };
      // Fallback
      setTimeout(() => {
        if (printWindow && !printWindow.closed) {
          printWindow.focus();
          printWindow.print();
        }
      }, 1500);
    } catch (err) {
      console.error('Print window error:', err);
      alert('Print failed: ' + err.message);
    }
  }, 100);
}

// ── DOWNLOAD PDF BLOB ──────────────────────────────
export async function downloadPDFBlob(api, url, filename) {
  try {
    const res = await api.get(url, {
      responseType: 'blob',
      timeout: 60000
    });
    const contentType = res.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      const text = await res.data.text();
      let msg = 'PDF generation failed';
      try { msg = JSON.parse(text).error || msg; } catch {}
      throw new Error(msg);
    }
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename || 'document.pdf';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    }, 100);
    return true;
  } catch (err) {
    console.error('PDF download error:', err);
    throw err;
  }
}

// ── FETCH IMAGE AS BASE64 ─────────────────────────
export async function fetchAsBase64(api, url) {
  try {
    const res = await api.get(url, { responseType: 'blob' });
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(res.data);
    });
  } catch {
    return null;
  }
}

// ── ROBUST IMAGE TO BASE64 HELPER ──────────────────
export async function fetchImageAsBase64(api, pathOrUrl) {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith('data:')) return pathOrUrl;
  try {
    const apiBase = api.defaults.baseURL || '';
    const origin = apiBase.replace('/api', '') || window.location.origin.replace(':3002', ':5000').replace(':3000', ':5000');
    const fullUrl = pathOrUrl.startsWith('http') ? pathOrUrl : `${origin}${pathOrUrl}`;
    const response = await fetch(fullUrl);
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('Error in fetchImageAsBase64:', err);
    return null;
  }
}

// ── BUILD BILL HTML SAFELY ─────────────────────────
export function buildBillHTML(data, paperSize = 'A4', settings = {}, userSig = null, logoB64 = null) {
  if (!data) data = {};
  if (!settings) settings = {};
  
  const safe = (val, fallback = '') => {
    if (val === null || val === undefined) return fallback;
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const formatMoney = (n) => {
    const num = parseFloat(n) || 0;
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const billNumber = data.bill_number || data.billNumber || '';
  const billDate = data.bill_date || data.billDate || '';
  const billTime = data.bill_time || data.billTime || '';
  const billType = data.bill_type || data.billType || 'cash_memo';
  const customerName = data.customer_name || data.customerName || '';
  const customerPhone = data.customer_phone || data.customerPhone || '';
  const customerGstin = data.customer_gstin || data.customerGstin || '';
  const paymentMode = data.payment_mode || data.paymentMode || 'cash';
  const amountReceived = data.amount_received || data.amountReceived || 0;
  const changeAmount = data.change_amount || data.changeAmount || 0;
  const balanceDue = data.balance_due || data.balanceDue || 0;
  const staffName = data.staff_name || data.staffName || '';

  const companyName = settings.company_name || data.companyName || 'OLIVE SEEDS | Design Studio';
  const companyAddress = settings.address || data.companyAddress || '';
  const companyPhone = settings.phone || data.companyPhone || '+91 94 42 94 33 94';
  const companyEmail = settings.email || data.companyEmail || 'info@oliveseedsdesignstudio.com';
  const companyWebsite = settings.website || data.companyWebsite || 'www.oliveseedsdesignstudio.com';
  const companyGstin = settings.gstin || data.companyGstin || '';

  const bankName = settings.bank_name || data.bankName || '';
  const bankAccount = settings.bank_account || data.bankAccount || '';
  const bankIfsc = settings.bank_ifsc || data.bankIfsc || '';
  const upiId = settings.upi_id || data.upiId || '';

  const itemRows = (data.items || data.invoice_items || []).map((item, i) => `
    <tr>
      <td style="text-align: center; color: #718096;">${i + 1}</td>
      <td>
        <span style="font-weight: 600; color: #1a202c; display: block;">${safe(item.product_name)}</span>
        ${item.description ? `<span style="font-size: 8pt; color: #718096; display: block; margin-top: 1mm;">${safe(item.description)}</span>` : ''}
        ${item.personalization
          ? `<span style="font-size: 8pt; color: #4f46e5; display: block; margin-top: 1mm; font-style: italic;">Personalization: ${safe(item.personalization)}</span>`
          : ''}
      </td>
      <td style="text-align: center;">${safe(item.size, '—')}</td>
      <td style="text-align: center; font-weight: 600; color: #2d3748;">${safe(item.quantity)}</td>
      <td style="text-align: right; color: #2d3748;">${formatMoney(item.unit_price || item.rate)}</td>
      <td style="text-align: right; color: #718096;">
        ${parseFloat(item.discount_percent || item.discountPercent) > 0 ? (item.discount_percent || item.discountPercent) + '%' : '—'}
      </td>
      <td style="text-align: right; font-weight: 700; color: #1a202c;">
        ₹ ${formatMoney(item.amount || item.total)}
      </td>
    </tr>
  `).join('');

  const taxRows = [];
  const gstAmount = parseFloat(data.gst_amount || data.gstAmount || 0);
  if (gstAmount > 0) {
    taxRows.push(`
      <tr>
        <td style="color: #4a5568; font-weight: 500;">GST (${data.gst_percent || 18}%)</td>
        <td style="text-align: right; font-weight: 600; color: #2d3748;">
          ₹ ${formatMoney(gstAmount)}
        </td>
      </tr>
    `);
  }
  const cgst = parseFloat(data.cgst || 0);
  const sgst = parseFloat(data.sgst || 0);
  if (cgst > 0) {
    taxRows.push(`
      <tr>
        <td style="color: #4a5568; font-weight: 500;">CGST</td>
        <td style="text-align: right; color: #2d3748;">₹ ${formatMoney(cgst)}</td>
      </tr>
      <tr>
        <td style="color: #4a5568; font-weight: 500;">SGST</td>
        <td style="text-align: right; color: #2d3748;">₹ ${formatMoney(sgst)}</td>
      </tr>
    `);
  }
  const igst = parseFloat(data.igst || 0);
  if (igst > 0) {
    taxRows.push(`
      <tr>
        <td style="color: #4a5568; font-weight: 500;">IGST</td>
        <td style="text-align: right; color: #2d3748;">₹ ${formatMoney(igst)}</td>
      </tr>
    `);
  }

  const finalLogo = logoB64 || data.logoBase64 || settings.logo_path;
  const logoHTML = finalLogo
    ? `<img src="${finalLogo}"
        alt="OLIVE SEEDS | Design Studio"
        style="max-height: 60px; max-width: 240px; object-fit: contain; display: block;">`
    : `<div style="font-size: 16pt; font-weight: 800; color: #1a1a3a; letter-spacing: 0.5px;">
        OLIVE SEEDS | Design Studio
       </div>`;

  const finalSig = userSig || data.signatureBase64 || settings.default_signature_path;
  const signatureHTML = finalSig
    ? `<img src="${finalSig}" style="max-height: 55px; max-width: 170px; object-fit: contain; display: block; margin: 0 auto;">`
    : `<div style="height: 45px;"></div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${safe(billNumber)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      font-size: 9.5pt;
      color: #2d3748;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      line-height: 1.5;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 16mm 14mm;
      margin: 0 auto;
      background: #ffffff;
      display: flex;
      flex-direction: column;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #1a202c;
      padding-bottom: 4mm;
      margin-bottom: 5mm;
    }
    .doc-title-container {
      text-align: right;
    }
    .doc-title {
      font-size: 18pt;
      font-weight: 800;
      color: #1a202c;
      letter-spacing: -0.5px;
      margin-bottom: 2mm;
    }
    .meta-table {
      border-collapse: collapse;
      margin-left: auto;
    }
    .meta-table td {
      font-size: 8.5pt;
      padding: 0.8mm 0 0.8mm 3mm;
      color: #4a5568;
    }
    .meta-table td:first-child {
      color: #718096;
      font-weight: 500;
      padding-right: 2mm;
    }
    .meta-table td:last-child {
      font-weight: 700;
      color: #1a202c;
    }
    .addresses-container {
      display: flex;
      gap: 10mm;
      margin-bottom: 5mm;
    }
    .address-box {
      flex: 1;
      padding: 2mm 0;
    }
    .address-title {
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #718096;
      margin-bottom: 1.5mm;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 0.8mm;
    }
    .address-name {
      font-size: 10.5pt;
      font-weight: 700;
      color: #1a202c;
      margin-bottom: 1mm;
    }
    .address-details {
      font-size: 8.5pt;
      color: #4a5568;
      line-height: 1.5;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 5mm;
    }
    .items-table thead tr {
      background: #1a202c;
    }
    .items-table thead th {
      color: #ffffff;
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 1.2mm 2.5mm;
      text-align: left;
      border: none;
    }
    .items-table tbody tr {
      border-bottom: 1px solid #edf2f7;
    }
    .items-table tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    .items-table tbody td {
      padding: 1.5mm 2.5mm;
      font-size: 9pt;
      color: #2d3748;
      vertical-align: middle;
    }
    .summary-payment-container {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10mm;
      margin-bottom: 5mm;
      border-top: 2px solid #1a202c;
      padding-top: 4mm;
    }
    .payment-box {
      flex: 1.2;
    }
    .payment-title {
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #718096;
      margin-bottom: 1.5mm;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 0.8mm;
    }
    .payment-table {
      width: 100%;
      border-collapse: collapse;
    }
    .payment-table td {
      font-size: 8.5pt;
      padding: 1mm 0;
      color: #4a5568;
    }
    .payment-table td:first-child {
      color: #718096;
      width: 25mm;
    }
    .payment-table td:last-child {
      font-weight: 600;
      color: #1a202c;
    }
    .totals-box {
      width: 76mm;
      min-width: 76mm;
    }
    .totals-table {
      width: 100%;
      border-collapse: collapse;
    }
    .totals-table td {
      padding: 1.8mm 2mm;
      font-size: 9pt;
    }
    .totals-table td:first-child {
      color: #718096;
      font-weight: 500;
    }
    .totals-table td:last-child {
      text-align: right;
      font-weight: 600;
      color: #1a202c;
    }
    .grand-total-row td {
      font-size: 11pt !important;
      font-weight: 800 !important;
      color: #1a202c !important;
      background: #f7fafc !important;
      border-top: 2px solid #1a202c !important;
      border-bottom: 2px solid #1a202c !important;
      padding: 2.2mm 2mm !important;
    }
    .amt-words {
      font-size: 8pt;
      color: #718096;
      font-style: italic;
      margin-top: 2.5mm;
      line-height: 1.3;
      text-align: right;
      padding-right: 2mm;
    }
    .receipt-status-container {
      margin-top: 2.5mm;
      display: flex;
      flex-direction: column;
      gap: 1.2mm;
    }
    .status-badge-paid {
      display: flex;
      justify-content: space-between;
      padding: 1.8mm 2.5mm;
      background: #e6fffa;
      border: 1px solid #b2f5ea;
      border-radius: 4px;
      font-size: 8.5pt;
      color: #006b5f;
      font-weight: 700;
    }
    .status-badge-due {
      display: flex;
      justify-content: space-between;
      padding: 1.8mm 2.5mm;
      background: #fff5f5;
      border: 1px solid #fed7d7;
      border-radius: 4px;
      font-size: 8.5pt;
      color: #9b2c2c;
      font-weight: 700;
    }
    .sig-container {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 5mm;
      margin-top: auto;
    }
    .sig-box {
      width: 60mm;
      text-align: center;
    }
    .sig-line {
      border-bottom: 1px solid #cbd5e0;
      padding-bottom: 1.5mm;
      margin-bottom: 1.5mm;
    }
    .sig-label {
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #4a5568;
    }
    .sig-staff {
      font-size: 7.5pt;
      color: #718096;
      margin-top: 0.8mm;
    }
    .footer {
      border-top: 1px solid #edf2f7;
      padding-top: 3.5mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7.5pt;
      color: #718096;
    }
    .footer-left {
      line-height: 1.5;
    }
    .footer-center {
      text-align: center;
      font-style: italic;
    }
    .footer-right {
      text-align: right;
      line-height: 1.5;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { width: 100%; padding: 10mm 10mm; min-height: 100vh; }
      @page { size: A4; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- HEADER -->
    <div class="header">
      <div>${logoHTML}</div>
      <div class="doc-title-container">
        <div class="doc-title">
          ${safe(billType === 'gst_invoice' ? 'TAX INVOICE' : 'CASH MEMO')}
        </div>
        <table class="meta-table">
          <tr><td>Invoice No</td><td>${safe(billNumber)}</td></tr>
          <tr><td>Date</td><td>${safe(billDate)}</td></tr>
          <tr><td>Time</td><td>${safe(billTime)}</td></tr>
          ${companyGstin && billType === 'gst_invoice'
            ? `<tr><td>GSTIN</td><td>${safe(companyGstin)}</td></tr>`
            : ''}
        </table>
      </div>
    </div>

    <!-- ADDRESSES -->
    <div class="addresses-container">
      <div class="address-box">
        <div class="address-title">Bill To</div>
        <div class="address-name">
          ${safe(customerName, 'Walk-in Customer')}
        </div>
        <div class="address-details">
          ${customerPhone ? `<span>Phone:</span> ${safe(customerPhone)}<br>` : ''}
          ${customerGstin && billType === 'gst_invoice'
            ? `<span>GSTIN:</span> ${safe(customerGstin)}`
            : ''}
        </div>
      </div>
      <div class="address-box">
        <div class="address-title">From</div>
        <div class="address-name">
          ${safe(companyName, 'OLIVE SEEDS | Design Studio')}
        </div>
        <div class="address-details">
          ${safe(companyAddress)}<br>
          <span>Phone:</span> ${safe(companyPhone)}
        </div>
      </div>
    </div>

    <!-- TABLE -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 5%; text-align: center;">#</th>
          <th style="width: 45%;">Item &amp; Description</th>
          <th style="width: 10%; text-align: center;">Size</th>
          <th style="width: 8%; text-align: center;">Qty</th>
          <th style="width: 12%; text-align: right;">Rate (₹)</th>
          <th style="width: 8%; text-align: right;">Disc%</th>
          <th style="width: 12%; text-align: right;">Total (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <!-- BOTTOM ROW -->
    <div class="summary-payment-container">
      <div class="payment-box">
        <div class="payment-title">Payment Details</div>
        <table class="payment-table">
          <tr><td>Method</td><td style="text-transform: uppercase;">${safe(paymentMode)}</td></tr>
          ${bankName ? `<tr><td>Bank</td><td>${safe(bankName)}</td></tr>` : ''}
          ${bankAccount ? `<tr><td>Account No</td><td>${safe(bankAccount)}</td></tr>` : ''}
          ${bankIfsc ? `<tr><td>IFSC Code</td><td>${safe(bankIfsc)}</td></tr>` : ''}
          ${upiId ? `<tr><td>UPI ID</td><td>${safe(upiId)}</td></tr>` : ''}
        </table>
      </div>
      
      <div class="totals-box">
        <table class="totals-table">
          <tr>
            <td>Subtotal</td>
            <td>₹ ${formatMoney(data.subtotal)}</td>
          </tr>
          ${taxRows.join('')}
          ${parseFloat(data.discount) > 0 ? `
          <tr>
            <td>Discount</td>
            <td>— ₹ ${formatMoney(data.discount)}</td>
          </tr>` : ''}
          <tr class="grand-total-row">
            <td>GRAND TOTAL</td>
            <td>₹ ${formatMoney(data.total)}</td>
          </tr>
        </table>
        <div class="amt-words">
          ${amountToWordsIndian(parseFloat(data.total) || 0)}
        </div>
        
        <div class="receipt-status-container">
          ${parseFloat(amountReceived) > 0 ? `
          <div class="status-badge-paid">
            <span>Amount Received</span>
            <span>₹ ${formatMoney(amountReceived)}</span>
          </div>` : ''}
          ${parseFloat(changeAmount) > 0 ? `
          <div class="status-badge-paid" style="background: #ebf8ff; border-color: #bee3f8; color: #2b6cb0;">
            <span>Change Returned</span>
            <span>₹ ${formatMoney(changeAmount)}</span>
          </div>` : ''}
          ${parseFloat(balanceDue) > 0 ? `
          <div class="status-badge-due">
            <span>Balance Due</span>
            <span>₹ ${formatMoney(balanceDue)}</span>
          </div>` : ''}
        </div>
      </div>
    </div>

    <!-- SIGNATURE -->
    <div class="sig-container">
      <div class="sig-box">
        <div class="sig-line">
          ${signatureHTML}
        </div>
        <div class="sig-label">Authorized Signatory</div>
        <div class="sig-staff">${safe(staffName)}</div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <div class="footer-left">
        <strong>OLIVE SEEDS | Design Studio</strong><br>
        ${safe(companyEmail)}
      </div>
      <div class="footer-center">
        Thank you for your business!<br>
        This is a computer-generated invoice.
      </div>
      <div class="footer-right">
        <span>Web:</span> ${safe(companyWebsite)}<br>
        <span>Ph:</span> ${safe(companyPhone)}
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── BUILD QUOTATION HTML ─────────────────────────────
export function buildQuotationHTML(data, settings = {}, staffObj = {}, logoB64 = null, sigB64 = null) {
  if (!data) data = {};
  if (!settings) settings = {};
  if (!staffObj) staffObj = {};
  
  const safe = (v, d = '') => String(v || d)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    
  const fmt = (n) => (parseFloat(n) || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });

  const quotationNumber = data.quotation_number || data.quotationNumber || '';
  const quotationDate = data.quotation_date || data.quotationDate || '';
  const validUntil = data.valid_until || data.validUntil || '';
  const customerName = data.customer_name || data.customerName || '';
  const customerPhone = data.customer_phone || data.customerPhone || '';
  const customerCompany = data.customer_company || data.customerCompany || '';
  const billingAddress = data.billing_address || data.billingAddress || '';
  const billingCity = data.billing_city || data.billingCity || '';
  const billingState = data.billing_state || data.billingState || '';
  const billingPincode = data.billing_pincode || data.billingPincode || '';
  const staffName = staffObj.name || data.staffName || '';

  const companyName = settings.company_name || data.companyName || 'OLIVE SEEDS | Design Studio';
  const companyPhone = settings.phone || data.companyPhone || '+91 94 42 94 33 94';
  const companyEmail = settings.email || data.companyEmail || 'info@oliveseedsdesignstudio.com';
  const companyWebsite = settings.website || data.companyWebsite || 'www.oliveseedsdesignstudio.com';

  const finalLogo = logoB64 || data.logoBase64 || settings.logo_path;
  const logoHTML = finalLogo
    ? `<img src="${finalLogo}"
        alt="OLIVE SEEDS | Design Studio"
        style="max-height: 60px; max-width: 240px; object-fit: contain; display: block;">`
    : `<div style="font-size: 16pt; font-weight: 800; color: #1a1a3a; letter-spacing: 0.5px;">
        OLIVE SEEDS | Design Studio
       </div>`;

  const finalSig = sigB64 || data.signatureBase64 || settings.default_signature_path;
  const signatureHTML = finalSig
    ? `<img src="${finalSig}" style="max-height: 55px; max-width: 170px; object-fit: contain; display: block; margin: 0 auto;">`
    : `<div style="height: 45px;"></div>`;

  const itemRows = (data.items || []).map((item, i) => {
    const pName = item.product_name || item.productName || item.name || '';
    const pDesc = item.description || '';
    const pSize = item.size || '';
    const pQty = item.quantity || 0;
    const pUnit = item.unit || 'pcs';
    const pRate = item.unit_price || item.unitPrice || item.rate || 0;
    const pDisc = item.discount_percent || item.discountPercent || 0;
    const pAmt = item.total || item.amount || 0;

    return `
    <tr>
      <td style="text-align: center; color: #718096;">${i + 1}</td>
      <td>
        <span style="font-weight: 600; color: #1a202c; display: block;">${safe(pName)}</span>
        ${pDesc ? `<span style="font-size: 8pt; color: #718096; display: block; margin-top: 1mm;">${safe(pDesc)}</span>` : ''}
      </td>
      <td style="text-align: center;">${safe(pSize, '—')}</td>
      <td style="text-align: center; font-weight: 600; color: #2d3748;">${safe(pQty)}</td>
      <td style="text-align: center; color: #4a5568;">${safe(pUnit)}</td>
      <td style="text-align: right; color: #2d3748;">₹ ${fmt(pRate)}</td>
      <td style="text-align: right; color: #718096;">
        ${parseFloat(pDisc) > 0 ? pDisc + '%' : '—'}
      </td>
      <td style="text-align: right; font-weight: 700; color: #1a202c;">
        ₹ ${fmt(pAmt)}
      </td>
    </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Quotation ${safe(quotationNumber)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      font-size: 9.5pt;
      color: #2d3748;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      line-height: 1.5;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 16mm 14mm;
      margin: 0 auto;
      background: #ffffff;
      display: flex;
      flex-direction: column;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #1a202c;
      padding-bottom: 4mm;
      margin-bottom: 5mm;
    }
    .company-details {
      line-height: 1.6;
    }
    .company-name {
      font-size: 13pt;
      font-weight: 800;
      color: #1a202c;
      letter-spacing: -0.2px;
      margin-bottom: 2mm;
    }
    .company-contact {
      font-size: 8.5pt;
      color: #4a5568;
    }
    .logo-container {
      text-align: right;
    }
    .doc-title-bar {
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3.5mm;
      margin-bottom: 5mm;
      text-align: center;
    }
    .doc-title {
      font-size: 14pt;
      font-weight: 700;
      color: #1a202c;
      letter-spacing: 0.2px;
    }
    .details-container {
      display: flex;
      justify-content: space-between;
      gap: 10mm;
      margin-bottom: 5mm;
    }
    .client-box {
      flex: 1.2;
      padding: 2mm 0;
    }
    .section-title {
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #718096;
      margin-bottom: 1.5mm;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 0.8mm;
    }
    .client-name {
      font-size: 10.5pt;
      font-weight: 700;
      color: #1a202c;
      margin-bottom: 1mm;
    }
    .client-details {
      font-size: 8.5pt;
      color: #4a5568;
      line-height: 1.5;
    }
    .quote-meta-box {
      flex: 0.8;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      text-align: right;
    }
    .meta-row {
      display: flex;
      margin-bottom: 1.5mm;
      font-size: 8.5pt;
    }
    .meta-lbl {
      color: #718096;
      font-weight: 500;
      margin-right: 3mm;
    }
    .meta-val {
      font-weight: 700;
      color: #1a202c;
      min-width: 32mm;
      text-align: right;
    }
    .valid-badge {
      display: inline-block;
      margin-top: 2.5mm;
      padding: 1.5mm 3.5mm;
      background: #fefaf0;
      border: 1px solid #fbd38d;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: 700;
      color: #dd6b20;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 5mm;
    }
    .items-table thead tr {
      background: #1a202c;
    }
    .items-table thead th {
      color: #ffffff;
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 1.2mm 2.5mm;
      text-align: left;
    }
    .items-table tbody tr {
      border-bottom: 1px solid #edf2f7;
    }
    .items-table tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    .items-table tbody td {
      padding: 1.5mm 2.5mm;
      font-size: 9pt;
      color: #2d3748;
      vertical-align: middle;
    }
    .summary-container {
      display: flex;
      justify-content: flex-end;
      border-top: 2px solid #1a202c;
      padding-top: 4mm;
      margin-bottom: 5mm;
    }
    .totals-box {
      width: 76mm;
    }
    .totals-table {
      width: 100%;
      border-collapse: collapse;
    }
    .totals-table td {
      padding: 1.8mm 2mm;
      font-size: 9pt;
    }
    .totals-table td:first-child {
      color: #718096;
      font-weight: 500;
    }
    .totals-table td:last-child {
      text-align: right;
      font-weight: 600;
      color: #1a202c;
    }
    .grand-row td {
      font-size: 11pt !important;
      font-weight: 800 !important;
      color: #1a202c !important;
      background: #f7fafc !important;
      border-top: 2px solid #1a202c !important;
      border-bottom: 2px solid #1a202c !important;
      padding: 2.2mm 2mm !important;
    }
    .amt-words-box {
      font-size: 8pt;
      color: #718096;
      font-style: italic;
      text-align: right;
      padding-right: 2mm;
      margin-bottom: 4mm;
    }
    .terms-box {
      padding: 2mm 0;
      margin-bottom: 5mm;
    }
    .terms-title {
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #718096;
      margin-bottom: 1.5mm;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 0.8mm;
    }
    .terms-content {
      font-size: 8.5pt;
      color: #4a5568;
      line-height: 1.5;
    }
    .sig-container {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 5mm;
      margin-top: auto;
    }
    .sig-box {
      width: 60mm;
      text-align: center;
    }
    .sig-line {
      border-bottom: 1px solid #cbd5e0;
      padding-bottom: 1.5mm;
      margin-bottom: 1.5mm;
    }
    .sig-label {
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #4a5568;
    }
    .sig-staff {
      font-size: 7.5pt;
      color: #718096;
      margin-top: 0.8mm;
    }
    .bottom-strip {
      border-top: 1px solid #edf2f7;
      padding-top: 3.5mm;
      text-align: center;
      font-size: 7.5pt;
      color: #718096;
      line-height: 1.5;
    }
    .bottom-strip strong {
      color: #2d3748;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { width: 100%; padding: 10mm 10mm; min-height: 100vh; }
      @page { size: A4; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- HEADER -->
    <div class="header">
      <div class="company-details">
        <div class="company-name">
          OLIVE SEEDS | Design Studio
        </div>
        <div class="company-contact">
          <span>Web:</span> ${safe(companyWebsite)}<br>
          <span>Email:</span> ${safe(companyEmail)}<br>
          <span>Phone:</span> ${safe(companyPhone)}
        </div>
      </div>
      <div class="logo-container">
        ${logoHTML}
      </div>
    </div>

    <!-- DOCUMENT TITLE -->
    <div class="doc-title-bar">
      <div class="doc-title">
        ${safe(data.documentTitle || data.quotation_title || data.quotationTitle || 'Quotation')}
      </div>
    </div>

    <!-- DETAILS -->
    <div class="details-container">
      <div class="client-box">
        <div class="section-title">Quotation To</div>
        <div class="client-name">${safe(customerName)}</div>
        <div class="client-details">
          ${customerCompany ? `<strong>${safe(customerCompany)}</strong><br>` : ''}
          ${safe(billingAddress)}<br>
          ${safe(billingCity)}${billingCity && billingState ? ', ' : ''}${safe(billingState)}${billingPincode ? ' - ' + safe(billingPincode) : ''}
          ${customerPhone ? `<br><span>Phone:</span> ${safe(customerPhone)}` : ''}
        </div>
      </div>
      
      <div class="quote-meta-box">
        <div class="meta-row">
          <span class="meta-lbl">Quotation No:</span>
          <span class="meta-val">${safe(quotationNumber)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-lbl">Date:</span>
          <span class="meta-val">${safe(quotationDate)}</span>
        </div>
        ${validUntil ? `
        <div>
          <span class="valid-badge">
            Valid Until: ${safe(validUntil)}
          </span>
        </div>` : ''}
      </div>
    </div>

    <!-- TABLE -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 5%; text-align: center;">#</th>
          <th style="width: 43%;">Item &amp; Description</th>
          <th style="width: 10%; text-align: center;">Size</th>
          <th style="width: 8%; text-align: center;">Qty</th>
          <th style="width: 8%; text-align: center;">Unit</th>
          <th style="width: 13%; text-align: right;">Rate (₹)</th>
          <th style="width: 8%; text-align: right;">Disc%</th>
          <th style="width: 13%; text-align: right;">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows || `
          <tr>
            <td colspan="8" style="padding: 8mm; text-align: center; color: #a0aec0;">
              No items added
            </td>
          </tr>`}
      </tbody>
    </table>

    <!-- TOTALS -->
    <div class="summary-container">
      <div class="totals-box">
        <table class="totals-table">
          <tr>
            <td>Subtotal</td>
            <td>₹ ${fmt(data.subtotal)}</td>
          </tr>
          ${parseFloat(data.discount) > 0 ? `
          <tr>
            <td>Discount</td>
            <td>— ₹ ${fmt(data.discount)}</td>
          </tr>` : ''}
          ${parseFloat(data.cgst) > 0 ? `
          <tr>
            <td>CGST</td>
            <td>₹ ${fmt(data.cgst)}</td>
          </tr>
          <tr>
            <td>SGST</td>
            <td>₹ ${fmt(data.sgst)}</td>
          </tr>` : ''}
          ${parseFloat(data.igst) > 0 ? `
          <tr>
            <td>IGST</td>
            <td>₹ ${fmt(data.igst)}</td>
          </tr>` : ''}
          ${parseFloat(data.shipping_estimate || data.shippingEstimate) > 0 ? `
          <tr>
            <td>Shipping Estimate</td>
            <td>₹ ${fmt(data.shipping_estimate || data.shippingEstimate)}</td>
          </tr>` : ''}
          <tr class="grand-row">
            <td>EST. TOTAL</td>
            <td>₹ ${fmt(data.total)}</td>
          </tr>
        </table>
      </div>
    </div>
    
    <div class="amt-words-box">
      ${amountToWordsIndian(parseFloat(data.total) || 0)}
    </div>

    <!-- TERMS -->
    ${data.terms || data.notes ? `
    <div class="terms-box">
      <div class="terms-title">Terms &amp; Conditions</div>
      <div class="terms-content">
        ${safe(data.terms || data.notes).replace(/\n/g, '<br>')}
      </div>
    </div>` : ''}

    <!-- SIGNATURE -->
    <div class="sig-container">
      <div class="sig-box">
        <div class="sig-line">
          ${signatureHTML}
        </div>
        <div class="sig-label">Authorized Signatory</div>
        <div class="sig-staff">${safe(staffName)}</div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="bottom-strip">
      If you have any questions concerning this quotation, please contact 
      <strong>${safe(companyPhone)}</strong> or 
      <strong>${safe(companyEmail)}</strong><br>
      Thank you for your business!
    </div>
  </div>
</body>
</html>`;
}

// Indian number to words
export function amountToWordsIndian(amount) {
  const n = Math.floor(amount);
  const ones = ['','One','Two','Three','Four','Five','Six','Seven',
    'Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen',
    'Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty',
    'Sixty','Seventy','Eighty','Ninety'];

  function conv(n) {
    if (n === 0) return '';
    if (n < 20) return ones[n] + ' ';
    if (n < 100) return tens[Math.floor(n/10)] + ' ' + ones[n%10] + ' ';
    if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred ' + conv(n%100);
    if (n < 100000) return conv(Math.floor(n/1000)) + 'Thousand ' + conv(n%1000);
    if (n < 10000000) return conv(Math.floor(n/100000)) + 'Lakh ' + conv(n%100000);
    return conv(Math.floor(n/10000000)) + 'Crore ' + conv(n%10000000);
  }

  const w = conv(n).trim() || 'Zero';
  return 'Rupees ' + w + ' Only';
}
