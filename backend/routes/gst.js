const router = require('express').Router();
const db = require('../utils/db');
const { authenticate } = require('../middleware/auth');

// GSTR-1 Summary
router.get('/gstr1', authenticate, async (req, res) => {
  try {
    const { month, year } = req.query;
    const period = `${year}-${String(month).padStart(2,'0')}`;
    const [b2b] = await db.query(`
      SELECT c.gstin, c.name as customer_name, o.invoice_number, o.total, o.cgst, o.sgst, o.igst, o.total_tax
      FROM orders o LEFT JOIN customers c ON o.customer_id=c.id
      WHERE DATE_FORMAT(o.created_at,'%Y-%m')=? AND o.is_gst_invoice=1 AND c.gstin IS NOT NULL AND c.gstin!=''
      AND o.status NOT IN ('cancelled','returned')`, [period]);
    const [b2c] = await db.query(`
      SELECT SUM(o.subtotal) as taxable, SUM(o.cgst) as cgst, SUM(o.sgst) as sgst, SUM(o.igst) as igst, SUM(o.total_tax) as tax
      FROM orders o LEFT JOIN customers c ON o.customer_id=c.id
      WHERE DATE_FORMAT(o.created_at,'%Y-%m')=? AND o.is_gst_invoice=1 AND (c.gstin IS NULL OR c.gstin='')
      AND o.status NOT IN ('cancelled','returned')`, [period]);
    const [[totals]] = await db.query(`
      SELECT SUM(subtotal) as taxable, SUM(cgst) as cgst, SUM(sgst) as sgst, SUM(igst) as igst, SUM(total_tax) as tax
      FROM orders WHERE DATE_FORMAT(created_at,'%Y-%m')=? AND is_gst_invoice=1 AND status NOT IN ('cancelled','returned')`, [period]);
    res.json({ period, b2b, b2c: b2c[0], totals });
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

// GSTR-3B Summary
router.get('/gstr3b', authenticate, async (req, res) => {
  try {
    const { month, year } = req.query;
    const period = `${year}-${String(month).padStart(2,'0')}`;
    const [[sales]] = await db.query(`
      SELECT SUM(subtotal) as taxable, SUM(cgst) as cgst, SUM(sgst) as sgst, SUM(igst) as igst, SUM(total_tax) as tax
      FROM orders WHERE DATE_FORMAT(created_at,'%Y-%m')=? AND is_gst_invoice=1 AND status NOT IN ('cancelled','returned')`, [period]);
    const [[purchases]] = await db.query(`
      SELECT SUM(gst_amount) as input_tax FROM expenses WHERE DATE_FORMAT(expense_date,'%Y-%m')=?`, [period]);
    const netTax = (sales?.tax||0) - (purchases?.input_tax||0);
    res.json({ period, outward: sales, input_credit: purchases?.input_tax||0, net_tax_payable: netTax });
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

// HSN Summary
router.get('/hsn', authenticate, async (req, res) => {
  try {
    const { month, year } = req.query;
    const period = `${year}-${String(month).padStart(2,'0')}`;
    const [rows] = await db.query(`
      SELECT oi.hsn_code, SUM(oi.quantity) as qty, SUM(oi.total) as taxable,
      SUM(oi.cgst_amount) as cgst, SUM(oi.sgst_amount) as sgst, SUM(oi.igst_amount) as igst
      FROM order_items oi JOIN orders o ON oi.order_id=o.id
      WHERE DATE_FORMAT(o.created_at,'%Y-%m')=? AND o.is_gst_invoice=1 AND o.status NOT IN ('cancelled','returned')
      GROUP BY oi.hsn_code`, [period]);
    res.json(rows);
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

module.exports = router;
