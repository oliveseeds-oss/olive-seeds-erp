const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, canWrite } = require('../middleware/auth');

router.get('/movements', authenticate, async (req, res) => {
  try {
    const { product_id, type, from, to } = req.query;
    let q = `
      SELECT im.*, p.name as product_name, p.sku as product_sku, u.name as created_by_name
      FROM inventory_movements im
      LEFT JOIN products p ON im.product_id=p.id
      LEFT JOIN users u ON im.created_by=u.id
      WHERE 1=1
    `;
    const params = [];
    if (product_id) { q += ' AND im.product_id=?'; params.push(product_id); }
    if (type) { q += ' AND im.movement_type=?'; params.push(type); }
    if (from) { q += ' AND DATE(im.created_at)>=?'; params.push(from); }
    if (to) { q += ' AND DATE(im.created_at)<=?'; params.push(to); }
    q += ' ORDER BY im.created_at DESC LIMIT 200';
    const [rows] = await db.query(q, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Error' });
  }
});

router.get('/stock', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.id, p.product_id, p.name, p.sku, p.product_type,
             p.stock, p.reorder_level, p.purchase_price, p.selling_price,
             p.warehouse, p.updated_at,
             c.name as category_name,
             (p.stock * p.purchase_price) as stock_value,
             CASE
               WHEN p.stock = 0 THEN 'out_of_stock'
               WHEN p.stock <= p.reorder_level THEN 'low_stock'
               ELSE 'in_stock'
             END as stock_status
      FROM products p
      LEFT JOIN categories c ON p.category_id=c.id
      WHERE p.is_active=1 AND p.deleted_at IS NULL
      ORDER BY p.stock ASC
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Error' });
  }
});

router.get('/raw-materials', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT rm.*, s.name as supplier_name FROM raw_materials rm LEFT JOIN suppliers s ON rm.supplier_id=s.id');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Error' });
  }
});

router.post('/raw-materials', authenticate, canWrite, async (req, res) => {
  try {
    const {
      name, unit, category, stock, reorder_level, maximum_stock,
      purchase_price, last_purchase_date, supplier_id, supplier_name,
      location, description, notes, is_active
    } = req.body;
    const [[{ count }]] = await db.query('SELECT COUNT(*) as count FROM raw_materials');
    const matId = `MAT${String(count + 1).padStart(4, '0')}`;
    const [r] = await db.query(
      `INSERT INTO raw_materials (
        material_id, name, unit, category, stock, reorder_level, maximum_stock,
        purchase_price, last_purchase_date, supplier_id, supplier_name,
        location, description, notes, is_active
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        matId, name, unit, category || null, parseFloat(stock || 0), parseFloat(reorder_level || 0), parseFloat(maximum_stock || 0),
        parseFloat(purchase_price || 0), last_purchase_date || null, supplier_id ? parseInt(supplier_id) : null, supplier_name || null,
        location || null, description || null, notes || null, is_active ? 1 : 0
      ]
    );
    res.json({ id: r.insertId, material_id: matId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/raw-materials/:id', authenticate, async (req, res) => {
  try {
    const {
      name, unit, category, stock, reorder_level, maximum_stock, purchase_price, last_purchase_date,
      supplier_id, supplier_name, location, description, notes, is_active
    } = req.body;
    await db.query(`
      UPDATE raw_materials SET
        name = ?, unit = ?, category = ?,
        stock = ?, reorder_level = ?, maximum_stock = ?,
        purchase_price = ?, last_purchase_date = ?,
        supplier_id = ?, supplier_name = ?,
        location = ?, description = ?, notes = ?,
        is_active = ?
      WHERE id = ?`,
      [name, unit, category, stock, reorder_level, maximum_stock,
       purchase_price, last_purchase_date, supplier_id || null, supplier_name,
       location, description, notes, is_active ? 1 : 0, req.params.id]
    );
    res.json({ message: 'Raw material updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/raw-materials/:id', authenticate, async (req, res) => {
  try {
    await db.query('DELETE FROM raw_materials WHERE id = ?', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/raw-materials/adjust', authenticate, async (req, res) => {
  try {
    const { material_id, adjustment_type, quantity, reason, notes } = req.body;
    const [[mat]] = await db.query(
      'SELECT stock FROM raw_materials WHERE id=?', [material_id]
    );
    if (!mat) return res.status(404).json({ error: 'Material not found' });
    const qty = parseFloat(quantity);
    let newStock;
    if (adjustment_type === 'add') newStock = mat.stock + qty;
    else if (adjustment_type === 'remove') newStock = Math.max(0, mat.stock - qty);
    else newStock = qty; // set exact
    await db.query(
      'UPDATE raw_materials SET stock=? WHERE id=?',
      [newStock, material_id]
    );
    res.json({ message: 'Stock adjusted', new_stock: newStock });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/adjust', authenticate, canWrite, async (req, res) => {
  try {
    const { product_id, adjustment_type, quantity, reason, notes } = req.body;
    const [[product]] = await db.query('SELECT stock FROM products WHERE id = ?', [product_id]);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const qty = parseInt(quantity);
    let newStock;
    let movementType;

    if (adjustment_type === 'add') {
      newStock = product.stock + qty;
      movementType = 'in';
    } else if (adjustment_type === 'remove') {
      newStock = product.stock - qty;
      movementType = 'out';
      if (newStock < 0) return res.status(400).json({ error: 'Insufficient stock' });
    } else if (adjustment_type === 'damage') {
      newStock = product.stock - qty;
      movementType = 'damage';
      if (newStock < 0) newStock = 0;
    } else if (adjustment_type === 'set') {
      newStock = qty;
      movementType = 'adjustment';
    } else {
      return res.status(400).json({ error: 'Invalid adjustment type' });
    }

    await db.query('UPDATE products SET stock = ? WHERE id = ?', [newStock, product_id]);
    await db.query(`
      INSERT INTO inventory_movements (product_id, movement_type, quantity, notes, created_by)
      VALUES (?, ?, ?, ?, ?)
    `, [product_id, movementType, qty, `${reason || ''}: ${notes || ''}`, req.user.id]);

    res.json({
      message: 'Stock adjusted',
      new_stock: newStock,
      previous_stock: product.stock
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
