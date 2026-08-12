import React from 'react';
import { fmt, fmtDate } from './UI';

export const numberToWords = (num) => {
  const a = [
    '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ',
    'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const numToWordsLessThanThousand = (n) => {
    let temp = '';
    if (n >= 100) {
      temp += a[Math.floor(n / 100)] + 'Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      temp += b[Math.floor(n / 10)] + ' ' + a[n % 10];
    } else if (n > 0) {
      temp += a[n];
    }
    return temp;
  };

  const convert = (n) => {
    n = Math.floor(n);
    if (n === 0) return 'Zero';
    
    let str = '';
    if (Math.floor(n / 10000000) > 0) {
      str += numToWordsLessThanThousand(Math.floor(n / 10000000)) + 'Crore ';
      n %= 10000000;
    }
    if (Math.floor(n / 100000) > 0) {
      str += numToWordsLessThanThousand(Math.floor(n / 100000)) + 'Lakh ';
      n %= 100000;
    }
    if (Math.floor(n / 1000) > 0) {
      str += numToWordsLessThanThousand(Math.floor(n / 1000)) + 'Thousand ';
      n %= 1000;
    }
    str += numToWordsLessThanThousand(n);
    return str.trim();
  };

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  let result = 'Rupees ' + convert(integerPart);
  if (decimalPart > 0) {
    result += ' and ' + convert(decimalPart) + ' Paise';
  }
  result += ' Only';
  return result;
};

export default function InvoiceTemplate({ invoice, settings = {}, isA5 = false }) {
  if (!invoice) return null;

  const {
    invoiceNo = 'OS-INV-2025-XXXXX',
    type = 'Tax Invoice',
    date = new Date(),
    dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    placeOfSupply = 'Tamil Nadu',
    customerName = 'Walk-in Customer',
    customerCompany = '',
    customerAddress = 'Not provided',
    customerGSTIN = '',
    customerPhone = '',
    customerEmail = '',
    shippingName = '',
    shippingAddress = '',
    shippingPhone = '',
    items = [],
    subtotal = 0,
    discount = 0,
    shipping = 0,
    paymentReceived = 0,
    paymentMethod = 'Cash',
    isInterstate = false,
  } = invoice;

  const totalTaxRate = 18;
  const taxableAmount = subtotal - discount;
  const taxAmount = parseFloat((taxableAmount * (totalTaxRate / 100)).toFixed(2));
  const cgstAmount = isInterstate ? 0 : parseFloat((taxAmount / 2).toFixed(2));
  const sgstAmount = isInterstate ? 0 : parseFloat((taxAmount / 2).toFixed(2));
  const igstAmount = isInterstate ? taxAmount : 0;
  
  const finalTotalRaw = taxableAmount + taxAmount + parseFloat(shipping || 0);
  const finalTotal = Math.round(finalTotalRaw);
  const roundOff = parseFloat((finalTotal - finalTotalRaw).toFixed(2));
  const balanceDue = finalTotal - paymentReceived;

  const companyName = settings.companyName || 'OLIVE SEEDS';
  const companyAddress = settings.companyAddress || 'Location : Dindigul';
  const companyGSTIN = settings.companyGSTIN || '33AAAAA1111A1Z1';
  const companyPhone = settings.companyPhone || 'Contact : +91 9442943394';
  const companyEmail = settings.companyEmail || 'Email: info@oliveseedsdesignstudio.com';
  const companyLogo = settings.companyLogo || '';

  const bankName = settings.bankName || 'HDFC Bank';
  const accountNo = settings.accountNo || '12345678901234';
  const ifscCode = settings.ifscCode || 'HDFC0001234';
  const upiId = settings.upiId || 'oliveseeds@upi';

  return (
    <div 
      className={`print-container ${isA5 ? 'a5-layout' : 'a4-layout'}`}
      style={{
        width: isA5 ? '148mm' : '210mm',
        minHeight: isA5 ? '210mm' : '297mm',
        padding: isA5 ? '10mm' : '15mm',
        backgroundColor: '#FFFFFF',
        color: '#000000',
        fontFamily: "Arial, sans-serif",
        lineHeight: 1.3,
        fontSize: isA5 ? '11px' : '13px',
        boxSizing: 'border-box',
        border: '1px solid #E5E7EB',
        position: 'relative'
      }}
    >
      <style>{`
        .invoice-table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
        .invoice-table th { background-color: #F9FAFB; border: 1px solid #D1D5DB; padding: 6px; font-weight: 700; text-align: left; }
        .invoice-table td { border: 1px solid #D1D5DB; padding: 6px; }
      `}</style>

      {/* 1. HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1.5px solid #1A1A2E', paddingBottom: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: isA5 ? '16px' : '22px', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>
              {companyName} <span style={{ fontWeight: 400, textTransform: 'none', fontSize: isA5 ? '12px' : '15px' }}>| Design Studio</span>
            </h1>
          </div>
          <p style={{ margin: 0 }}>{companyAddress}</p>
          <p style={{ margin: 0 }}>{companyPhone} | {companyEmail}</p>
          <p style={{ margin: 0 }}>Website: https://www.oliveseedsdesignstudio.com</p>
          <p style={{ margin: '4px 0 0 0', fontWeight: 700 }}>GSTIN: {companyGSTIN}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ fontSize: isA5 ? '18px' : '24px', fontWeight: 800, color: '#1A1A2E', textTransform: 'uppercase', margin: 0 }}>
            {type}
          </h2>
          <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: 'auto auto', gap: '4px 10px', textAlign: 'left' }}>
            <strong>Invoice No:</strong> <span>{invoiceNo}</span>
            <strong>Date:</strong> <span>{fmtDate(date)}</span>
            <strong>Due Date:</strong> <span>{fmtDate(dueDate)}</span>
            <strong>Place of Supply:</strong> <span>{placeOfSupply}</span>
          </div>
        </div>
      </div>

      {/* 2. CUSTOMER & SHIPPING INFORMATION */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '15px', borderBottom: '1px solid #D1D5DB', paddingBottom: '15px' }}>
        <div>
          <h3 style={{ fontSize: isA5 ? '11px' : '13px', textTransform: 'uppercase', margin: '0 0 6px 0', borderBottom: '0.5px solid #DDD', paddingBottom: '2px', fontWeight: 700 }}>
            BILL TO:
          </h3>
          <strong>{customerName}</strong>
          {customerCompany && <div>{customerCompany}</div>}
          <div>{customerAddress}</div>
          {customerPhone && <div>Phone: {customerPhone}</div>}
          {customerGSTIN && <div style={{ fontWeight: 600 }}>GSTIN: {customerGSTIN}</div>}
        </div>
        <div>
          <h3 style={{ fontSize: isA5 ? '11px' : '13px', textTransform: 'uppercase', margin: '0 0 6px 0', borderBottom: '0.5px solid #DDD', paddingBottom: '2px', fontWeight: 700 }}>
            SHIP TO:
          </h3>
          {shippingName ? (
            <>
              <strong>{shippingName}</strong>
              <div>{shippingAddress || customerAddress}</div>
              {shippingPhone && <div>Phone: {shippingPhone}</div>}
            </>
          ) : (
            <span style={{ color: '#6B7280', fontStyle: 'italic' }}>Same as Billing Address</span>
          )}
        </div>
      </div>

      {/* 3. ITEMS TABLE */}
      <table className="invoice-table">
        <thead>
          <tr>
            <th style={{ width: '40px', textAlign: 'center' }}>#</th>
            <th>Description</th>
            <th style={{ width: '80px' }}>HSN/SAC</th>
            <th style={{ width: '60px', textAlign: 'center' }}>Qty</th>
            <th style={{ width: '90px', textAlign: 'right' }}>Rate</th>
            <th style={{ width: '60px', textAlign: 'center' }}>Disc</th>
            <th style={{ width: '80px', textAlign: 'center' }}>Tax</th>
            <th style={{ width: '100px', textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx}>
              <td style={{ textAlign: 'center' }}>{idx + 1}</td>
              <td>
                <div style={{ fontWeight: 600 }}>{item.name || item.productName}</div>
                {item.sku && <div style={{ fontSize: '10px', color: '#6B7280' }}>SKU: {item.sku}</div>}
              </td>
              <td>{item.hsn || item.hsnCode || '392690'}</td>
              <td style={{ textAlign: 'center' }}>{item.qty || item.quantity}</td>
              <td style={{ textAlign: 'right' }}>{fmt(item.rate || item.price || item.unitPrice)}</td>
              <td style={{ textAlign: 'center' }}>{item.disc || item.discount || 0}%</td>
              <td style={{ textAlign: 'center' }}>GST {item.gstRate || item.gst || 18}%</td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                {fmt((item.qty || item.quantity) * (item.rate || item.price || item.unitPrice) * (1 - (item.disc || item.discount || 0) / 100))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 4. TOTALS SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '20px' }}>
        <div style={{ width: '55%' }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '11px' }}>
            <strong>Amount in Words:</strong><br />
            <span style={{ textTransform: 'capitalize', fontStyle: 'italic' }}>{numberToWords(finalTotal)}</span>
          </p>

          <div style={{ border: '1px solid #D1D5DB', borderRadius: '4px', padding: '8px', fontSize: '11px', marginTop: '12px' }}>
            <strong style={{ display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Bank Account Details</strong>
            <div>Bank: {bankName}</div>
            <div>A/C Number: {accountNo}</div>
            <div>IFSC Code: {ifscCode}</div>
            <div>UPI ID: {upiId}</div>
          </div>
        </div>

        <div style={{ width: '40%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 12px', textAlign: 'right', fontSize: isA5 ? '11px' : '13px' }}>
            <span>Subtotal:</span> <strong>{fmt(subtotal)}</strong>
            {discount > 0 && (
              <>
                <span>Discount:</span> <strong>- {fmt(discount)}</strong>
              </>
            )}
            {!isInterstate ? (
              <>
                <span>CGST (9%):</span> <strong>{fmt(cgstAmount)}</strong>
                <span>SGST (9%):</span> <strong>{fmt(sgstAmount)}</strong>
              </>
            ) : (
              <>
                <span>IGST (18%):</span> <strong>{fmt(igstAmount)}</strong>
              </>
            )}
            {shipping > 0 && (
              <>
                <span>Shipping:</span> <strong>{fmt(shipping)}</strong>
              </>
            )}
            {roundOff !== 0 && (
              <>
                <span>Round Off:</span> <strong>{roundOff > 0 ? `+` : ''}{fmt(roundOff)}</strong>
              </>
            )}
            <div style={{ gridColumn: '1 / span 2', borderBottom: '1px solid #1A1A2E', margin: '4px 0' }} />
            <span style={{ fontSize: isA5 ? '13px' : '15px', fontWeight: 800 }}>TOTAL:</span>
            <strong style={{ fontSize: isA5 ? '13px' : '15px', fontWeight: 800 }} className="num-mono">
              {fmt(finalTotal)}
            </strong>

            <span>Paid Amount:</span> <strong>{fmt(paymentReceived)}</strong>
            <span style={{ fontWeight: 700 }}>Balance Due:</span> 
            <strong style={{ color: balanceDue > 0 ? '#DC2626' : '#16A34A', fontWeight: 700 }} className="num-mono">
              {fmt(balanceDue)}
            </strong>
          </div>
        </div>
      </div>

      {/* QR payment block */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '20px', borderTop: '1px solid #D1D5DB', paddingTop: '10px' }}>
        <div style={{ fontSize: '11px' }}>
          <strong>TERMS & CONDITIONS:</strong>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            <li>Payment is due within 30 days.</li>
            <li>Subject to Dindigul jurisdiction.</li>
          </ul>
        </div>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=64x64&data=${encodeURIComponent(`upi://pay?pa=${upiId}&pn=${companyName}&am=${finalTotal}&cu=INR`)}`} 
              alt="UPI QR"
              style={{ width: '64px', height: '64px', border: '1px solid #E5E7EB', padding: '2px' }}
            />
            <div style={{ fontSize: '8px', color: '#6B7280', marginTop: '2px' }}>Scan to Pay</div>
          </div>

          <div style={{ width: '120px', textAlign: 'center' }}>
            <div style={{ height: '36px' }} />
            <div style={{ borderTop: '1px solid #000', fontSize: '10px', fontWeight: 600 }}>
              Authorized Signatory
            </div>
            <div style={{ fontSize: '9px', color: '#6B7280' }}>{companyName}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
