const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, canWrite, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.*, o.order_id as order_reference,
             o.customer_name, o.customer_phone, o.shipping_address,
             o.shipping_city, o.shipping_state, o.shipping_country
      FROM shipments s
      LEFT JOIN orders o ON s.order_id = o.id
      ORDER BY s.created_at DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Error' });
  }
});

router.post('/', authenticate, canWrite, async (req, res) => {
  try {
    const {
      order_id, courier, tracking_number, awb_number, weight, length, width, height,
      shipping_cost, insurance, payment_type, pickup_date, expected_delivery, notes,
      cod_amount, insurance_amount
    } = req.body;

    // Validate order exists using database integer id
    const [[order]] = await db.query('SELECT id, order_id, customer_name FROM orders WHERE id = ?', [order_id]);
    if (!order) {
      return res.status(400).json({ error: 'Order not found. Use the database ID, not order reference.' });
    }

    // Generate shipment_id
    const [[{ cnt }]] = await db.query('SELECT COUNT(*) as cnt FROM shipments');
    const shipment_id = `SHP${String(cnt + 1).padStart(5, '0')}`;

    // Calculate volumetric weight
    const volumetric_weight = (length && width && height) ? (length * width * height) / 5000 : 0;

    const [result] = await db.query(`
      INSERT INTO shipments (
        shipment_id, order_id, courier, tracking_number, awb_number, weight, length, width, height,
        volumetric_weight, shipping_cost, insurance, insurance_amount, cod_amount, payment_type,
        pickup_date, expected_delivery, notes
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      shipment_id, order_id, courier || 'other', tracking_number || null, awb_number || null,
      weight || null, length || null, width || null, height || null, volumetric_weight,
      shipping_cost || 0, insurance || 0, insurance_amount || 0, cod_amount || 0,
      payment_type || 'prepaid', pickup_date || null, expected_delivery || null, notes || null
    ]);

    // Update order with tracking info
    await db.query(
      `UPDATE orders SET tracking_number = ?, courier = ?, awb_number = ? WHERE id = ?`,
      [tracking_number || null, courier || null, awb_number || null, order_id]
    );

    res.json({
      id: result.insertId,
      shipment_id,
      message: 'Shipment created'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error creating shipment' });
  }
});

router.patch('/:id/status', authenticate, canWrite, async (req, res) => {
  try {
    await db.query('UPDATE shipments SET status=? WHERE id=?', [req.body.status, req.params.id]);
    res.json({ message: 'Updated' });
  } catch (e) {
    res.status(500).json({ error: 'Error' });
  }
});

router.put('/:id', authenticate, canWrite, async (req, res) => {
  try {
    const {
      courier, tracking_number, awb_number, weight, length, width, height,
      shipping_cost, insurance, insurance_amount, cod_amount, payment_type,
      pickup_date, expected_delivery, status, notes
    } = req.body;

    const [[shipment]] = await db.query('SELECT order_id FROM shipments WHERE id = ?', [req.params.id]);
    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

    const volumetric_weight = (length && width && height) ? (length * width * height) / 5000 : 0;

    await db.query(`
      UPDATE shipments SET
        courier = ?, tracking_number = ?, awb_number = ?, weight = ?, length = ?, width = ?, height = ?,
        volumetric_weight = ?, shipping_cost = ?, insurance = ?, insurance_amount = ?, cod_amount = ?,
        payment_type = ?, pickup_date = ?, expected_delivery = ?, status = ?, notes = ?
      WHERE id = ?
    `, [
      courier || 'other', tracking_number || null, awb_number || null, weight || null,
      length || null, width || null, height || null, volumetric_weight, shipping_cost || 0,
      insurance || 0, insurance_amount || 0, cod_amount || 0, payment_type || 'prepaid',
      pickup_date || null, expected_delivery || null, status || 'pending', notes || null,
      req.params.id
    ]);

    if (shipment.order_id) {
      await db.query(
        `UPDATE orders SET tracking_number = ?, courier = ?, awb_number = ? WHERE id = ?`,
        [tracking_number || null, courier || null, awb_number || null, shipment.order_id]
      );
    }

    res.json({ message: 'Shipment updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating shipment: ' + err.message });
  }
});

// Hard Delete Route (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM shipments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ error: 'Error deleting shipment' });
  }
});

module.exports = router;
