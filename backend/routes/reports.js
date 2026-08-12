const router = require('express').Router();
const db = require('../utils/db');
const { authenticate } = require('../middleware/auth');

router.get('/sales', authenticate, async (req, res) => {
  try {
    const { from, to, group_by='day' } = req.query;
    const fmt = group_by==='month' ? '%Y-%m' : group_by==='year' ? '%Y' : '%Y-%m-%d';
    const [rows] = await db.query(`
      SELECT DATE_FORMAT(created_at,'${fmt}') as period, COUNT(*) as orders,
      COALESCE(SUM(total), 0) as revenue, COALESCE(SUM(total_tax), 0) as tax, COALESCE(SUM(discount), 0) as discount
      FROM orders WHERE status NOT IN ('cancelled','returned')
      ${from?`AND DATE(created_at)>='${from}'`:''} ${to?`AND DATE(created_at)<='${to}'`:''}
      GROUP BY period ORDER BY period ASC`);
    res.json(rows);
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

router.get('/products', authenticate, async (req, res) => {
  try {
    const { from, to } = req.query;
    const [rows] = await db.query(`
      SELECT oi.product_name, oi.sku, SUM(oi.quantity) as qty_sold, SUM(oi.total) as revenue
      FROM order_items oi JOIN orders o ON oi.order_id=o.id
      WHERE o.status NOT IN ('cancelled','returned')
      ${from?`AND DATE(o.created_at)>='${from}'`:''} ${to?`AND DATE(o.created_at)<='${to}'`:''}
      GROUP BY oi.product_name, oi.sku ORDER BY qty_sold DESC LIMIT 100`);
    res.json(rows);
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

router.get('/customers', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.customer_id, c.name, c.email, c.customer_type, COUNT(o.id) as orders, SUM(o.total) as spent
      FROM customers c LEFT JOIN orders o ON c.id=o.customer_id AND o.status NOT IN ('cancelled','returned')
      GROUP BY c.id ORDER BY spent DESC LIMIT 100`);
    res.json(rows);
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

router.get('/marketplace', authenticate, async (req, res) => {
  try {
    const { from, to } = req.query;
    const [rows] = await db.query(`
      SELECT source, COUNT(*) as orders, SUM(total) as revenue
      FROM orders WHERE status NOT IN ('cancelled','returned')
      ${from?`AND DATE(created_at)>='${from}'`:''} ${to?`AND DATE(created_at)<='${to}'`:''}
      GROUP BY source ORDER BY revenue DESC`);
    res.json(rows);
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

router.get('/profit', authenticate, async (req, res) => {
  try {
    const { from, to } = req.query;
    const [[rev]] = await db.query(`SELECT COALESCE(SUM(total), 0) as revenue, COALESCE(SUM(total_tax), 0) as tax FROM orders WHERE status NOT IN ('cancelled','returned') ${from?`AND DATE(created_at)>='${from}'`:''} ${to?`AND DATE(created_at)<='${to}'`:''}`);
    const [[exp]] = await db.query(`SELECT COALESCE(SUM(amount), 0) as expenses FROM expenses ${from?`WHERE expense_date>='${from}'`:''} ${to?`${from?'AND':'WHERE'} expense_date<='${to}'`:''}`);
    const [[cogs]] = await db.query(`SELECT COALESCE(SUM(p.purchase_price*oi.quantity), 0) as cogs FROM order_items oi JOIN products p ON oi.product_id=p.id JOIN orders o ON oi.order_id=o.id WHERE o.status NOT IN ('cancelled','returned') ${from?`AND DATE(o.created_at)>='${from}'`:''} ${to?`AND DATE(o.created_at)<='${to}'`:''}`);
    
    const revenue = parseFloat(rev?.revenue || 0);
    const tax = parseFloat(rev?.tax || 0);
    const expenses = parseFloat(exp?.expenses || 0);
    const cogsVal = parseFloat(cogs?.cogs || 0);
    
    res.json({
      revenue,
      tax,
      expenses,
      cogs: cogsVal,
      gross_profit: revenue - cogsVal,
      net_profit: revenue - cogsVal - expenses
    });
  } catch(e) { 
    console.error(e);
    res.status(500).json({ error: 'Error calculating profit report' }); 
  }
});

router.get('/inventory', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT product_id, name, sku, stock, reorder_level, purchase_price, selling_price, (stock*purchase_price) as stock_value FROM products WHERE is_active=1 ORDER BY stock ASC`);
    res.json(rows);
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

router.get('/country', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT shipping_country, COUNT(*) as orders, SUM(total) as revenue FROM orders WHERE status NOT IN ('cancelled','returned') GROUP BY shipping_country ORDER BY revenue DESC`);
    res.json(rows);
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

module.exports = router;
