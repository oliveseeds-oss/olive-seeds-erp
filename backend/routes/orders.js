const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, requireAdmin, canWrite, canModify, logActivity } = require('../middleware/auth');

const genOrderId = async () => {
  const [[{ count }]] = await db.query('SELECT COUNT(*) as count FROM orders');
  const date = new Date();
  return `OS${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(count + 1).padStart(5, '0')}`;
};

// Get all orders
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, status, source, page = 1, limit = 50, from, to } = req.query;
    let q = `
      SELECT o.*, c.name as customer_display_name, c.email as customer_display_email, c.phone as customer_display_phone, u.name as created_by_name,
      (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as items_count
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN users u ON o.created_by = u.id
      WHERE o.deleted_at IS NULL
    `;
    const params = [];
    if (search) {
      q += ' AND (o.order_id LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ? OR c.name LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (status) {
      q += ' AND o.status=?';
      params.push(status);
    }
    if (source) {
      q += ' AND o.source=?';
      params.push(source);
    }
    if (from) {
      q += ' AND DATE(o.created_at)>=?';
      params.push(from);
    }
    if (to) {
      q += ' AND DATE(o.created_at)<=?';
      params.push(to);
    }
    q += ` ORDER BY o.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${(parseInt(page) - 1) * parseInt(limit)}`;
    const [orders] = await db.query(q, params);
    
    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM orders WHERE deleted_at IS NULL');
    res.json({ orders, total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error fetching orders' });
  }
});

// Detailed export
router.get('/export/detailed', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        o.order_id,
        o.created_at,
        o.customer_name,
        o.customer_email,
        o.status,
        o.payment_method,
        o.shipping_cost,
        o.total as order_total,
        o.tracking_number,
        o.courier,
        o.shipping_country,
        o.notes,
        oi.product_name,
        oi.quantity,
        oi.unit_price,
        oi.total as item_subtotal,
        (oi.cgst_amount + oi.sgst_amount + oi.igst_amount) as item_tax,
        oi.personalization,
        i.invoice_number
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN invoices i ON o.id = i.order_id
      WHERE o.deleted_at IS NULL
      ORDER BY o.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error' });
  }
});

// Get single order with items
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [orders] = await db.query(`
      SELECT o.*, c.name as customer_display_name, u.name as created_by_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN users u ON o.created_by = u.id
      WHERE (o.id=? OR o.order_id=?) AND o.deleted_at IS NULL
    `, [req.params.id, req.params.id]);
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    const [items] = await db.query(`
      SELECT oi.*, p.name as product_display_name, p.image_urls
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id=?
    `, [orders[0].id]);
    const [payments] = await db.query('SELECT * FROM payments WHERE order_id=?', [orders[0].id]);
    res.json({ ...orders[0], items, payments });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error' });
  }
});

// Create order
router.post('/', authenticate, canWrite, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      customer_id, customer_name, customer_email, customer_phone, billing_address, shipping_address, shipping_city,
      shipping_state, shipping_pincode, shipping_country, source, order_type, items, discount = 0, shipping_cost = 0,
      notes, personalization_notes, is_gst_invoice = true, is_international = false, payment_method, currency = 'INR',
      exchange_rate = 1, status = 'pending', payment_status = 'pending', tracking_number, courier, courier_name, awb_number,
      order_time, paid_amount = 0, personalization_text, remark, discount_percent = 0
    } = req.body;

    if (!items || !items.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'Add at least one product' });
    }

    const orderId = await genOrderId();

    // Fetch company settings to get default state
    const [[settings]] = await conn.query('SELECT state FROM company_settings LIMIT 1');
    const company_state = settings?.state || 'Tamil Nadu';

    // Calculate totals
    let subtotal = 0, cgst = 0, sgst = 0, igst = 0;
    const isInterstate = shipping_state && shipping_state.toLowerCase() !== company_state.toLowerCase();

    items.forEach(item => {
      const itemSubtotal = (item.quantity * item.unit_price) - (item.discount || 0);
      subtotal += itemSubtotal;
      if (is_gst_invoice && !is_international) {
        const tax = itemSubtotal * (item.gst_percent || 0) / 100;
        if (isInterstate) {
          igst += tax;
        } else {
          cgst += tax / 2;
          sgst += tax / 2;
        }
      }
    });

    const total_tax = cgst + sgst + igst;
    const total = subtotal - discount + total_tax + shipping_cost;
    const balance_due = total - paid_amount;

    const [orderResult] = await conn.query(
      `INSERT INTO orders (
        order_id, order_type, source, customer_id, customer_name, customer_email, customer_phone,
        billing_address, shipping_address, shipping_city, shipping_state, shipping_pincode, shipping_country,
        status, subtotal, discount, cgst, sgst, igst, total_tax, shipping_cost, total, currency,
        exchange_rate, payment_status, payment_method, notes, personalization_notes, is_gst_invoice,
        is_international, tracking_number, courier, courier_name, awb_number, order_time, paid_amount,
        balance_due, personalization_text, remark, discount_percent, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        orderId, order_type || 'regular', source || 'manual', customer_id || null, customer_name || null,
        customer_email || null, customer_phone || null, billing_address || null, shipping_address || null,
        shipping_city || null, shipping_state || null, shipping_pincode || null, shipping_country || 'India',
        status || 'pending', subtotal, discount, cgst, sgst, igst, total_tax, shipping_cost, total,
        currency || 'INR', exchange_rate || 1, payment_status || 'pending', payment_method || null, notes || null,
        personalization_notes || null, is_gst_invoice ? 1 : 0, is_international ? 1 : 0, tracking_number || null,
        courier || null, courier_name || null, awb_number || null, order_time || null, paid_amount, balance_due,
        personalization_text || null, remark || null, discount_percent, req.user.id
      ]
    );

    const newOrderId = orderResult.insertId;

    for (const item of items) {
      const itemSub = (item.quantity * item.unit_price) - (item.discount || 0);
      const tax = itemSub * (item.gst_percent || 0) / 100;
      const itemCgst = isInterstate ? 0 : tax / 2;
      const itemSgst = isInterstate ? 0 : tax / 2;
      const itemIgst = isInterstate ? tax : 0;
      const itemTotal = itemSub + tax;

      await conn.query(
        `INSERT INTO order_items (
          order_id, product_id, product_name, sku, hsn_code, quantity, unit_price, discount,
          gst_percent, cgst_amount, sgst_amount, igst_amount, total, personalization, size,
          discount_percent, subtotal
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          newOrderId, item.product_id || null, item.product_name, item.sku || null, item.hsn_code || null,
          item.quantity, item.unit_price, item.discount || 0, item.gst_percent || 0, itemCgst, itemSgst,
          itemIgst, itemTotal, item.personalization || null, item.size || null, item.discount_percent || 0, itemSub
        ]
      );

      // Deduct stock if product_id exists
      if (item.product_id) {
        await conn.query('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?', [item.quantity, item.product_id, item.quantity]);
        await conn.query(
          `INSERT INTO inventory_movements (product_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
           VALUES (?, 'out', ?, 'order', ?, ?, ?)`,
          [item.product_id, item.quantity, newOrderId, `Order ${orderId}`, req.user.id]
        );
      }
    }

    await conn.commit();
    await logActivity(req.user.id, 'CREATE_ORDER', 'orders', newOrderId, null, { orderId, total }, req.ip);
    res.json({ id: newOrderId, order_id: orderId, total, message: 'Order created successfully' });
  } catch (e) {
    await conn.rollback();
    console.error('Order create error:', e);
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// Update order status
router.patch('/:id/status', authenticate, canWrite, async (req, res) => {
  try {
    const { status, tracking_number, courier, awb_number } = req.body;
    const validStatuses = ['pending', 'processing', 'manufacturing', 'engraving', 'qc', 'packing', 'ready', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded'];
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
  } catch (e) {
    res.status(500).json({ error: 'Error' });
  }
});

// Cancel order (restore stock)
router.patch('/:id/cancel', authenticate, canModify, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[order]] = await conn.query('SELECT id FROM orders WHERE id=? OR order_id=?', [req.params.id, req.params.id]);
    if (!order) {
      await conn.rollback();
      return res.status(404).json({ error: 'Order not found' });
    }
    const [items] = await conn.query('SELECT * FROM order_items WHERE order_id=?', [order.id]);
    for (const item of items) {
      if (item.product_id) {
        await conn.query('UPDATE products SET stock=stock+? WHERE id=?', [item.quantity, item.product_id]);
        await conn.query(
          `INSERT INTO inventory_movements (product_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
           VALUES (?, 'in', ?, 'cancel', ?, 'Order Cancelled Stock Restore', ?)`,
          [item.product_id, item.quantity, order.id, req.user.id]
        );
      }
    }
    await conn.query('UPDATE orders SET status="cancelled" WHERE id=?', [order.id]);
    await conn.commit();
    res.json({ message: 'Order cancelled, stock restored' });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: 'Error' });
  } finally {
    conn.release();
  }
});

// Soft Delete Route
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await db.query('UPDATE orders SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ error: 'Error deleting order' });
  }
});

module.exports = router;
