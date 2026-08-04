const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, canWrite } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT s.*, o.order_id, o.customer_name FROM shipments s LEFT JOIN orders o ON s.order_id=o.id ORDER BY s.created_at DESC LIMIT 100');
    res.json(rows);
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

router.post('/', authenticate, canWrite, async (req, res) => {
  try {
    const [[{count}]] = await db.query('SELECT COUNT(*) as count FROM shipments');
    const shipId = `SHP${String(count+1).padStart(5,'0')}`;
    const { order_id, courier, tracking_number, awb_number, weight, length, width, height, shipping_cost, insurance, payment_type, pickup_date, expected_delivery } = req.body;
    const [r] = await db.query('INSERT INTO shipments (shipment_id, order_id, courier, tracking_number, awb_number, weight, length, width, height, shipping_cost, insurance, payment_type, pickup_date, expected_delivery) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [shipId, order_id, courier, tracking_number, awb_number, weight, length, width, height, shipping_cost, insurance, payment_type||'prepaid', pickup_date, expected_delivery]);
    if (tracking_number || awb_number) {
      await db.query('UPDATE orders SET tracking_number=?, awb_number=?, courier=? WHERE id=?', [tracking_number, awb_number, courier, order_id]);
    }
    res.json({ id: r.insertId, shipment_id: shipId });
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

router.patch('/:id/status', authenticate, canWrite, async (req, res) => {
  try {
    await db.query('UPDATE shipments SET status=? WHERE id=?', [req.body.status, req.params.id]);
    res.json({ message:'Updated' });
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

module.exports = router;
