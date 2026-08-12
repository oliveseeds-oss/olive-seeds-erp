import React from 'react';
import { fmt, fmtDate } from './UI';

export default function ThermalTemplate({ invoice, settings = {}, is58mm = false }) {
  if (!invoice) return null;

  const {
    invoiceNo = 'OS-INV-2025-XXXXX',
    date = new Date(),
    customerName = 'Walk-in Customer',
    items = [],
    subtotal = 0,
    discount = 0,
    shipping = 0,
    paymentReceived = 0,
    paymentMethod = 'Cash'
  } = invoice;

  const companyName = settings.companyName || 'OLIVE SEEDS';
  const companyAddress = settings.companyAddress || 'Location : Dindigul';
  const companyGSTIN = settings.companyGSTIN || '33AAAAA1111A1Z1';
  const companyPhone = settings.companyPhone || 'Contact : +91 9442943394';
  const companyEmail = settings.companyEmail || 'Email: info@oliveseedsdesignstudio.com';
  const upiId = settings.upiId || 'oliveseeds@upi';

  // Calculate totals
  const totalTaxRate = 18;
  const taxableAmount = subtotal - discount;
  const taxAmount = Math.round(taxableAmount * (totalTaxRate / 100));
  const finalTotal = Math.round(taxableAmount + taxAmount + parseFloat(shipping || 0));
  const balanceDue = finalTotal - paymentReceived;

  const divider = is58mm ? '- - - - - - - - - -' : '- - - - - - - - - - - - - -';

  return (
    <div 
      className={is58mm ? 'thermal-58' : 'thermal-80'}
      style={{
        width: is58mm ? '58mm' : '80mm',
        padding: is58mm ? '1mm' : '2mm',
        backgroundColor: '#FFFFFF',
        color: '#000000',
        fontFamily: "Arial, sans-serif",
        fontSize: is58mm ? '8pt' : '9pt',
        lineHeight: 1.2,
        boxSizing: 'border-box'
      }}
    >
      <style>{`
        .thermal-center { text-align: center; }
        .thermal-bold { font-weight: bold; }
        .thermal-right { text-align: right; }
        .thermal-table { width: 100%; border-collapse: collapse; }
        .thermal-table td { padding: 2px 0; vertical-align: top; }
      `}</style>

      {/* Company Header */}
      <div className="thermal-center">
        <div className="thermal-bold" style={{ fontSize: is58mm ? '11pt' : '14pt' }}>
          {companyName} | Design Studio
        </div>
        <div>{companyAddress}</div>
        <div>{companyPhone}</div>
        <div>{companyEmail}</div>
        <div>Website: https://www.oliveseedsdesignstudio.com</div>
        <div className="thermal-bold" style={{ marginTop: '2px' }}>
          GSTIN: {companyGSTIN}
        </div>
      </div>

      <div className="thermal-center">{divider}</div>

      {/* Invoice Meta */}
      <div>
        <div>INV NO: <span className="thermal-bold">{invoiceNo}</span></div>
        <div>DATE  : {fmtDate(date)}</div>
        <div>CUST  : {customerName}</div>
      </div>

      <div className="thermal-center">{divider}</div>

      {/* Items Table */}
      <table className="thermal-table">
        <tbody>
          {items.map((item, idx) => (
            <React.Fragment key={idx}>
              <tr>
                <td className="thermal-bold" style={{ textAlign: 'left' }}>
                  {item.name || item.productName}
                </td>
                <td className="thermal-right thermal-bold">
                  {fmt((item.qty || item.quantity) * (item.rate || item.price || item.unitPrice) * (1 - (item.disc || item.discount || 0) / 100))}
                </td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>

      <div className="thermal-center">{divider}</div>

      {/* Summary Totals */}
      <table className="thermal-table">
        <tbody>
          <tr>
            <td>Subtotal:</td>
            <td className="thermal-right">{fmt(subtotal)}</td>
          </tr>
          {discount > 0 && (
            <tr>
              <td>Discount:</td>
              <td className="thermal-right">-{fmt(discount)}</td>
            </tr>
          )}
          <tr>
            <td>GST (18%):</td>
            <td className="thermal-right">{fmt(taxAmount)}</td>
          </tr>
          {shipping > 0 && (
            <tr>
              <td>Shipping:</td>
              <td className="thermal-right">{fmt(shipping)}</td>
            </tr>
          )}
          <tr className="thermal-bold" style={{ fontSize: is58mm ? '10pt' : '12pt' }}>
            <td>TOTAL:</td>
            <td className="thermal-right">{fmt(finalTotal)}</td>
          </tr>
          <tr>
            <td colSpan="2" className="thermal-center">{divider}</td>
          </tr>
          <tr>
            <td>Paid ({paymentMethod}):</td>
            <td className="thermal-right">{fmt(paymentReceived)}</td>
          </tr>
          <tr className="thermal-bold">
            <td>Balance Due:</td>
            <td className="thermal-right">{fmt(balanceDue)}</td>
          </tr>
        </tbody>
      </table>

      <div className="thermal-center">{divider}</div>

      {/* Footer Info */}
      <div className="thermal-center" style={{ marginTop: '4px' }}>
        <div>THANK YOU! VISIT AGAIN</div>
        <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center' }}>
          <img 
            src={`https://api.qrserver.com/v1/create-qr-code/?size=64x64&data=${encodeURIComponent(`upi://pay?pa=${upiId}&pn=${companyName}&am=${finalTotal}&cu=INR`)}`} 
            alt="UPI QR"
            style={{ width: '40mm', height: '40mm', border: '1px solid #CCC', padding: '1px' }}
          />
        </div>
      </div>
    </div>
  );
}
