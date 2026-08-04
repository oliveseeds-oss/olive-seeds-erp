const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
module.exports = router;
router.get('/', authenticate, async (req, res) => {
  try { const [[s]] = await db.query('SELECT * FROM company_settings LIMIT 1'); res.json(s||{}); }
  catch(e) { res.status(500).json({ error:'Error' }); }
});
router.put('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const fields = ['company_name','gstin','pan','iec','email','phone','address','city','state','pincode','country','invoice_prefix','currency','bank_name','bank_account','bank_ifsc','bank_branch','upi_id','terms_conditions','invoice_footer'];
    const updates = fields.filter(f=>req.body[f]!==undefined).map(f=>`${f}=?`).join(',');
    const values = fields.filter(f=>req.body[f]!==undefined).map(f=>req.body[f]);
    await db.query(`UPDATE company_settings SET ${updates}`, values);
    res.json({ message:'Settings saved' });
  } catch(e) { res.status(500).json({ error:'Error' }); }
});
