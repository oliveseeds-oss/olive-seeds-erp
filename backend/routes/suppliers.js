const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, canWrite, canModify } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const { search } = req.query;
    let q = 'SELECT * FROM suppliers WHERE is_active=1';
    const p = [];
    if (search) { q+=' AND (name LIKE ? OR gstin LIKE ?)'; const s=`%${search}%`; p.push(s,s); }
    q+=' ORDER BY name ASC';
    const [rows] = await db.query(q, p);
    res.json(rows);
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

router.post('/', authenticate, canWrite, async (req, res) => {
  try {
    const [[{count}]] = await db.query('SELECT COUNT(*) as count FROM suppliers');
    const suppId = `SUP${String(count+1).padStart(4,'0')}`;
    const { name, company_name, gstin, pan, email, phone, address, city, state, pincode, country, bank_name, bank_account, bank_ifsc, payment_terms, notes } = req.body;
    const [r] = await db.query('INSERT INTO suppliers (supplier_id, name, company_name, gstin, pan, email, phone, address, city, state, pincode, country, bank_name, bank_account, bank_ifsc, payment_terms, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        suppId,
        name !== undefined ? name : null,
        company_name !== undefined ? company_name : null,
        gstin !== undefined ? gstin : null,
        pan !== undefined ? pan : null,
        email !== undefined ? email : null,
        phone !== undefined ? phone : null,
        address !== undefined ? address : null,
        city !== undefined ? city : null,
        state !== undefined ? state : null,
        pincode !== undefined ? pincode : null,
        country || 'India',
        bank_name !== undefined ? bank_name : null,
        bank_account !== undefined ? bank_account : null,
        bank_ifsc !== undefined ? bank_ifsc : null,
        payment_terms !== undefined ? payment_terms : null,
        notes !== undefined ? notes : null
      ]);
    res.json({ id: r.insertId, supplier_id: suppId });
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

router.put('/:id', authenticate, canModify, async (req, res) => {
  try {
    const fields = ['name','company_name','gstin','pan','email','phone','address','city','state','pincode','bank_name','bank_account','bank_ifsc','payment_terms','notes'];
    const updates = fields.filter(f=>req.body[f]!==undefined).map(f=>`${f}=?`).join(',');
    const values = fields.filter(f=>req.body[f]!==undefined).map(f=>req.body[f]);
    await db.query(`UPDATE suppliers SET ${updates} WHERE id=?`, [...values, req.params.id]);
    res.json({ message:'Updated' });
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

module.exports = router;
