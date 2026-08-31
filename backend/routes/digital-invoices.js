const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, canWrite, requireAdmin } = require('../middleware/auth');

const formatDate = (d) => {
  if (!d) return null;
  return d.split('T')[0];
};

// Get all digital invoices
router.get('/', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT di.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
      FROM digital_invoices di
      LEFT JOIN customers c ON di.customer_id = c.id
      ORDER BY di.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching digital invoices' });
  }
});

// Get single digital invoice
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [invoices] = await db.query('SELECT * FROM digital_invoices WHERE id=?', [req.params.id]);
    if (!invoices.length) return res.status(404).json({ error: 'Digital invoice not found' });
    const [items] = await db.query('SELECT * FROM digital_invoice_items WHERE digital_invoice_id=?', [invoices[0].id]);
    res.json({ ...invoices[0], items });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// Create digital invoice
router.post('/', authenticate, canWrite, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      invoice_date, due_date, customer_id, customer_name, customer_email, customer_phone, customer_gstin, billing_address,
      delivery_method, download_link, download_password, link_expiry, download_limit = 5, file_size, version_number,
      items, payment_mode, payment_status, notes, internal_notes, status
    } = req.body;

    const [[{ cnt }]] = await conn.query('SELECT COUNT(*) as cnt FROM digital_invoices');
    const year = new Date().getFullYear();
    const invoiceNumber = `DIG-INV-${year}-${String(cnt + 1).padStart(5, '0')}`;

    if (!items || !items.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'No items' });
    }

    let subtotal = 0, cgst = 0, sgst = 0, igst = 0, discount = 0;
    items.forEach(item => {
      const lineTotal = item.unit_price * item.quantity - (item.discount || 0);
      subtotal += lineTotal;
      const gstPercent = item.gst_percent || 0;
      const tax = lineTotal * gstPercent / 100;
      cgst += tax / 2;
      sgst += tax / 2;
    });
    const total_tax = cgst + sgst + igst;
    const total = subtotal + total_tax;

    const [result] = await conn.query(
      `INSERT INTO digital_invoices (
        invoice_number, invoice_date, due_date, customer_id, customer_name, customer_email, customer_phone,
        customer_gstin, billing_address, delivery_method, download_link, download_password, link_expiry,
        download_limit, file_size, version_number, subtotal, discount, cgst, sgst, igst, total_tax,
        total, paid_amount, payment_mode, payment_status, notes, internal_notes, status, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        invoiceNumber, formatDate(invoice_date) || new Date().toISOString().split('T')[0], formatDate(due_date) || null, customer_id || null,
        customer_name, customer_email || null, customer_phone || null, customer_gstin || null, billing_address || null,
        delivery_method || 'Instant Download', download_link || null, download_password || null, formatDate(link_expiry) || null,
        download_limit, file_size || null, version_number || null, subtotal, discount, cgst, sgst, igst, total_tax,
        total, payment_status === 'paid' ? total : 0, payment_mode || 'UPI', payment_status || 'unpaid',
        notes || null, internal_notes || null, status || 'draft', req.user.id
      ]
    );

    const digInvId = result.insertId;

    for (const item of items) {
      const lineTotal = item.unit_price * item.quantity - (item.discount || 0);
      const lineTax = lineTotal * (item.gst_percent || 0) / 100;
      await conn.query(
        `INSERT INTO digital_invoice_items (
          digital_invoice_id, product_name, item_type, description, file_format, license_type,
          quantity, unit, unit_price, discount_percent, gst_percent, cgst_amount, sgst_amount, igst_amount, total
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          digInvId, item.product_name, item.item_type || 'File Download', item.description || null,
          item.file_format || 'ZIP', item.license_type || 'Commercial Use', item.quantity || 1,
          item.unit || 'pcs', item.unit_price, item.discount_percent || 0, item.gst_percent || 0,
          lineTax / 2, lineTax / 2, 0, lineTotal
        ]
      );
    }

    await conn.commit();
    res.json({ id: digInvId, invoice_number: invoiceNumber, message: 'Digital invoice created' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error creating digital invoice' });
  } finally {
    conn.release();
  }
});

// Update digital invoice
router.put('/:id', authenticate, canWrite, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      invoice_date, due_date, customer_id, customer_name, customer_email, customer_phone, customer_gstin, billing_address,
      delivery_method, download_link, download_password, link_expiry, download_limit, file_size, version_number,
      items, payment_mode, payment_status, notes, internal_notes, status
    } = req.body;

    const [invoices] = await conn.query('SELECT * FROM digital_invoices WHERE id=?', [req.params.id]);
    if (!invoices.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Invoice not found' });
    }

    let subtotal = 0, cgst = 0, sgst = 0, igst = 0, discount = 0;
    items.forEach(item => {
      const lineTotal = item.unit_price * item.quantity - (item.discount || 0);
      subtotal += lineTotal;
      const gstPercent = item.gst_percent || 0;
      const tax = lineTotal * gstPercent / 100;
      cgst += tax / 2;
      sgst += tax / 2;
    });
    const total_tax = cgst + sgst + igst;
    const total = subtotal + total_tax;

    await conn.query(
      `UPDATE digital_invoices
       SET invoice_date=?, due_date=?, customer_id=?, customer_name=?, customer_email=?, customer_phone=?, customer_gstin=?, billing_address=?,
           delivery_method=?, download_link=?, download_password=?, link_expiry=?, download_limit=?, file_size=?, version_number=?,
           subtotal=?, total_tax=?, total=?, paid_amount=?, payment_mode=?, payment_status=?, notes=?, internal_notes=?, status=?
       WHERE id=?`,
      [
        formatDate(invoice_date) || new Date().toISOString().split('T')[0], formatDate(due_date) || null, customer_id || null, customer_name, customer_email, customer_phone || null, customer_gstin || null, billing_address || null,
        delivery_method, download_link || null, download_password || null, formatDate(link_expiry) || null, download_limit, file_size || null, version_number || null,
        subtotal, total_tax, total, payment_status === 'paid' ? total : 0, payment_mode, payment_status, notes || null, internal_notes || null, status, req.params.id
      ]
    );

    // Recreate items
    await conn.query('DELETE FROM digital_invoice_items WHERE digital_invoice_id=?', [req.params.id]);
    for (const item of items) {
      const lineTotal = item.unit_price * item.quantity - (item.discount || 0);
      const lineTax = lineTotal * (item.gst_percent || 0) / 100;
      await conn.query(
        `INSERT INTO digital_invoice_items (
          digital_invoice_id, product_name, item_type, description, file_format, license_type,
          quantity, unit, unit_price, discount_percent, gst_percent, cgst_amount, sgst_amount, igst_amount, total
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          req.params.id, item.product_name, item.item_type || 'File Download', item.description || null,
          item.file_format || 'ZIP', item.license_type || 'Commercial Use', item.quantity || 1,
          item.unit || 'pcs', item.unit_price, item.discount_percent || 0, item.gst_percent || 0,
          lineTax / 2, lineTax / 2, 0, lineTotal
        ]
      );
    }

    await conn.commit();
    res.json({ message: 'Digital invoice updated successfully' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error updating digital invoice' });
  } finally {
    conn.release();
  }
});

// Hard delete digital invoice (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM digital_invoices WHERE id=?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// Get digital invoice PDF
router.get('/:id/pdf', authenticate, async (req, res) => {
  try {
    const [invoices] = await db.query('SELECT * FROM digital_invoices WHERE id=?', [req.params.id]);
    if (!invoices.length) return res.status(404).json({ error: 'Digital invoice not found' });
    const inv = invoices[0];
    const [items] = await db.query('SELECT * FROM digital_invoice_items WHERE digital_invoice_id=?', [inv.id]);
    const [[company]] = await db.query('SELECT * FROM company_settings LIMIT 1');
    const [[creator]] = await db.query('SELECT signature_path FROM users WHERE id = ?', [inv.created_by || 1]);

    const PDFDocument = require('pdfkit');
    const fs = require('fs');
    const path = require('path');

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${inv.invoice_number}.pdf"`);
    doc.pipe(res);

    // Header
    let textX = 50;
    if (company?.logo_path) {
      const logoFile = path.join(__dirname, '..', company.logo_path.replace(/^\//, ''));
      if (fs.existsSync(logoFile)) {
        doc.image(logoFile, 50, 45, { width: 50, height: 50 });
        textX = 110;
      }
    }
    doc.fontSize(16).fillColor('#1a5276').text(company?.company_name || 'Olive Seeds Design Studio', textX, 45);
    doc.fontSize(8).fillColor('#555')
       .text(company?.address || '', textX, 60)
       .text(`GSTIN: ${company?.gstin || ''} | PAN: ${company?.pan || ''}`, textX, 70)
       .text(`Email: ${company?.email || ''} | Phone: ${company?.phone || ''}`, textX, 80);

    // Invoice title
    doc.fontSize(14).fillColor('#1a5276').text('DIGITAL TAX INVOICE', 350, 45, { align: 'right' });
    doc.fontSize(8).fillColor('#333')
       .text(`Invoice No: ${inv.invoice_number}`, 350, 65, { align: 'right' })
       .text(`Date: ${new Date(inv.invoice_date).toLocaleDateString('en-IN')}`, 350, 75, { align: 'right' });

    // Divider
    doc.moveTo(50, 110).lineTo(545, 110).strokeColor('#1a5276').lineWidth(1.5).stroke();

    // Bill To
    doc.fontSize(10).fillColor('#111827').text('Bill To:', 50, 125);
    doc.fontSize(8).fillColor('#4B5563')
       .text(inv.customer_name, 50, 140)
       .text(`Email: ${inv.customer_email || 'N/A'} | Phone: ${inv.customer_phone || 'N/A'}`, 50, 150)
       .text(`GSTIN: ${inv.customer_gstin || 'N/A'}`, 50, 160)
       .text(`Address: ${inv.billing_address || 'N/A'}`, 50, 170);

    // Download info
    doc.fontSize(10).fillColor('#111827').text('Digital Delivery Information:', 300, 125);
    doc.fontSize(8).fillColor('#4B5563')
       .text(`Method: ${inv.delivery_method || 'Instant Download'}`, 300, 140)
       .text(`Link Expiry: ${inv.link_expiry ? new Date(inv.link_expiry).toLocaleDateString('en-IN') : 'N/A'}`, 300, 150)
       .text(`Download Limit: ${inv.download_limit || 5} times`, 300, 160)
       .text(`Version: ${inv.version_number || '1.0.0'}`, 300, 170);

    // Items table header
    doc.moveTo(50, 195).lineTo(545, 195).strokeColor('#1a5276').lineWidth(1).stroke();
    doc.fontSize(8).fillColor('#111827')
       .text('Product Name / License Type', 50, 200)
       .text('Format', 250, 200)
       .text('Qty', 320, 200)
       .text('Price', 380, 200)
       .text('GST %', 440, 200)
       .text('Amount', 485, 200, { width: 60, align: 'right' });
    doc.moveTo(50, 215).lineTo(545, 215).strokeColor('#E5E7EB').lineWidth(0.5).stroke();

    // Items rows
    let y = 222;
    items.forEach((item) => {
      doc.fontSize(8).fillColor('#4B5563')
         .text(item.product_name, 50, y)
         .text(item.file_format || 'ZIP', 250, y)
         .text(String(item.quantity), 320, y)
         .text(`Rs. ${parseFloat(item.unit_price).toFixed(2)}`, 380, y)
         .text(`${item.gst_percent}%`, 440, y)
         .text(`Rs. ${parseFloat(item.total).toFixed(2)}`, 485, y, { width: 60, align: 'right' });
      y += 18;
    });

    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E5E7EB').lineWidth(1).stroke();
    y += 10;

    // Totals
    doc.fontSize(8).fillColor('#111827')
       .text('Subtotal:', 380, y)
       .text(`Rs. ${parseFloat(inv.subtotal).toFixed(2)}`, 485, y, { width: 60, align: 'right' });
    y += 12;
    doc.text('Tax (GST):', 380, y)
       .text(`Rs. ${parseFloat(inv.total_tax).toFixed(2)}`, 485, y, { width: 60, align: 'right' });
    y += 15;
    doc.fontSize(10).text('Total Paid:', 380, y)
       .text(`Rs. ${parseFloat(inv.total).toFixed(2)}`, 485, y, { width: 60, align: 'right' });
    y += 30;

    // Terms / Note
    if (inv.notes) {
      doc.fontSize(8).fillColor('#4B5563').text(`Notes: ${inv.notes}`, 50, y);
      y += 30;
    }

    // Signatory Block
    y += 20;
    doc.fontSize(8).fillColor('#111827').text('For ' + (company?.company_name || 'Olive Seeds Design Studio'), 380, y, { align: 'right', width: 165 });
    y += 15;
    const signaturePath = company?.default_signature_path || creator?.signature_path;
    if (signaturePath) {
      const sigFile = path.join(__dirname, '..', signaturePath.replace(/^\//, ''));
      if (fs.existsSync(sigFile)) {
        doc.image(sigFile, 450, y, { width: 80, height: 35 });
        y += 40;
      } else {
        y += 40;
      }
    } else {
      y += 40;
    }
    doc.fontSize(8).fillColor('#4B5563').text('Authorized Signatory', 380, y, { align: 'right', width: 165 });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generating PDF' });
  }
});

module.exports = router;
