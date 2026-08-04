const router = require('express').Router();
const db = require('../utils/db');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { authenticate, canWrite, canModify } = require('../middleware/auth');

const genInvoiceNumber = async (type='tax') => {
  const [[settings]] = await db.query('SELECT invoice_prefix, invoice_counter FROM company_settings LIMIT 1');
  const prefix = settings?.invoice_prefix || 'OS';
  const counter = settings?.invoice_counter || 1;
  await db.query('UPDATE company_settings SET invoice_counter=invoice_counter+1');
  const typeCode = { tax:'INV', proforma:'PRO', quotation:'QUO', commercial:'EXP', credit_note:'CN', debit_note:'DN', delivery_challan:'DC' }[type] || 'INV';
  const year = new Date().getFullYear().toString().slice(-2);
  return `${prefix}-${typeCode}-${year}-${String(counter).padStart(5,'0')}`;
};

// Get invoices
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, type, payment_status, from, to, page=1, limit=50 } = req.query;
    let q = 'SELECT i.*, c.name as customer_name FROM invoices i LEFT JOIN customers c ON i.customer_id=c.id WHERE 1=1';
    const p = [];
    if (search) { q+=' AND (i.invoice_number LIKE ? OR c.name LIKE ?)'; const s=`%${search}%`; p.push(s,s); }
    if (type) { q+=' AND i.invoice_type=?'; p.push(type); }
    if (payment_status) { q+=' AND i.payment_status=?'; p.push(payment_status); }
    if (from) { q+=' AND i.invoice_date>=?'; p.push(from); }
    if (to) { q+=' AND i.invoice_date<=?'; p.push(to); }
    q+=` ORDER BY i.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${(parseInt(page)-1)*parseInt(limit)}`;
    const [invoices] = await db.query(q, p);
    const [[{total}]] = await db.query('SELECT COUNT(*) as total FROM invoices');
    res.json({ invoices, total });
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

// Create invoice from order
router.post('/from-order/:orderId', authenticate, canWrite, async (req, res) => {
  try {
    const [orders] = await db.query('SELECT * FROM orders WHERE id=? OR order_id=?', [req.params.orderId, req.params.orderId]);
    if (!orders.length) return res.status(404).json({ error:'Order not found' });
    const order = orders[0];
    const { invoice_type='tax' } = req.body;
    const invNum = await genInvoiceNumber(invoice_type);
    const [result] = await db.query(
      `INSERT INTO invoices (invoice_number, invoice_type, order_id, customer_id, invoice_date, subtotal, discount, cgst, sgst, igst, total_tax, shipping_cost, total, currency, payment_status, is_international, created_by) VALUES (?,?,?,?,CURDATE(),?,?,?,?,?,?,?,?,?,?,?,?)`,
      [invNum, invoice_type, order.id, order.customer_id, order.subtotal, order.discount, order.cgst, order.sgst, order.igst, order.total_tax, order.shipping_cost, order.total, order.currency, order.payment_status, order.is_international?1:0, req.user.id]
    );
    res.json({ id: result.insertId, invoice_number: invNum, message: 'Invoice created' });
  } catch(e) { console.error(e); res.status(500).json({ error:'Error' }); }
});

// Create standalone invoice
router.post('/', authenticate, canWrite, async (req, res) => {
  try {
    const { invoice_type='tax', customer_id, invoice_date, due_date, subtotal, discount=0, cgst=0, sgst=0, igst=0, total_tax=0, shipping_cost=0, total, currency='INR', notes, terms, is_international=false, country_of_destination, hs_code, weight, declaration } = req.body;
    const invNum = await genInvoiceNumber(invoice_type);
    const [result] = await db.query(
      `INSERT INTO invoices (invoice_number, invoice_type, customer_id, invoice_date, due_date, subtotal, discount, cgst, sgst, igst, total_tax, shipping_cost, total, currency, notes, terms, is_international, country_of_destination, hs_code, weight, declaration, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [invNum, invoice_type, customer_id, invoice_date||new Date().toISOString().split('T')[0], due_date, subtotal, discount, cgst, sgst, igst, total_tax, shipping_cost, total, currency, notes, terms, is_international?1:0, country_of_destination, hs_code, weight, declaration, req.user.id]
    );
    res.json({ id: result.insertId, invoice_number: invNum });
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

// Generate Invoice PDF
router.get('/:id/pdf', authenticate, async (req, res) => {
  try {
    const [invoices] = await db.query('SELECT i.*, c.name as cname, c.email as cemail, c.phone as cphone, c.gstin as cgstin, c.billing_address, c.billing_city, c.billing_state, c.billing_country FROM invoices i LEFT JOIN customers c ON i.customer_id=c.id WHERE i.id=? OR i.invoice_number=?', [req.params.id, req.params.id]);
    if (!invoices.length) return res.status(404).json({ error:'Invoice not found' });
    const inv = invoices[0];
    const [[company]] = await db.query('SELECT * FROM company_settings LIMIT 1');
    
    let items = [];
    if (inv.order_id) {
      [items] = await db.query('SELECT * FROM order_items WHERE order_id=?', [inv.order_id]);
    }

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${inv.invoice_number}.pdf"`);
    doc.pipe(res);

    // Header
    doc.fontSize(20).fillColor('#1a5276').text(company?.company_name || 'Olive Seeds Design Studio', 50, 50);
    doc.fontSize(8).fillColor('#555')
       .text(company?.address || '', 50, 75)
       .text(`GSTIN: ${company?.gstin || ''} | PAN: ${company?.pan || ''}`, 50, 85)
       .text(`Email: ${company?.email || ''} | Phone: ${company?.phone || ''}`, 50, 95);

    // Invoice title
    const titleMap = { tax:'TAX INVOICE', proforma:'PROFORMA INVOICE', quotation:'QUOTATION', commercial:'COMMERCIAL INVOICE', credit_note:'CREDIT NOTE', debit_note:'DEBIT NOTE', delivery_challan:'DELIVERY CHALLAN', retail:'RETAIL INVOICE' };
    doc.fontSize(14).fillColor('#1a5276').text(titleMap[inv.invoice_type]||'INVOICE', 400, 50, { align:'right' });
    doc.fontSize(9).fillColor('#333')
       .text(`Invoice No: ${inv.invoice_number}`, 350, 70, { align:'right' })
       .text(`Date: ${new Date(inv.invoice_date).toLocaleDateString('en-IN')}`, 350, 82, { align:'right' });

    // Divider
    doc.moveTo(50, 115).lineTo(545, 115).strokeColor('#1a5276').lineWidth(1.5).stroke();

    // Bill To
    doc.fontSize(9).fillColor('#888').text('BILL TO', 50, 125);
    doc.fontSize(10).fillColor('#222').text(inv.cname || 'Walk-in Customer', 50, 137);
    if (inv.cgstin) doc.fontSize(8).text(`GSTIN: ${inv.cgstin}`, 50, 149);
    if (inv.billing_address) doc.fontSize(8).fillColor('#555').text(`${inv.billing_address}, ${inv.billing_city||''}, ${inv.billing_state||''} - ${inv.billing_country||'India'}`, 50, 160, { width: 200 });

    // Bank details
    if (company?.bank_name) {
      doc.fontSize(9).fillColor('#888').text('PAYMENT DETAILS', 300, 125);
      doc.fontSize(8).fillColor('#333')
         .text(`Bank: ${company.bank_name}`, 300, 137)
         .text(`A/C: ${company.bank_account||''}`, 300, 148)
         .text(`IFSC: ${company.bank_ifsc||''}`, 300, 159)
         .text(`UPI: ${company.upi_id||''}`, 300, 170);
    }

    // Items table
    let y = 210;
    doc.rect(50, y, 495, 18).fillColor('#1a5276').fill();
    doc.fontSize(8).fillColor('#fff')
       .text('#', 55, y+5).text('Description', 70, y+5).text('HSN', 270, y+5)
       .text('Qty', 310, y+5).text('Rate', 340, y+5).text('GST%', 385, y+5).text('Amount', 450, y+5, {align:'right', width:90});
    y += 20;

    items.forEach((item, i) => {
      if (y > 700) { doc.addPage(); y = 50; }
      const bg = i%2===0 ? '#f8f9fa' : '#ffffff';
      doc.rect(50, y-2, 495, 16).fillColor(bg).fill();
      doc.fontSize(8).fillColor('#333')
         .text(i+1, 55, y).text(item.product_name, 70, y, {width:190})
         .text(item.hsn_code||'', 270, y).text(item.quantity, 310, y)
         .text(`₹${parseFloat(item.unit_price).toFixed(2)}`, 335, y)
         .text(`${item.gst_percent||0}%`, 385, y)
         .text(`₹${parseFloat(item.total).toFixed(2)}`, 450, y, {align:'right', width:90});
      y += 18;
    });

    // Totals
    doc.moveTo(50, y+5).lineTo(545, y+5).strokeColor('#ddd').lineWidth(0.5).stroke();
    y += 15;
    const addTotal = (label, val, bold=false) => {
      doc.fontSize(bold?10:9).fillColor(bold?'#1a5276':'#333').text(label, 350, y, {align:'right', width:130}).text(val, 490, y, {align:'right', width:55});
      y += 16;
    };
    addTotal('Subtotal:', `₹${parseFloat(inv.subtotal||0).toFixed(2)}`);
    if (inv.discount>0) addTotal('Discount:', `-₹${parseFloat(inv.discount).toFixed(2)}`);
    if (inv.cgst>0) addTotal(`CGST:`, `₹${parseFloat(inv.cgst).toFixed(2)}`);
    if (inv.sgst>0) addTotal(`SGST:`, `₹${parseFloat(inv.sgst).toFixed(2)}`);
    if (inv.igst>0) addTotal(`IGST:`, `₹${parseFloat(inv.igst).toFixed(2)}`);
    if (inv.shipping_cost>0) addTotal('Shipping:', `₹${parseFloat(inv.shipping_cost).toFixed(2)}`);
    addTotal('TOTAL:', `₹${parseFloat(inv.total).toFixed(2)}`, true);

    // Footer
    if (company?.terms_conditions) {
      doc.fontSize(7).fillColor('#888').text('Terms & Conditions', 50, 750).text(company.terms_conditions, 50, 762, { width: 495 });
    }
    doc.fontSize(8).fillColor('#555').text('Authorised Signatory', 400, 780, { align:'right', width: 145 });
    doc.end();
  } catch(e) { console.error(e); res.status(500).json({ error:'PDF generation error' }); }
});

// Mark as paid
router.patch('/:id/pay', authenticate, canWrite, async (req, res) => {
  try {
    const { amount, payment_method, transaction_id } = req.body;
    const [invs] = await db.query('SELECT * FROM invoices WHERE id=?', [req.params.id]);
    if (!invs.length) return res.status(404).json({ error:'Not found' });
    const inv = invs[0];
    const newPaid = parseFloat(inv.paid_amount||0) + parseFloat(amount);
    const status = newPaid >= parseFloat(inv.total) ? 'paid' : 'partial';
    await db.query('UPDATE invoices SET paid_amount=?, payment_status=? WHERE id=?', [newPaid, status, req.params.id]);
    const payId = `PAY${Date.now()}`;
    await db.query('INSERT INTO payments (payment_id, invoice_id, order_id, customer_id, amount, payment_method, transaction_id, payment_date, created_by) VALUES (?,?,?,?,?,?,?,CURDATE(),?)',
      [payId, inv.id, inv.order_id, inv.customer_id, amount, payment_method, transaction_id, req.user.id]);
    if (inv.order_id) await db.query('UPDATE orders SET payment_status=? WHERE id=?', [status, inv.order_id]);
    res.json({ message:'Payment recorded', status });
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

module.exports = router;
