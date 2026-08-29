const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, canWrite, canModify, logActivity } = require('../middleware/auth');

// Generate customer ID
const genCustomerId = async () => {
  const [[{ count }]] = await db.query('SELECT COUNT(*) as count FROM customers');
  return `CUST${String(count + 1).padStart(4, '0')}`;
};

// Get all customers
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, type, page = 1, limit = 50 } = req.query;
    let query = 'SELECT * FROM customers WHERE is_active = 1';
    const params = [];
    if (search) {
      query += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR customer_id LIKE ? OR company_name LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }
    if (type) {
      query += ' AND customer_type = ?';
      params.push(type);
    }
    query += ` ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${(parseInt(page) - 1) * parseInt(limit)}`;
    const [customers] = await db.query(query, params);
    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM customers WHERE is_active = 1');
    res.json({ customers, total, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching customers' });
  }
});

// Get single customer
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [customers] = await db.query('SELECT * FROM customers WHERE (id = ? OR customer_id = ?)', [req.params.id, req.params.id]);
    if (!customers.length) return res.status(404).json({ error: 'Customer not found' });
    const [orders] = await db.query('SELECT order_id, total, status, created_at FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 20', [customers[0].id]);
    res.json({ ...customers[0], orders });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// Create customer
router.post('/', authenticate, canWrite, async (req, res) => {
  try {
    const customerId = await genCustomerId();
    const {
      name, customer_type, company_name, gstin, pan, email, phone, alt_phone, billing_address,
      billing_city, billing_state, billing_pincode, billing_country, shipping_address, shipping_city,
      shipping_state, shipping_pincode, shipping_country, currency, language, customer_group,
      credit_limit, outstanding_balance, notes, alternate_phone
    } = req.body;

    const [result] = await db.query(
      `INSERT INTO customers (
        customer_id, customer_type, name, company_name, gstin, pan, email, phone, alt_phone,
        billing_address, billing_city, billing_state, billing_pincode, billing_country,
        shipping_address, shipping_city, shipping_state, shipping_pincode, shipping_country,
        currency, customer_group, credit_limit, outstanding_balance, notes, is_active
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      [
        customerId, customer_type || 'personal', name, company_name || null, gstin || null, pan || null,
        email || null, phone || null, alt_phone || null, billing_address || null, billing_city || null,
        billing_state || null, billing_pincode || null, billing_country || 'India', shipping_address || null,
        shipping_city || null, shipping_state || null, shipping_pincode || null, shipping_country || 'India',
        currency || 'INR', customer_group || null, credit_limit || 0,
        outstanding_balance || 0, notes || null
      ]
    );
    await logActivity(req.user.id, 'CREATE', 'customers', result.insertId, null, req.body, req.ip);
    res.json({ id: result.insertId, customer_id: customerId, message: 'Customer created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating customer' });
  }
});

// Update customer
router.put('/:id', authenticate, canModify, async (req, res) => {
  try {
    const [old] = await db.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    const fields = [
      'name', 'customer_type', 'company_name', 'gstin', 'pan', 'email', 'phone', 'alt_phone',
      'billing_address', 'billing_city', 'billing_state', 'billing_pincode', 'billing_country',
      'shipping_address', 'shipping_city', 'shipping_state', 'shipping_pincode', 'shipping_country',
      'currency', 'language', 'customer_group', 'credit_limit', 'outstanding_balance', 'notes',
      'is_active', 'alternate_phone'
    ];
    const updates = fields.filter(f => req.body[f] !== undefined).map(f => `${f}=?`).join(',');
    const values = fields.filter(f => req.body[f] !== undefined).map(f => req.body[f]);
    if (!updates) return res.status(400).json({ error: 'No fields to update' });
    await db.query(`UPDATE customers SET ${updates} WHERE id = ?`, [...values, req.params.id]);
    await logActivity(req.user.id, 'UPDATE', 'customers', req.params.id, old[0], req.body, req.ip);
    res.json({ message: 'Customer updated' });
  } catch (err) {
    res.status(500).json({ error: 'Error updating customer' });
  }
});

// Soft Delete (admin only)
router.delete('/:id', authenticate, canModify, async (req, res) => {
  try {
    await db.query('UPDATE customers SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
    await logActivity(req.user.id, 'DELETE', 'customers', req.params.id, null, null, req.ip);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting customer' });
  }
});

module.exports = router;
