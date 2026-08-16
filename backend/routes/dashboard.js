const router = require('express').Router();
const db = require('../utils/db');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.substring(0, 7) + '-01';

    const [[todaySales]] = await db.query(`SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM orders WHERE DATE(created_at)=? AND status NOT IN ('cancelled','returned')`, [today]);
    const [[monthRevenue]] = await db.query(`SELECT COALESCE(SUM(total),0) as total FROM orders WHERE created_at >= ? AND status NOT IN ('cancelled','returned')`, [monthStart]);
    const [[pendingOrders]] = await db.query(`SELECT COUNT(*) as count FROM orders WHERE status IN ('pending','processing','manufacturing','engraving','qc')`, []);
    const [[readyToShip]] = await db.query(`SELECT COUNT(*) as count FROM orders WHERE status = 'ready'`, []);
    const [[lowStock]] = await db.query(`SELECT COUNT(*) as count FROM products WHERE stock <= reorder_level AND stock > 0 AND is_active=1`, []);
    const [[outOfStock]] = await db.query(`SELECT COUNT(*) as count FROM products WHERE stock = 0 AND is_active=1`, []);
    const [[pendingPayments]] = await db.query(`SELECT COALESCE(SUM(total - paid_amount),0) as total FROM invoices WHERE payment_status IN ('pending','partial') AND deleted_at IS NULL`, []);
    const [[monthGST]] = await db.query(`SELECT COALESCE(SUM(total_tax),0) as total FROM orders WHERE created_at >= ? AND status NOT IN ('cancelled','returned') AND is_gst_invoice=1`, [monthStart]);
    const [[monthProfit]] = await db.query(`
      SELECT COALESCE(SUM(o.total),0) - COALESCE((SELECT SUM(amount) FROM expenses WHERE expense_date >= ?),0) as profit
      FROM orders o WHERE o.created_at >= ? AND o.status NOT IN ('cancelled','returned')
    `, [monthStart, monthStart]);

    const [salesGraph] = await db.query(`
      SELECT DATE(created_at) as date, SUM(total) as total 
      FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND status NOT IN ('cancelled','returned')
      GROUP BY DATE(created_at) ORDER BY date ASC
    `);

    const [topProducts] = await db.query(`
      SELECT oi.product_name, SUM(oi.quantity) as qty, SUM(oi.total) as revenue
      FROM order_items oi JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= ? AND o.status NOT IN ('cancelled','returned')
      GROUP BY oi.product_name ORDER BY qty DESC LIMIT 10
    `, [monthStart]);

    const [sourceSales] = await db.query(`
      SELECT source, COUNT(*) as orders, SUM(total) as revenue
      FROM orders WHERE created_at >= ? AND status NOT IN ('cancelled','returned')
      GROUP BY source
    `, [monthStart]);

    const [recentOrders] = await db.query(`
      SELECT order_id, customer_name, total, status, source, created_at
      FROM orders ORDER BY created_at DESC LIMIT 10
    `);

    const [countrySales] = await db.query(`
      SELECT shipping_country as country, COUNT(*) as orders, SUM(total) as revenue
      FROM orders WHERE created_at >= ? AND is_international=1
      GROUP BY shipping_country ORDER BY revenue DESC
    `, [monthStart]);

    res.json({
      todaySales: todaySales.total,
      todayOrders: todaySales.count,
      monthRevenue: monthRevenue.total,
      pendingOrders: pendingOrders.count,
      readyToShip: readyToShip.count,
      lowStock: lowStock.count,
      outOfStock: outOfStock.count,
      pendingPayments: pendingPayments.total,
      monthGST: monthGST.total,
      monthProfit: monthProfit.profit || 0,
      salesGraph,
      topProducts,
      sourceSales,
      recentOrders,
      countrySales
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Dashboard error' });
  }
});

module.exports = router;
