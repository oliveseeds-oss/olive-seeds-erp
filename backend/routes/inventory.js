const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, canWrite } = require('../middleware/auth');

router.get('/movements', authenticate, async (req, res) => {
  try {
    const { product_id, type, from, to } = req.query;
    let q = 'SELECT im.*, p.name as product_name, p.sku FROM inventory_movements im LEFT JOIN products p ON im.product_id=p.id WHERE 1=1';
    const params = [];
    if (product_id) { q+=' AND im.product_id=?'; params.push(product_id); }
    if (type) { q+=' AND im.movement_type=?'; params.push(type); }
    if (from) { q+=' AND DATE(im.created_at)>=?'; params.push(from); }
    if (to) { q+=' AND DATE(im.created_at)<=?'; params.push(to); }
    q+=' ORDER BY im.created_at DESC LIMIT 200';
    const [rows] = await db.query(q, params);
    res.json(rows);
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

router.get('/low-stock', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM products WHERE stock <= reorder_level AND is_active=1 ORDER BY stock ASC');
    res.json(rows);
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

router.get('/raw-materials', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT rm.*, s.name as supplier_name FROM raw_materials rm LEFT JOIN suppliers s ON rm.supplier_id=s.id');
    res.json(rows);
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

router.post('/raw-materials', authenticate, canWrite, async (req, res) => {
  try {
    const { name, unit, stock, reorder_level, purchase_price, supplier_id, notes } = req.body;
    const [[{count}]] = await db.query('SELECT COUNT(*) as count FROM raw_materials');
    const matId = `MAT${String(count+1).padStart(4,'0')}`;
    const [r] = await db.query('INSERT INTO raw_materials (material_id, name, unit, stock, reorder_level, purchase_price, supplier_id, notes) VALUES (?,?,?,?,?,?,?,?)',
      [matId, name, unit, stock||0, reorder_level||0, purchase_price||0, supplier_id, notes]);
    res.json({ id: r.insertId, material_id: matId });
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

router.post('/adjust', authenticate, canWrite, async (req, res) => {
  try {
    const { product_id, adjustment, type, notes } = req.body;
    const [[prod]] = await db.query('SELECT stock FROM products WHERE id=?', [product_id]);
    const newStock = type==='add' ? prod.stock+parseInt(adjustment) : prod.stock-parseInt(adjustment);
    if (newStock < 0) return res.status(400).json({ error:'Insufficient stock' });
    await db.query('UPDATE products SET stock=? WHERE id=?', [newStock, product_id]);
    await db.query('INSERT INTO inventory_movements (product_id, movement_type, quantity, notes, created_by) VALUES (?,?,?,?,?)',
      [product_id, type==='add'?'in':'adjustment', Math.abs(adjustment), notes, req.user.id]);
    res.json({ message:'Stock adjusted', newStock });
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

module.exports = router;
