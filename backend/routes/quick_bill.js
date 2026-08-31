const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, canWrite, canModify } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const getNextBillNumber = async (type) => {
  const [[settings]] = await db.query('SELECT counter_cm, counter_ph, counter_db, counter_dg FROM company_settings LIMIT 1');
  let col = '';
  let prefix = '';
  if (type === 'cash_memo') { col = 'counter_cm'; prefix = 'CM-2026-'; }
  else if (type === 'gst_invoice_physical') { col = 'counter_ph'; prefix = 'PH-2026-'; }
  else if (type === 'simple_receipt_digital') { col = 'counter_db'; prefix = 'DB-2026-'; }
  else if (type === 'gst_invoice_digital') { col = 'counter_dg'; prefix = 'DG-2026-'; }

  const nextVal = (settings ? settings[col] : 1) || 1;
  const billNum = `${prefix}${String(nextVal).padStart(5, '0')}`;
  await db.query(`UPDATE company_settings SET ${col} = ${col} + 1 WHERE id = 1`);
  return billNum;
};

// ----------------- PHYSICAL -----------------

// POST: Save physical quick bill
router.post('/physical', authenticate, canWrite, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      bill_type, customer_name, customer_phone, customer_gstin, customer_company,
      subtotal, gst_percent, gst_amount, total, amount_received, change_amount, balance_due,
      payment_mode, payment_status, upi_reference, card_last4, terminal_id, bank_utr, bank_name,
      internal_notes, items
    } = req.body;

    const typeKey = bill_type === 'gst_invoice' ? 'gst_invoice_physical' : 'cash_memo';
    let billNumber = req.body.bill_number;
    let [exists] = await conn.query('SELECT id FROM quick_bills_physical WHERE bill_number = ?', [billNumber]);
    if (!billNumber || exists.length > 0) {
      billNumber = await getNextBillNumber(typeKey);
    }

    const [result] = await conn.query(
      `INSERT INTO quick_bills_physical (
        bill_number, bill_type, bill_date, bill_time, customer_name, customer_phone, customer_gstin,
        customer_company, subtotal, gst_percent, gst_amount, total, amount_received, change_amount,
        balance_due, payment_mode, payment_status, upi_reference, card_last4, terminal_id, bank_utr,
        bank_name, internal_notes, created_by, created_by_name
      ) VALUES (?,?,CURDATE(),CURTIME(),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        billNumber, bill_type || 'cash_memo', customer_name || null, customer_phone || null, customer_gstin || null, customer_company || null,
        subtotal || 0, gst_percent || 0, gst_amount || 0, total || 0, amount_received || 0, change_amount || 0, balance_due || 0,
        payment_mode || 'cash', payment_status || 'paid', upi_reference || null, card_last4 || null, terminal_id || null, bank_utr || null, bank_name || null,
        internal_notes || null, req.user.id, req.user.name || req.user.username
      ]
    );

    const billId = result.insertId;
    for (const item of items) {
      // Stock deduction
      if (item.product_id) {
        const [[prod]] = await conn.query('SELECT stock FROM products WHERE id = ?', [item.product_id]);
        if (prod) {
          const newStock = prod.stock - parseInt(item.quantity);
          await conn.query('UPDATE products SET stock = ? WHERE id = ?', [newStock, item.product_id]);
          await conn.query(
            `INSERT INTO inventory_movements (product_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
             VALUES (?, 'out', ?, 'quick_bill', ?, 'Quick bill physical sale', ?)`,
            [item.product_id, item.quantity, billId, req.user.id]
          );
        }
      }

      await conn.query(
        `INSERT INTO quick_bill_physical_items (bill_id, product_id, product_name, description, quantity, unit_price, discount_percent, amount)
         VALUES (?,?,?,?,?,?,?,?)`,
        [billId, item.product_id || null, item.product_name, item.description || null, item.quantity || 1, item.unit_price || 0, item.discount_percent || 0, item.amount || 0]
      );
    }

    await conn.commit();
    res.json({ id: billId, bill_number: billNumber, message: 'Saved successfully' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error saving physical quick bill: ' + err.message });
  } finally {
    conn.release();
  }
});

// PUT: Update physical quick bill
router.put('/physical/:id', authenticate, canWrite, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const {
      bill_type, customer_name, customer_phone, customer_gstin, customer_company,
      subtotal, gst_percent, gst_amount, total, amount_received, change_amount, balance_due,
      payment_mode, payment_status, upi_reference, card_last4, terminal_id, bank_utr, bank_name,
      internal_notes, items
    } = req.body;

    const [[exist]] = await conn.query('SELECT * FROM quick_bills_physical WHERE id = ?', [id]);
    if (!exist) {
      conn.release();
      return res.status(404).json({ error: 'Bill not found' });
    }

    await conn.query(
      `UPDATE quick_bills_physical SET 
        bill_type = ?, customer_name = ?, customer_phone = ?, customer_gstin = ?, customer_company = ?,
        subtotal = ?, gst_percent = ?, gst_amount = ?, total = ?, amount_received = ?, change_amount = ?,
        balance_due = ?, payment_mode = ?, payment_status = ?, upi_reference = ?, card_last4 = ?,
        terminal_id = ?, bank_utr = ?, bank_name = ?, internal_notes = ?
      WHERE id = ?`,
      [
        bill_type || 'cash_memo', customer_name || null, customer_phone || null, customer_gstin || null, customer_company || null,
        subtotal || 0, gst_percent || 0, gst_amount || 0, total || 0, amount_received || 0, change_amount || 0, balance_due || 0,
        payment_mode || 'cash', payment_status || 'paid', upi_reference || null, card_last4 || null, terminal_id || null, bank_utr || null, bank_name || null,
        internal_notes || null, id
      ]
    );

    // Delete old items and restore stock
    const [oldItems] = await conn.query('SELECT * FROM quick_bill_physical_items WHERE bill_id = ?', [id]);
    for (const oldItem of oldItems) {
      if (oldItem.product_id) {
        await conn.query('UPDATE products SET stock = stock + ? WHERE id = ?', [oldItem.quantity, oldItem.product_id]);
      }
    }
    await conn.query('DELETE FROM quick_bill_physical_items WHERE bill_id = ?', [id]);
    await conn.query('DELETE FROM inventory_movements WHERE reference_type = "quick_bill" AND reference_id = ?', [id]);

    // Insert new items
    for (const item of items) {
      if (item.product_id) {
        await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
        await conn.query(
          `INSERT INTO inventory_movements (product_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
           VALUES (?, 'out', ?, 'quick_bill', ?, 'Quick bill physical sale update', ?)`,
          [item.product_id, item.quantity, id, req.user.id]
        );
      }

      await conn.query(
        `INSERT INTO quick_bill_physical_items (bill_id, product_id, product_name, description, quantity, unit_price, discount_percent, amount)
         VALUES (?,?,?,?,?,?,?,?)`,
        [id, item.product_id || null, item.product_name, item.description || null, item.quantity || 1, item.unit_price || 0, item.discount_percent || 0, item.amount || 0]
      );
    }

    await conn.commit();
    res.json({ id, message: 'Updated successfully' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error updating physical bill: ' + err.message });
  } finally {
    conn.release();
  }
});

// GET: List physical bills
router.get('/physical', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page || 1);
    const limit = parseInt(req.query.limit || 50);
    const offset = (page - 1) * limit;

    const [rows] = await db.query(
      `SELECT qb.*,
              GROUP_CONCAT(qbi.product_name SEPARATOR ', ') as item_names,
              COUNT(qbi.id) as item_count
       FROM quick_bills_physical qb
       LEFT JOIN quick_bill_physical_items qbi ON qb.id = qbi.bill_id
       GROUP BY qb.id
       ORDER BY qb.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM quick_bills_physical');

    res.json({ bills: rows, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch physical bill history: ' + err.message });
  }
});

// ----------------- DIGITAL -----------------

// POST: Save digital quick bill
router.post('/digital', authenticate, canWrite, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      bill_type, customer_name, customer_email, customer_phone, customer_gstin, customer_company,
      has_digital_files, download_link, link_password, link_valid_until,
      subtotal, gst_percent, gst_amount, total, amount_received, change_amount, balance_due,
      payment_mode, payment_status, upi_reference, card_last4, terminal_id, bank_utr, bank_name,
      internal_notes, items
    } = req.body;

    const typeKey = bill_type === 'gst_invoice' ? 'gst_invoice_digital' : 'simple_receipt_digital';
    let billNumber = req.body.bill_number;
    let [exists] = await conn.query('SELECT id FROM quick_bills_digital WHERE bill_number = ?', [billNumber]);
    if (!billNumber || exists.length > 0) {
      billNumber = await getNextBillNumber(typeKey);
    }

    const [result] = await conn.query(
      `INSERT INTO quick_bills_digital (
        bill_number, bill_type, bill_date, bill_time, customer_name, customer_email, customer_phone,
        customer_gstin, customer_company, has_digital_files, download_link, link_password, link_valid_until,
        subtotal, gst_percent, gst_amount, total, amount_received, change_amount, balance_due, payment_mode,
        payment_status, upi_reference, card_last4, terminal_id, bank_utr, bank_name, internal_notes,
        created_by, created_by_name
      ) VALUES (?,?,CURDATE(),CURTIME(),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        billNumber, bill_type || 'simple_receipt', customer_name, customer_email, customer_phone || null, customer_gstin || null, customer_company || null,
        has_digital_files ? 1 : 0, download_link || null, link_password || null, link_valid_until || null,
        subtotal || 0, gst_percent || 0, gst_amount || 0, total || 0, amount_received || 0, change_amount || 0, balance_due || 0,
        payment_mode || 'upi', payment_status || 'paid', upi_reference || null, card_last4 || null, terminal_id || null, bank_utr || null, bank_name || null,
        internal_notes || null, req.user.id, req.user.name || req.user.username
      ]
    );

    const billId = result.insertId;
    for (const item of items) {
      await conn.query(
        `INSERT INTO quick_bill_digital_items (bill_id, item_type, product_name, description, file_format, license_type, quantity, unit_price, discount_percent, amount)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [billId, item.item_type || 'Other Service', item.product_name, item.description || null, item.file_format || null, item.license_type || null, item.quantity || 1, item.unit_price || 0, item.discount_percent || 0, item.amount || 0]
      );
    }

    await conn.commit();
    res.json({ id: billId, bill_number: billNumber, message: 'Saved successfully' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error saving digital quick bill: ' + err.message });
  } finally {
    conn.release();
  }
});

// PUT: Update digital quick bill
router.put('/digital/:id', authenticate, canWrite, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const {
      bill_type, customer_name, customer_email, customer_phone, customer_gstin, customer_company,
      has_digital_files, download_link, link_password, link_valid_until,
      subtotal, gst_percent, gst_amount, total, amount_received, change_amount, balance_due,
      payment_mode, payment_status, upi_reference, card_last4, terminal_id, bank_utr, bank_name,
      internal_notes, items
    } = req.body;

    const [[exist]] = await conn.query('SELECT * FROM quick_bills_digital WHERE id = ?', [id]);
    if (!exist) {
      conn.release();
      return res.status(404).json({ error: 'Bill not found' });
    }

    await conn.query(
      `UPDATE quick_bills_digital SET 
        bill_type = ?, customer_name = ?, customer_email = ?, customer_phone = ?, customer_gstin = ?, customer_company = ?,
        has_digital_files = ?, download_link = ?, link_password = ?, link_valid_until = ?,
        subtotal = ?, gst_percent = ?, gst_amount = ?, total = ?, amount_received = ?, change_amount = ?,
        balance_due = ?, payment_mode = ?, payment_status = ?, upi_reference = ?, card_last4 = ?,
        terminal_id = ?, bank_utr = ?, bank_name = ?, internal_notes = ?
      WHERE id = ?`,
      [
        bill_type || 'simple_receipt', customer_name, customer_email, customer_phone || null, customer_gstin || null, customer_company || null,
        has_digital_files ? 1 : 0, download_link || null, link_password || null, link_valid_until || null,
        subtotal || 0, gst_percent || 0, gst_amount || 0, total || 0, amount_received || 0, change_amount || 0, balance_due || 0,
        payment_mode || 'upi', payment_status || 'paid', upi_reference || null, card_last4 || null, terminal_id || null, bank_utr || null, bank_name || null,
        internal_notes || null, id
      ]
    );

    await conn.query('DELETE FROM quick_bill_digital_items WHERE bill_id = ?', [id]);

    for (const item of items) {
      await conn.query(
        `INSERT INTO quick_bill_digital_items (bill_id, item_type, product_name, description, file_format, license_type, quantity, unit_price, discount_percent, amount)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [id, item.item_type || 'Other Service', item.product_name, item.description || null, item.file_format || null, item.license_type || null, item.quantity || 1, item.unit_price || 0, item.discount_percent || 0, item.amount || 0]
      );
    }

    await conn.commit();
    res.json({ id, message: 'Updated successfully' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error updating digital bill: ' + err.message });
  } finally {
    conn.release();
  }
});

// GET: List digital bills
router.get('/digital', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page || 1);
    const limit = parseInt(req.query.limit || 50);
    const offset = (page - 1) * limit;

    const [rows] = await db.query(
      `SELECT qb.*,
              GROUP_CONCAT(qbi.product_name SEPARATOR ', ') as item_names,
              COUNT(qbi.id) as item_count
       FROM quick_bills_digital qb
       LEFT JOIN quick_bill_digital_items qbi ON qb.id = qbi.bill_id
       GROUP BY qb.id
       ORDER BY qb.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM quick_bills_digital');

    res.json({ bills: rows, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch digital bills history: ' + err.message });
  }
});

// GET: Single physical bill
router.get('/physical/:id', authenticate, async (req, res) => {
  try {
    const [bills] = await db.query('SELECT * FROM quick_bills_physical WHERE id=?', [req.params.id]);
    if (!bills.length) return res.status(404).json({ error: 'Bill not found' });
    const [items] = await db.query('SELECT * FROM quick_bill_physical_items WHERE bill_id=?', [bills[0].id]);
    res.json({ ...bills[0], items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Single digital bill
router.get('/digital/:id', authenticate, async (req, res) => {
  try {
    const [bills] = await db.query('SELECT * FROM quick_bills_digital WHERE id=?', [req.params.id]);
    if (!bills.length) return res.status(404).json({ error: 'Bill not found' });
    const [items] = await db.query('SELECT * FROM quick_bill_digital_items WHERE bill_id=?', [bills[0].id]);
    res.json({ ...bills[0], items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE: physical
router.delete('/physical/:id', authenticate, canModify, async (req, res) => {
  try {
    await db.query('DELETE FROM quick_bills_physical WHERE id=?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE: digital
router.delete('/digital/:id', authenticate, canModify, async (req, res) => {
  try {
    await db.query('DELETE FROM quick_bills_digital WHERE id=?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------- PDF DOWNLOAD -----------------
router.get('/:mode/:id/pdf', authenticate, async (req, res) => {
  try {
    const { mode, id } = req.params;
    const table = mode === 'digital' ? 'quick_bills_digital' : 'quick_bills_physical';
    const itemTable = mode === 'digital' ? 'quick_bill_digital_items' : 'quick_bill_physical_items';

    const [bills] = await db.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [id]);
    if (!bills.length) return res.status(404).json({ error: 'Bill not found' });
    const bill = bills[0];

    const [items] = await db.query(`SELECT * FROM \`${itemTable}\` WHERE bill_id = ?`, [id]);
    const [[company]] = await db.query('SELECT * FROM company_settings LIMIT 1');

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Bill-${bill.bill_number}.pdf"`);
    doc.pipe(res);

    // Bill Title
    let textX = 40;
    if (company?.logo_path) {
      const logoFile = path.join(__dirname, '..', company.logo_path.replace(/^\//, ''));
      if (fs.existsSync(logoFile)) {
        doc.image(logoFile, 40, 35, { width: 50, height: 50 });
        textX = 100;
      }
    }
    doc.fontSize(16).fillColor('#1a1a2e').text(company?.company_name || 'Olive Seeds Design Studio', textX, 40);
    doc.fontSize(8).fillColor('#555')
       .text(company?.address || '', textX, 55)
       .text(`GSTIN: ${company?.gstin || ''}`, textX, 65)
       .text(`Phone: ${company?.phone || ''} | Email: ${company?.email || ''}`, textX, 75);

    doc.fontSize(16).fillColor('#1a1a2e').text('QUICK RECEIPT', 400, 40, { align: 'right' });
    doc.fontSize(9).fillColor('#333')
       .text(`Bill No: ${bill.bill_number}`, 350, 60, { align: 'right' })
       .text(`Date: ${new Date(bill.bill_date).toLocaleDateString('en-IN')}`, 350, 72, { align: 'right' });

    doc.moveTo(40, 105).lineTo(555, 105).strokeColor('#1a1a2e').lineWidth(1.5).stroke();

    // Customer info
    doc.fontSize(9).fillColor('#888').text('CUSTOMER DETAILS', 40, 115);
    doc.fontSize(10).fillColor('#222').text(bill.customer_name || 'Walk-in Customer', 40, 127);
    if (bill.customer_phone) doc.fontSize(8).text(`Phone: ${bill.customer_phone}`, 40, 139);
    if (bill.customer_email) doc.fontSize(8).text(`Email: ${bill.customer_email}`, 40, 149);

    // Payment details
    doc.fontSize(9).fillColor('#888').text('PAYMENT INFORMATION', 300, 115);
    doc.fontSize(8).fillColor('#333')
       .text(`Mode: ${bill.payment_mode.toUpperCase()}`, 300, 127)
       .text(`Status: ${bill.payment_status.toUpperCase()}`, 300, 137)
       .text(`Total Paid: ₹${parseFloat(bill.amount_received || 0).toFixed(2)}`, 300, 147);

    // Items table
    let y = 180;
    doc.rect(40, y, 515, 18).fillColor('#1a1a2e').fill();
    doc.fontSize(8).fillColor('#fff')
       .text('#', 45, y + 5)
       .text('Product / Service Name', 60, y + 5)
       .text('Qty', 320, y + 5)
       .text('Price', 370, y + 5)
       .text('Disc%', 440, y + 5)
       .text('Amount', 490, y + 5, { align: 'right', width: 60 });
    
    y += 20;

    items.forEach((item, idx) => {
      const bg = idx % 2 === 0 ? '#f9fafb' : '#ffffff';
      doc.rect(40, y - 2, 515, 16).fillColor(bg).fill();
      doc.fontSize(8).fillColor('#333')
         .text(idx + 1, 45, y)
         .text(item.product_name, 60, y, { width: 250 })
         .text(item.quantity, 320, y)
         .text(`₹${parseFloat(item.unit_price).toFixed(2)}`, 370, y)
         .text(`${item.discount_percent || 0}%`, 440, y)
         .text(`₹${parseFloat(item.amount).toFixed(2)}`, 490, y, { align: 'right', width: 60 });
      y += 18;
    });

    doc.moveTo(40, y + 5).lineTo(555, y + 5).strokeColor('#ddd').lineWidth(0.5).stroke();
    y += 15;

    const addTotal = (label, val, bold = false) => {
      doc.fontSize(bold ? 10 : 8).fillColor(bold ? '#1a1a2e' : '#333').text(label, 350, y, { align: 'right', width: 130 }).text(val, 490, y, { align: 'right', width: 60 });
      y += 15;
    };

    addTotal('Subtotal:', `₹${parseFloat(bill.subtotal || 0).toFixed(2)}`);
    if (bill.gst_amount > 0) addTotal(`GST (${bill.gst_percent}%):`, `₹${parseFloat(bill.gst_amount).toFixed(2)}`);
    addTotal('TOTAL:', `₹${parseFloat(bill.total || 0).toFixed(2)}`, true);
    
    // Signatory
    const [[creator]] = await db.query('SELECT signature_path FROM users WHERE id = ?', [bill.created_by || 1]);
    const signaturePath = company?.default_signature_path || creator?.signature_path;
    let sigY = y + 20;
    if (signaturePath) {
      const sigFile = path.join(__dirname, '..', signaturePath.replace(/^\//, ''));
      if (fs.existsSync(sigFile)) {
        doc.image(sigFile, 450, sigY, { width: 80, height: 35 });
        sigY += 40;
      } else {
        sigY += 40;
      }
    } else {
      sigY += 40;
    }
    doc.fontSize(8).fillColor('#555').text('Authorised Signatory', 400, sigY, { align: 'right', width: 145 });
    doc.end();
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: 'Failed to generate PDF: ' + err.message });
  }
});

module.exports = router;
