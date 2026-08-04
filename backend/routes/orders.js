const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, canWrite, canModify, logActivity } = require('../middleware/auth');

const genOrderId = async () => {
  const [[{count}]] = await db.query('SELECT COUNT(*) as count FROM orders');
  const date = new Date();
  return `OS${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(count+1).padStart(5,'0')}`;
};

// Get all orders
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, status, source, page=1, limit=50, from, to } = req.query;
    let q = 'SELECT * FROM orders WHERE 1=1';
    const p = [];
    if (search) { q += ' AND (order_id LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)'; const s=`%${search}%`; p.push(s,s,s); }
    if (status) { q += ' AND status=?'; p.push(status); }
    if (source) { q += ' AND source=?'; p.push(source); }
    if (from) { q += ' AND DATE(created_at)>=?'; p.push(from); }
    if (to) { q += ' AND DATE(created_at)<=?'; p.push(to); }
    q += ` ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${(parseInt(page)-1)*parseInt(limit)}`;
    const [orders] = await db.query(q, p);
    const [[{total}]] = await db.query('SELECT COUNT(*) as total FROM orders WHERE 1=1');
    res.json({ orders, total });
  } catch(e) { res.status(500).json({ error: 'Error fetching orders' }); }
});

// Get single order with items
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [orders] = await db.query('SELECT * FROM orders WHERE id=? OR order_id=?', [req.params.id, req.params.id]);
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    const [items] = await db.query('SELECT * FROM order_items WHERE order_id=?', [orders[0].id]);
    const [payments] = await db.query('SELECT * FROM payments WHERE order_id=?', [orders[0].id]);
    res.json({ ...orders[0], items, payments });
  } catch(e) { res.status(500).json({ error: 'Error' }); }
});

// Create order
router.post('/', authenticate, canWrite, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const orderId = await genOrderId();
    const { customer_id, customer_name, customer_email, customer_phone, billing_address, shipping_address, shipping_city, shipping_state, shipping_pincode, shipping_country, source, order_type, items, discount=0, shipping_cost=0, notes, personalization_notes, is_gst_invoice=true, is_international=false, payment_method, currency='INR', exchange_rate=1 } = req.body;

    if (!items || !items.length) { await conn.rollback(); return res.status(400).json({ error: 'No items' }); }

    // Calculate totals
    let subtotal = 0, cgst = 0, sgst = 0, igst = 0;
    const isInterstate = shipping_state && shipping_state.toLowerCase() !== 'tamil nadu';
    
    for (const item of items) {
      const itemTotal = (item.unit_price * item.quantity) - (item.discount || 0);
      subtotal += itemTotal;
      if (is_gst_invoice && !is_international) {
        const gstAmt = itemTotal * (item.gst_percent || 0) / 100;
        if (isInterstate) { igst += gstAmt; item.igst_amount = gstAmt; }
        else { cgst += gstAmt/2; sgst += gstAmt/2; item.cgst_amount=gstAmt/2; item.sgst_amount=gstAmt/2; }
      }
    }
    const total_tax = cgst + sgst + igst;
    const total = subtotal - discount + total_tax + shipping_cost;

    const [orderResult] = await conn.query(
      `INSERT INTO orders (order_id, order_type, source, customer_id, customer_name, customer_email, customer_phone, billing_address, shipping_address, shipping_city, shipping_state, shipping_pincode, shipping_country, subtotal, discount, cgst, sgst, igst, total_tax, shipping_cost, total, currency, exchange_rate, notes, personalization_notes, is_gst_invoice, is_international, payment_method, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [orderId, order_type||'regular', source||'manual', customer_id, customer_name, customer_email, customer_phone, billing_address, shipping_address, shipping_city, shipping_state, shipping_pincode, shipping_country||'India', subtotal, discount, cgst, sgst, igst, total_tax, shipping_cost, total, currency, exchange_rate, notes, personalization_notes, is_gst_invoice?1:0, is_international?1:0, payment_method, req.user.id]
    );

    for (const item of items) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, product_name, sku, hsn_code, quantity, unit_price, discount, gst_percent, cgst_amount, sgst_amount, igst_amount, total, personalization) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [orderResult.insertId, item.product_id, item.product_name, item.sku, item.hsn_code, item.quantity, item.unit_price, item.discount||0, item.gst_percent||0, item.cgst_amount||0, item.sgst_amount||0, item.igst_amount||0, (item.unit_price*item.quantity)-(item.discount||0), item.personalization]
      );
      // Deduct stock
      if (item.product_id) {
        await conn.query('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?', [item.quantity, item.product_id, item.quantity]);
        await conn.query('INSERT INTO inventory_movements (product_id, movement_type, quantity, reference_type, reference_id, notes, created_by) VALUES (?,?,?,?,?,?,?)',
          [item.product_id, 'out', item.quantity, 'order', orderResult.insertId, `Order ${orderId}`, req.user.id]);
      }
    }

    await conn.commit();
    await logActivity(req.user.id, 'CREATE_ORDER', 'orders', orderResult.insertId, null, { orderId, total }, req.ip);
    res.json({ id: orderResult.insertId, order_id: orderId, total, message: 'Order created successfully' });
  } catch(e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: 'Error creating order' });
  } finally { conn.release(); }
});

// Update order status
router.patch('/:id/status', authenticate, canWrite, async (req, res) => {
  try {
    const { status, tracking_number, courier, awb_number } = req.body;
    const validStatuses = ['pending','processing','manufacturing','engraving','qc','packing','ready','shipped','delivered','cancelled','returned','refunded'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    let q = 'UPDATE orders SET status=?';
    const p = [status];
    if (tracking_number) { q += ', tracking_number=?'; p.push(tracking_number); }
    if (courier) { q += ', courier=?'; p.push(courier); }
    if (awb_number) { q += ', awb_number=?'; p.push(awb_number); }
    if (status === 'shipped') { q += ', shipped_at=NOW()'; }
    if (status === 'delivered') { q += ', delivered_at=NOW()'; }
    q += ' WHERE id=? OR order_id=?';
    p.push(req.params.id, req.params.id);
    await db.query(q, p);
    res.json({ message: 'Status updated' });
  } catch(e) { res.status(500).json({ error: 'Error' }); }
});

// Cancel order (restore stock)
router.patch('/:id/cancel', authenticate, canModify, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [items] = await conn.query('SELECT * FROM order_items WHERE order_id=(SELECT id FROM orders WHERE id=? OR order_id=?)', [req.params.id, req.params.id]);
    for (const item of items) {
      if (item.product_id) {
        await conn.query('UPDATE products SET stock=stock+? WHERE id=?', [item.quantity, item.product_id]);
      }
    }
    await conn.query('UPDATE orders SET status="cancelled" WHERE id=? OR order_id=?', [req.params.id, req.params.id]);
    await conn.commit();
    res.json({ message: 'Order cancelled, stock restored' });
  } catch(e) { await conn.rollback(); res.status(500).json({ error: 'Error' }); }
  finally { conn.release(); }
});

module.exports = router;
