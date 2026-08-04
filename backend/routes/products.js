const router = require('express').Router();
const db = require('../utils/db');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { authenticate, canWrite, canModify, logActivity } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads/products')),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

const genProductId = async (type) => {
  const prefix = type === 'digital' ? 'DIG' : type === 'service' ? 'SVC' : 'PHY';
  const [[{count}]] = await db.query(`SELECT COUNT(*) as count FROM products WHERE product_type=?`, [type]);
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
};

// Get all products
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, type, category, low_stock, page = 1, limit = 50 } = req.query;
    let query = 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id=c.id WHERE p.is_active=1';
    const params = [];
    if (search) { query += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR p.product_id LIKE ?)'; const s=`%${search}%`; params.push(s,s,s,s); }
    if (type) { query += ' AND p.product_type=?'; params.push(type); }
    if (category) { query += ' AND p.category_id=?'; params.push(category); }
    if (low_stock === 'true') { query += ' AND p.stock <= p.reorder_level'; }
    query += ` ORDER BY p.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${(parseInt(page)-1)*parseInt(limit)}`;
    const [products] = await db.query(query, params);
    const [[{total}]] = await db.query('SELECT COUNT(*) as total FROM products WHERE is_active=1');
    res.json({ products, total });
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

// Get product by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id=c.id WHERE p.id=? OR p.product_id=?', [req.params.id, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

// Create product
router.post('/', authenticate, canWrite, upload.array('images', 10), async (req, res) => {
  try {
    const productId = await genProductId(req.body.product_type || 'physical');
    const imagePaths = req.files ? req.files.map(f => '/uploads/products/' + f.filename).join(',') : null;
    const { name, product_type, sku, barcode, category_id, material, color, finish, size, thickness, weight, description, hsn_code, gst_percent, purchase_price, selling_price, bulk_price, bulk_min_qty, international_price, min_order, stock, reorder_level, warehouse } = req.body;
    const [result] = await db.query(
      `INSERT INTO products (product_id, name, product_type, sku, barcode, category_id, material, color, finish, size, thickness, weight, description, hsn_code, gst_percent, purchase_price, selling_price, bulk_price, bulk_min_qty, international_price, min_order, stock, reorder_level, warehouse, image_urls) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [productId, name, product_type||'physical', sku, barcode, category_id, material, color, finish, size, thickness, weight, description, hsn_code, gst_percent||18, purchase_price||0, selling_price, bulk_price, bulk_min_qty||1, international_price, min_order||1, stock||0, reorder_level||5, warehouse, imagePaths]
    );
    await logActivity(req.user.id, 'CREATE', 'products', result.insertId, null, req.body, req.ip);
    res.json({ id: result.insertId, product_id: productId, message: 'Product created' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error creating product' }); }
});

// Update product (admin only)
router.put('/:id', authenticate, canModify, async (req, res) => {
  try {
    const fields = ['name','sku','barcode','category_id','material','color','finish','size','thickness','weight','description','hsn_code','gst_percent','purchase_price','selling_price','bulk_price','international_price','min_order','stock','reorder_level','warehouse','is_active'];
    const updates = fields.filter(f=>req.body[f]!==undefined).map(f=>`${f}=?`).join(',');
    const values = fields.filter(f=>req.body[f]!==undefined).map(f=>req.body[f]);
    await db.query(`UPDATE products SET ${updates} WHERE id=?`, [...values, req.params.id]);
    res.json({ message: 'Product updated' });
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

// Adjust stock
router.post('/:id/stock', authenticate, canWrite, async (req, res) => {
  try {
    const { adjustment, type, notes } = req.body;
    const [[product]] = await db.query('SELECT stock FROM products WHERE id=?', [req.params.id]);
    const newStock = type === 'add' ? product.stock + parseInt(adjustment) : product.stock - parseInt(adjustment);
    if (newStock < 0) return res.status(400).json({ error: 'Insufficient stock' });
    await db.query('UPDATE products SET stock=? WHERE id=?', [newStock, req.params.id]);
    await db.query('INSERT INTO inventory_movements (product_id, movement_type, quantity, notes, created_by) VALUES (?,?,?,?,?)',
      [req.params.id, type === 'add' ? 'in' : 'out', Math.abs(adjustment), notes, req.user.id]);
    res.json({ message: 'Stock updated', newStock });
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

// Get categories
router.get('/meta/categories', authenticate, async (req, res) => {
  try {
    const [cats] = await db.query('SELECT * FROM categories ORDER BY name');
    res.json(cats);
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

module.exports = router;
