const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, canWrite, requireAdmin } = require('../middleware/auth');

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
        invoiceNumber, invoice_date || new Date().toISOString().split('T')[0], due_date || null, customer_id || null,
        customer_name, customer_email || null, customer_phone || null, customer_gstin || null, billing_address || null,
        delivery_method || 'Instant Download', download_link || null, download_password || null, link_expiry || null,
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
        invoice_date || new Date().toISOString().split('T')[0], due_date || null, customer_id || null, customer_name, customer_email, customer_phone || null, customer_gstin || null, billing_address || null,
        delivery_method, download_link || null, download_password || null, link_expiry || null, download_limit, file_size || null, version_number || null,
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

module.exports = router;
