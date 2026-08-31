const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, canWrite, canModify, requireAdmin } = require('../middleware/auth');
const PDFDocument = require('pdfkit');

// Get all quotations
router.get('/', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM quotations ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching quotations' });
  }
});

// Get single quotation with items
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [quos] = await db.query('SELECT * FROM quotations WHERE id=?', [req.params.id]);
    if (!quos.length) return res.status(404).json({ error: 'Quotation not found' });
    const [items] = await db.query('SELECT * FROM quotation_items WHERE quotation_id=?', [quos[0].id]);
    res.json({ ...quos[0], items });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// Create quotation
router.post('/', authenticate, canWrite, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      quotation_date, valid_until, customer_id, customer_name, customer_email, customer_phone,
      customer_company, customer_gstin, billing_address, items, shipping_estimate = 0, notes,
      terms, internal_notes, status, remark,
      quotation_title, billing_city, billing_state, billing_pincode
    } = req.body;

    const [[{ cnt }]] = await conn.query('SELECT COUNT(*) as cnt FROM quotations');
    const year = new Date().getFullYear();
    const quotation_number = `QUO-${year}-${String(cnt + 1).padStart(5, '0')}`;

    if (!items || !items.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'No items' });
    }

    let subtotal = 0, cgst = 0, sgst = 0, igst = 0, discount = 0;
    items.forEach(item => {
      const base = item.quantity * item.unit_price;
      const disc = base * (item.discount_percent || 0) / 100;
      const taxable = base - disc;
      const tax = taxable * (item.gst_percent || 0) / 100;
      subtotal += taxable;
      discount += disc;
      cgst += tax / 2;
      sgst += tax / 2;
    });
    const total_tax = cgst + sgst + igst;
    const total = subtotal + total_tax + parseFloat(shipping_estimate || 0);

    const [result] = await conn.query(`
      INSERT INTO quotations (
        quotation_number, quotation_date, valid_until, customer_id, customer_name, customer_email,
        customer_phone, customer_company, customer_gstin, billing_address, subtotal, discount,
        cgst, sgst, igst, total_tax, shipping_estimate, total, notes, terms, internal_notes,
        status, remark, created_by, quotation_title, billing_city, billing_state, billing_pincode
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      quotation_number, quotation_date || new Date().toISOString().split('T')[0], valid_until || null,
      customer_id || null, customer_name, customer_email || null, customer_phone || null, customer_company || null,
      customer_gstin || null, billing_address || null, subtotal, discount, cgst, sgst, igst, total_tax,
      shipping_estimate || 0, total, notes || null, terms || null, internal_notes || null, status || 'draft',
      remark || null, req.user.id, quotation_title || null, billing_city || null, billing_state || null, billing_pincode || null
    ]);

    const quotationId = result.insertId;

    for (const item of items) {
      const base = item.quantity * item.unit_price;
      const disc = base * (item.discount_percent || 0) / 100;
      const taxable = base - disc;
      const tax = taxable * (item.gst_percent || 0) / 100;

      await conn.query(`
        INSERT INTO quotation_items (
          quotation_id, product_name, description, size, quantity, unit, unit_price,
          discount_percent, gst_percent, cgst_amount, sgst_amount, igst_amount, total
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `, [
        quotationId, item.product_name, item.description || null, item.size || null, item.quantity,
        item.unit || 'pcs', item.unit_price, item.discount_percent || 0, item.gst_percent || 0,
        tax / 2, tax / 2, 0, taxable + tax
      ]);
    }

    await conn.commit();
    res.json({ id: quotationId, quotation_number, message: 'Quotation created' });
  } catch (err) {
    await conn.rollback();
    console.error('SQL QUOTATION CREATE ERROR:', err);
    res.status(500).json({ error: err.message || 'Error creating quotation' });
  } finally {
    conn.release();
  }
});

// Update quotation
router.put('/:id', authenticate, canWrite, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      quotation_date, valid_until, customer_id, customer_name, customer_email, customer_phone,
      customer_company, customer_gstin, billing_address, items, shipping_estimate = 0, notes,
      terms, internal_notes, status, remark,
      quotation_title, billing_city, billing_state, billing_pincode
    } = req.body;

    let subtotal = 0, cgst = 0, sgst = 0, igst = 0, discount = 0;
    items.forEach(item => {
      const base = item.quantity * item.unit_price;
      const disc = base * (item.discount_percent || 0) / 100;
      const taxable = base - disc;
      const tax = taxable * (item.gst_percent || 0) / 100;
      subtotal += taxable;
      discount += disc;
      cgst += tax / 2;
      sgst += tax / 2;
    });
    const total_tax = cgst + sgst + igst;
    const total = subtotal + total_tax + parseFloat(shipping_estimate || 0);

    await conn.query(`
      UPDATE quotations 
      SET quotation_date=?, valid_until=?, customer_id=?, customer_name=?, customer_email=?,
          customer_phone=?, customer_company=?, customer_gstin=?, billing_address=?, subtotal=?,
          discount=?, cgst=?, sgst=?, igst=?, total_tax=?, shipping_estimate=?, total=?,
          notes=?, terms=?, internal_notes=?, status=?, remark=?,
          quotation_title=?, billing_city=?, billing_state=?, billing_pincode=?
      WHERE id=?
    `, [
      quotation_date || new Date().toISOString().split('T')[0], valid_until || null, customer_id || null,
      customer_name, customer_email || null, customer_phone || null, customer_company || null,
      customer_gstin || null, billing_address || null, subtotal, discount, cgst, sgst, igst, total_tax,
      shipping_estimate || 0, total, notes || null, terms || null, internal_notes || null, status,
      remark || null, quotation_title || null, billing_city || null, billing_state || null, billing_pincode || null,
      req.params.id
    ]);

    // Recreate items
    await conn.query('DELETE FROM quotation_items WHERE quotation_id=?', [req.params.id]);
    for (const item of items) {
      const base = item.quantity * item.unit_price;
      const disc = base * (item.discount_percent || 0) / 100;
      const taxable = base - disc;
      const tax = taxable * (item.gst_percent || 0) / 100;

      await conn.query(`
        INSERT INTO quotation_items (
          quotation_id, product_name, description, size, quantity, unit, unit_price,
          discount_percent, gst_percent, cgst_amount, sgst_amount, igst_amount, total
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `, [
        req.params.id, item.product_name, item.description || null, item.size || null, item.quantity,
        item.unit || 'pcs', item.unit_price, item.discount_percent || 0, item.gst_percent || 0,
        tax / 2, tax / 2, 0, taxable + tax
      ]);
    }

    await conn.commit();
    res.json({ message: 'Quotation updated successfully' });
  } catch (err) {
    await conn.rollback();
    console.error('SQL QUOTATION PUT ERROR:', err);
    res.status(500).json({ error: err.message || 'Error updating quotation' });
  } finally {
    conn.release();
  }
});

// Hard Delete (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM quotations WHERE id=?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting quotation' });
  }
});

// Convert to Invoice
router.post('/:id/convert-invoice', authenticate, canWrite, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [quos] = await conn.query('SELECT * FROM quotations WHERE id=?', [req.params.id]);
    if (!quos.length) return res.status(404).json({ error: 'Quotation not found' });
    const quo = quos[0];

    const [[settings]] = await conn.query('SELECT invoice_prefix, invoice_counter FROM company_settings LIMIT 1');
    const prefix = settings?.invoice_prefix || 'OS';
    const counter = settings?.invoice_counter || 1;
    await conn.query('UPDATE company_settings SET invoice_counter = invoice_counter + 1 WHERE id = 1');
    const year = new Date().getFullYear().toString().slice(-2);
    const invNum = `${prefix}-INV-${year}-${String(counter).padStart(5, '0')}`;

    const [result] = await conn.query(
      `INSERT INTO invoices (
        invoice_number, invoice_type, customer_id, invoice_date, due_date, subtotal, discount,
        cgst, sgst, igst, total_tax, shipping_cost, total, currency, payment_status, notes, terms,
        created_by
      ) VALUES (?,?,?,CURDATE(),DATE_ADD(CURDATE(), INTERVAL 30 DAY),?,?,?,?,?,?,?,?,?,'pending',?,?,?)`,
      [invNum, 'tax', quo.customer_id, quo.subtotal, quo.discount, quo.cgst, quo.sgst, quo.igst, quo.total_tax, quo.shipping_estimate, quo.total, 'INR', quo.notes, quo.terms, req.user.id]
    );

    await conn.query('UPDATE quotations SET status="accepted" WHERE id=?', [req.params.id]);
    await conn.commit();
    res.json({ id: result.insertId, invoice_number: invNum, message: 'Converted to Tax Invoice successfully' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error converting quotation to invoice' });
  } finally {
    conn.release();
  }
});

// Convert to Order
router.post('/:id/convert-order', authenticate, canWrite, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [quos] = await conn.query('SELECT * FROM quotations WHERE id=?', [req.params.id]);
    if (!quos.length) return res.status(404).json({ error: 'Quotation not found' });
    const quo = quos[0];
    const [items] = await conn.query('SELECT * FROM quotation_items WHERE quotation_id=?', [quo.id]);

    const [[{ count }]] = await conn.query('SELECT COUNT(*) as count FROM orders');
    const date = new Date();
    const orderId = `OS${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(count + 1).padStart(5, '0')}`;

    const [result] = await conn.query(
      `INSERT INTO orders (
        order_id, order_type, source, customer_id, customer_name, customer_email, customer_phone,
        billing_address, subtotal, discount, cgst, sgst, igst, total_tax, shipping_cost, total,
        currency, payment_status, status, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [orderId, 'regular', 'manual', quo.customer_id, quo.customer_name, quo.customer_email, quo.customer_phone, quo.billing_address, quo.subtotal, quo.discount, quo.cgst, quo.sgst, quo.igst, quo.total_tax, quo.shipping_estimate, quo.total, 'INR', 'pending', 'pending', req.user.id]
    );

    for (const item of items) {
      await conn.query(
        `INSERT INTO order_items (
          order_id, product_name, description, size, quantity, unit_price, discount, gst_percent,
          cgst_amount, sgst_amount, igst_amount, total
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [result.insertId, item.product_name, item.description, item.size, item.quantity, item.unit_price, item.discount_percent, item.gst_percent, item.cgst_amount, item.sgst_amount, 0, item.total]
      );
    }

    await conn.query('UPDATE quotations SET status="accepted" WHERE id=?', [req.params.id]);
    await conn.commit();
    res.json({ id: result.insertId, order_id: orderId, message: 'Converted to Order successfully' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error converting quotation to order' });
  } finally {
    conn.release();
  }
});

// Quotation PDF
router.get('/:id/pdf', authenticate, async (req, res) => {
  try {
    const [quos] = await db.query('SELECT * FROM quotations WHERE id=?', [req.params.id]);
    if (!quos.length) return res.status(404).json({ error: 'Quotation not found' });
    const quo = quos[0];
    const [items] = await db.query('SELECT * FROM quotation_items WHERE quotation_id=?', [quo.id]);
    const [[company]] = await db.query('SELECT * FROM company_settings LIMIT 1');
    const [[creator]] = await db.query('SELECT signature_path FROM users WHERE id = ?', [quo.created_by || 1]);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${quo.quotation_number}.pdf"`);
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
    doc.fontSize(14).fillColor('#111827').text(company?.company_name || 'Olive Seeds Design Studio', textX, 45);
    doc.fontSize(8).fillColor('#4B5563')
       .text(company?.address || '', textX, 60)
       .text(`GSTIN: ${company?.gstin || ''}`, textX, 70)
       .text(`Email: ${company?.email || ''} | Phone: ${company?.phone || ''}`, textX, 80);

    doc.fontSize(16).fillColor('#111827').text('QUOTATION', 350, 45, { align: 'right' });
    doc.fontSize(8).fillColor('#4B5563')
       .text(`Quo No: ${quo.quotation_number}`, 350, 65, { align: 'right' })
       .text(`Date: ${new Date(quo.quotation_date).toLocaleDateString('en-IN')}`, 350, 75, { align: 'right' })
       .text(`Valid Until: ${quo.valid_until ? new Date(quo.valid_until).toLocaleDateString('en-IN') : 'N/A'}`, 350, 85, { align: 'right' });

    // Divider
    doc.moveTo(50, 110).lineTo(545, 110).strokeColor('#E5E7EB').lineWidth(1).stroke();

    // Bill To
    doc.fontSize(10).fillColor('#111827').text('Client Details:', 50, 125);
    doc.fontSize(8).fillColor('#4B5563')
       .text(quo.customer_name, 50, 140)
       .text(`Company: ${quo.customer_company || 'N/A'}`, 50, 150)
       .text(`Email: ${quo.customer_email || 'N/A'} | Phone: ${quo.customer_phone || 'N/A'}`, 50, 160);

    // Items table header
    doc.moveTo(50, 185).lineTo(545, 185).strokeColor('#111827').lineWidth(1).stroke();
    doc.fontSize(8).fillColor('#111827')
       .text('Product / Service Name', 50, 190)
       .text('Size', 240, 190)
       .text('Qty', 320, 190)
       .text('Rate', 380, 190)
       .text('GST %', 440, 190)
       .text('Amount', 485, 190, { width: 60, align: 'right' });
    doc.moveTo(50, 203).lineTo(545, 203).strokeColor('#E5E7EB').lineWidth(0.5).stroke();

    // Items rows
    let y = 210;
    items.forEach((item) => {
      doc.fontSize(8).fillColor('#4B5563')
         .text(item.product_name, 50, y)
         .text(item.size || 'N/A', 240, y)
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
       .text(`Rs. ${parseFloat(quo.subtotal).toFixed(2)}`, 485, y, { width: 60, align: 'right' });
    y += 12;
    doc.text('Tax (GST):', 380, y)
       .text(`Rs. ${parseFloat(quo.total_tax).toFixed(2)}`, 485, y, { width: 60, align: 'right' });
    y += 12;
    doc.text('Shipping Estimate:', 380, y)
       .text(`Rs. ${parseFloat(quo.shipping_estimate).toFixed(2)}`, 485, y, { width: 60, align: 'right' });
    y += 15;
    doc.fontSize(10).text('Total Quote:', 380, y)
       .text(`Rs. ${parseFloat(quo.total).toFixed(2)}`, 485, y, { width: 60, align: 'right' });
    y += 30;

    // Terms / Note
    if (quo.notes) {
      doc.fontSize(8).fillColor('#4B5563').text(`Notes: ${quo.notes}`, 50, y);
      y += 30;
    }
    if (quo.terms) {
      doc.fontSize(8).fillColor('#4B5563').text(`Terms & Conditions:\n${quo.terms}`, 50, y);
      y += 50;
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

    y += 30;
    doc.fontSize(8).fillColor('#9CA3AF').text('This is a quotation, not a tax invoice', 50, y, { align: 'center' });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generating PDF' });
  }
});

module.exports = router;
