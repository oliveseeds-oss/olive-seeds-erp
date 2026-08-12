const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, canWrite } = require('../middleware/auth');

// Get all digital invoices
router.get('/', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM digital_invoices ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching digital invoices' });
  }
});

// Create digital invoice
router.post('/', authenticate, canWrite, async (req, res) => {
  try {
    const { customer_name, customer_email, product_name, download_link, license_key, price, payment_status } = req.body;
    const invoiceNumber = `DIG-INV-${Date.now()}`;
    const [result] = await db.query(
      `INSERT INTO digital_invoices (invoice_number, customer_name, customer_email, product_name, download_link, license_key, price, payment_status) VALUES (?,?,?,?,?,?,?,?)`,
      [
        invoiceNumber,
        customer_name || 'Walk-in Customer',
        customer_email || null,
        product_name || '',
        download_link || null,
        license_key || null,
        price || 0,
        payment_status || 'completed'
      ]
    );
    res.json({ id: result.insertId, invoice_number: invoiceNumber, message: 'Digital invoice created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating digital invoice' });
  }
});

module.exports = router;
