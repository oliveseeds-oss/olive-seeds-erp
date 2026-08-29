const router = require('express').Router();
const db = require('../utils/db');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { authenticate, canWrite, canModify } = require('../middleware/auth');

const genInvoiceNumber = async (type = 'tax') => {
  const [[settings]] = await db.query('SELECT invoice_prefix, invoice_counter FROM company_settings LIMIT 1');
  const prefix = settings?.invoice_prefix || 'OS';
  const counter = settings?.invoice_counter || 1;
  await db.query('UPDATE company_settings SET invoice_counter=invoice_counter+1 WHERE id = 1');
  const typeCode = { tax: 'INV', proforma: 'PRO', quotation: 'QUO', commercial: 'EXP', credit_note: 'CN', debit_note: 'DN', delivery_challan: 'DC' }[type] || 'INV';
  const year = new Date().getFullYear().toString().slice(-2);
  return `${prefix}-${typeCode}-${year}-${String(counter).padStart(5, '0')}`;
};

// Get invoices
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, type, payment_status, from, to, page=1, limit=50 } = req.query;
    let q = `
      SELECT 
        i.*, 
        c.name as customer_name_joined,
        c.email as customer_email_joined,
        c.phone as customer_phone_joined,
        c.gstin as customer_gstin_joined,
        u.name as created_by_name,
        (SELECT COUNT(*) FROM invoice_items ii WHERE ii.invoice_id = i.id) as item_count
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN users u ON i.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (search) {
      q += ` AND (i.invoice_number LIKE ? OR 
            COALESCE(c.name, i.customer_name, '') LIKE ? OR 
            i.id LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (type) { q += ' AND i.invoice_type = ?'; params.push(type); }
    if (payment_status) {
      q += ' AND i.payment_status = ?';
      params.push(payment_status);
    }
    if (from) { q += ' AND DATE(i.invoice_date) >= ?'; params.push(from); }
    if (to) { q += ' AND DATE(i.invoice_date) <= ?'; params.push(to); }
    
    const countQ = q.replace(
      /SELECT[\s\S]*?FROM invoices/,
      'SELECT COUNT(*) as total FROM invoices'
    );
    const [[{total}]] = await db.query(countQ, params);
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    q += ` ORDER BY i.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    
    const [invoices] = await db.query(q, params);
    
    // Merge customer fields
    const result = invoices.map(inv => ({
      ...inv,
      display_customer_name: inv.customer_name_joined || inv.customer_name || 'Walk-in',
      display_customer_email: inv.customer_email_joined || inv.customer_email || '',
    }));
    
    res.json({ invoices: result, total: parseInt(total) });
  } catch (err) {
    console.error('Invoices list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Create invoice from order
router.post('/from-order/:orderId', authenticate, canWrite, async (req, res) => {
  try {
    const [orders] = await db.query('SELECT * FROM orders WHERE id=? OR order_id=?', [req.params.orderId, req.params.orderId]);
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];
    const { invoice_type = 'tax' } = req.body;
    const invNum = await genInvoiceNumber(invoice_type);
    const [result] = await db.query(
      `INSERT INTO invoices (
        invoice_number, invoice_type, order_id, customer_id, invoice_date, subtotal, discount,
        cgst, sgst, igst, total_tax, shipping_cost, total, currency, payment_status, is_international,
        created_by
      ) VALUES (?,?,?,?,CURDATE(),?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        invNum, invoice_type, order.id, order.customer_id, order.subtotal, order.discount, order.cgst,
        order.sgst, order.igst, order.total_tax, order.shipping_cost, order.total, order.currency,
        order.payment_status, order.is_international ? 1 : 0, req.user.id
      ]
    );
    res.json({ id: result.insertId, invoice_number: invNum, message: 'Invoice created' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error' });
  }
});

// Create standalone invoice
router.post('/', authenticate, canWrite, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      invoice_type = 'tax', customer_id, supplier_id, invoice_date, due_date, subtotal, discount = 0,
      cgst = 0, sgst = 0, igst = 0, total_tax = 0, shipping_cost = 0, total, currency = 'INR',
      notes, terms, is_international = false, country_of_origin = 'India', country_of_destination,
      hs_code, weight, declaration, items
    } = req.body;

    const invNum = await genInvoiceNumber(invoice_type);
    const [result] = await conn.query(
      `INSERT INTO invoices (
        invoice_number, invoice_type, customer_id, supplier_id, invoice_date, due_date, subtotal,
        discount, cgst, sgst, igst, total_tax, shipping_cost, total, currency, notes, terms,
        is_international, country_of_origin, country_of_destination, hs_code, weight, declaration,
        created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        invNum, invoice_type, customer_id || null, supplier_id || null,
        invoice_date || new Date().toISOString().split('T')[0], due_date || null, subtotal || 0,
        discount || 0, cgst || 0, sgst || 0, igst || 0, total_tax || 0, shipping_cost || 0, total || 0,
        currency || 'INR', notes || null, terms || null, is_international ? 1 : 0, country_of_origin,
        country_of_destination || null, hs_code || null, weight || null, declaration || null, req.user.id
      ]
    );

    const invoiceId = result.insertId;

    if (items && items.length > 0) {
      for (const item of items) {
        await conn.query(`
          INSERT INTO invoice_items 
            (invoice_id, product_id, product_name, hsn_code, quantity, unit_price, discount_percent, gst_percent, cgst_amount, sgst_amount, igst_amount, total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          invoiceId, item.product_id || null, item.product_name, item.hsn_code || null,
          item.quantity, item.unit_price, item.discount_percent || 0, item.gst_percent || 0,
          item.cgst_amount || 0, item.sgst_amount || 0, item.igst_amount || 0, item.total
        ]);
      }
    }

    await conn.commit();
    res.json({ id: invoiceId, invoice_number: invNum, message: 'Invoice created' });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: 'Error creating invoice: ' + e.message });
  } finally {
    conn.release();
  }
});

// GET: Single invoice with items
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [[inv]] = await db.query(`
      SELECT i.*, 
             c.name as customer_name, c.email as customer_email, c.phone as customer_phone, c.gstin as customer_gstin,
             c.billing_address, c.billing_city, c.billing_state, c.billing_pincode, c.billing_country,
             c.shipping_address, c.shipping_city, c.shipping_state, c.shipping_pincode, c.shipping_country,
             o.order_id as linked_order_id
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN orders o ON i.order_id = o.id
      WHERE i.id = ?
    `, [req.params.id]);

    if (!inv) return res.status(404).json({ error: 'Invoice not found' });

    const [items] = await db.query('SELECT * FROM invoice_items WHERE invoice_id = ?', [inv.id]);
    inv.invoice_items = items;

    res.json(inv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT: Edit invoice
router.put('/:id', authenticate, canWrite, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      invoice_date, due_date, customer_id, customer_name, customer_email, customer_phone,
      customer_gstin, billing_address, shipping_address, shipping_country, subtotal, discount,
      cgst, sgst, igst, total_tax, shipping_cost, total, currency, exchange_rate,
      payment_status, paid_amount, payment_mode, notes, terms, internal_notes,
      is_gst_invoice, is_international, items
    } = req.body;

    const [[existing]] = await conn.query('SELECT order_id FROM invoices WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    await conn.query(`
      UPDATE invoices SET
        invoice_date = ?, due_date = ?, customer_id = ?, 
        customer_name = ?, customer_email = ?, customer_phone = ?,
        subtotal = ?, discount = ?, cgst = ?, sgst = ?, igst = ?, 
        total_tax = ?, shipping_cost = ?, total = ?, currency = ?, 
        exchange_rate = ?, payment_status = ?, paid_amount = ?, 
        notes = ?, terms = ?, is_international = ?, payment_mode = ?
      WHERE id = ?
    `, [
      invoice_date, due_date || null, customer_id || null,
      customer_name || null, customer_email || null, customer_phone || null,
      subtotal || 0, discount || 0, cgst || 0, sgst || 0, igst || 0,
      total_tax || 0, shipping_cost || 0, total, currency || 'INR',
      exchange_rate || 1, payment_status || 'unpaid', paid_amount || 0,
      notes || null, terms || null, is_international ? 1 : 0, payment_mode || '',
      req.params.id
    ]);

    await conn.query('DELETE FROM invoice_items WHERE invoice_id = ?', [req.params.id]);

    if (items && items.length > 0) {
      for (const item of items) {
        await conn.query(`
          INSERT INTO invoice_items 
            (invoice_id, product_id, product_name, hsn_code, quantity, unit_price, discount_percent, gst_percent, cgst_amount, sgst_amount, igst_amount, total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          req.params.id, item.product_id || null, item.product_name, item.hsn_code || null,
          item.quantity, item.unit_price, item.discount_percent || 0, item.gst_percent || 0,
          item.cgst_amount || 0, item.sgst_amount || 0, item.igst_amount || 0, item.total
        ]);
      }
    }

    if (existing.order_id) {
      await conn.query(`
        UPDATE orders SET
          subtotal = ?, discount = ?, cgst = ?, sgst = ?, igst = ?,
          total_tax = ?, shipping_cost = ?, total = ?, payment_status = ?
        WHERE id = ?
      `, [
        subtotal || 0, discount || 0, cgst || 0, sgst || 0, igst || 0,
        total_tax || 0, shipping_cost || 0, total, payment_status || 'unpaid',
        existing.order_id
      ]);
    }

    await conn.commit();
    res.json({ message: 'Invoice updated' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// Generate Invoice PDF
router.get('/:id/pdf', authenticate, async (req, res) => {
  try {
    const [invoices] = await db.query(`
      SELECT i.*, c.name as cname, c.email as cemail, c.phone as cphone, c.gstin as cgstin,
             c.billing_address, c.billing_city, c.billing_state, c.billing_country
      FROM invoices i LEFT JOIN customers c ON i.customer_id=c.id
      WHERE (i.id=? OR i.invoice_number=?)
    `, [req.params.id, req.params.id]);
    if (!invoices.length) return res.status(404).json({ error: 'Invoice not found' });
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
    const titleMap = { tax: 'TAX INVOICE', proforma: 'PROFORMA INVOICE', quotation: 'QUOTATION', commercial: 'COMMERCIAL INVOICE', credit_note: 'CREDIT NOTE', debit_note: 'DEBIT NOTE', delivery_challan: 'DELIVERY CHALLAN', retail: 'RETAIL INVOICE' };
    doc.fontSize(14).fillColor('#1a5276').text(titleMap[inv.invoice_type] || 'INVOICE', 400, 50, { align: 'right' });
    doc.fontSize(9).fillColor('#333')
       .text(`Invoice No: ${inv.invoice_number}`, 350, 70, { align: 'right' })
       .text(`Date: ${new Date(inv.invoice_date).toLocaleDateString('en-IN')}`, 350, 82, { align: 'right' });

    // Divider
    doc.moveTo(50, 115).lineTo(545, 115).strokeColor('#1a5276').lineWidth(1.5).stroke();

    // Bill To
    doc.fontSize(9).fillColor('#888').text('BILL TO', 50, 125);
    doc.fontSize(10).fillColor('#222').text(inv.cname || 'Walk-in Customer', 50, 137);
    if (inv.cgstin) doc.fontSize(8).text(`GSTIN: ${inv.cgstin}`, 50, 149);
    if (inv.billing_address) doc.fontSize(8).fillColor('#555').text(`${inv.billing_address}, ${inv.billing_city || ''}, ${inv.billing_state || ''} - ${inv.billing_country || 'India'}`, 50, 160, { width: 200 });

    // Bank details
    if (company?.bank_name) {
      doc.fontSize(9).fillColor('#888').text('PAYMENT DETAILS', 300, 125);
      doc.fontSize(8).fillColor('#333')
         .text(`Bank: ${company.bank_name}`, 300, 137)
         .text(`A/C: ${company.bank_account || ''}`, 300, 148)
         .text(`IFSC: ${company.bank_ifsc || ''}`, 300, 159)
         .text(`UPI: ${company.upi_id || ''}`, 300, 170);
    }

    // Items table
    let y = 210;
    doc.rect(50, y, 495, 18).fillColor('#1a5276').fill();
    doc.fontSize(8).fillColor('#fff')
       .text('#', 55, y + 5).text('Description', 70, y + 5).text('HSN', 270, y + 5)
       .text('Qty', 310, y + 5).text('Rate', 340, y + 5).text('GST%', 385, y + 5).text('Amount', 450, y + 5, { align: 'right', width: 90 });
    y += 20;

    items.forEach((item, i) => {
      if (y > 700) { doc.addPage(); y = 50; }
      const bg = i % 2 === 0 ? '#f8f9fa' : '#ffffff';
      doc.rect(50, y - 2, 495, 16).fillColor(bg).fill();
      doc.fontSize(8).fillColor('#333')
         .text(i + 1, 55, y).text(item.product_name, 70, y, { width: 190 })
         .text(item.hsn_code || '', 270, y).text(item.quantity, 310, y)
         .text(`₹${parseFloat(item.unit_price).toFixed(2)}`, 335, y)
         .text(`${item.gst_percent || 0}%`, 385, y)
         .text(`₹${parseFloat(item.total).toFixed(2)}`, 450, y, { align: 'right', width: 90 });
      y += 18;
    });

    // Totals
    doc.moveTo(50, y + 5).lineTo(545, y + 5).strokeColor('#ddd').lineWidth(0.5).stroke();
    y += 15;
    const addTotal = (label, val, bold = false) => {
      doc.fontSize(bold ? 10 : 9).fillColor(bold ? '#1a5276' : '#333').text(label, 350, y, { align: 'right', width: 130 }).text(val, 490, y, { align: 'right', width: 55 });
      y += 16;
    };
    addTotal('Subtotal:', `₹${parseFloat(inv.subtotal || 0).toFixed(2)}`);
    if (inv.discount > 0) addTotal('Discount:', `-₹${parseFloat(inv.discount).toFixed(2)}`);
    if (inv.cgst > 0) addTotal(`CGST:`, `₹${parseFloat(inv.cgst).toFixed(2)}`);
    if (inv.sgst > 0) addTotal(`SGST:`, `₹${parseFloat(inv.sgst).toFixed(2)}`);
    if (inv.igst > 0) addTotal(`IGST:`, `₹${parseFloat(inv.igst).toFixed(2)}`);
    if (inv.shipping_cost > 0) addTotal('Shipping:', `₹${parseFloat(inv.shipping_cost).toFixed(2)}`);
    addTotal('TOTAL:', `₹${parseFloat(inv.total).toFixed(2)}`, true);

    // Footer
    if (company?.terms_conditions) {
      doc.fontSize(7).fillColor('#888').text('Terms & Conditions', 50, 750).text(company.terms_conditions, 50, 762, { width: 495 });
    }
    doc.fontSize(8).fillColor('#555').text('Authorised Signatory', 400, 780, { align: 'right', width: 145 });
    doc.end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'PDF generation error' });
  }
});

// Mark as paid
router.patch('/:id/pay', authenticate, canWrite, async (req, res) => {
  try {
    const { amount, payment_method, transaction_id } = req.body;
    const [invs] = await db.query('SELECT * FROM invoices WHERE id=?', [req.params.id]);
    if (!invs.length) return res.status(404).json({ error: 'Not found' });
    const inv = invs[0];
    const newPaid = parseFloat(inv.paid_amount || 0) + parseFloat(amount);
    const status = newPaid >= parseFloat(inv.total) ? 'paid' : 'partial';
    await db.query('UPDATE invoices SET paid_amount=?, payment_status=? WHERE id=?', [newPaid, status, req.params.id]);
    const payId = `PAY${Date.now()}`;
    await db.query('INSERT INTO payments (payment_id, invoice_id, order_id, customer_id, amount, payment_method, transaction_id, payment_date, created_by) VALUES (?,?,?,?,?,?,?,CURDATE(),?)',
      [payId, inv.id, inv.order_id, inv.customer_id, amount, payment_method, transaction_id, req.user.id]);
    if (inv.order_id) await db.query('UPDATE orders SET payment_status=? WHERE id=?', [status, inv.order_id]);
    res.json({ message: 'Payment recorded', status });
  } catch (e) {
    res.status(500).json({ error: 'Error' });
  }
});

// Soft Delete Route
router.delete('/:id', authenticate, canModify, async (req, res) => {
  try {
    await db.query('UPDATE invoices SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ error: 'Error deleting invoice' });
  }
});

module.exports = router;
