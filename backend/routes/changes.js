const router = require('express').Router();
const db = require('../utils/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const where = req.user.role !== 'admin' ? 'WHERE cr.requested_by=?' : 'WHERE 1=1';
    const params = req.user.role !== 'admin' ? [req.user.id] : [];
    const [rows] = await db.query(`SELECT cr.*, u.name as requester_name FROM change_requests cr LEFT JOIN users u ON cr.requested_by=u.id ${where} ORDER BY cr.created_at DESC`, params);
    res.json(rows);
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { module, record_id, field_name, current_value, requested_value, reason, change_type, priority, attachment_path } = req.body;
    const [r] = await db.query(
      `INSERT INTO change_requests (
        requested_by, module, record_id, field_name, current_value, requested_value, reason,
        change_type, priority, attachment_path
      ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [req.user.id, module, record_id, field_name, current_value, requested_value, reason, change_type || null, priority || 'medium', attachment_path || null]
    );
    res.json({ id: r.insertId, message: 'Change request submitted to admin' });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Error: ' + e.message });
  }
});

router.patch('/:id/approve', authenticate, requireAdmin, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [reqs] = await conn.query('SELECT * FROM change_requests WHERE id=?', [req.params.id]);
    if (!reqs.length) {
      conn.release();
      return res.status(404).json({ error: 'Not found' });
    }
    const cr = reqs[0];
    await conn.query(`UPDATE \`${cr.module}\` SET \`${cr.field_name}\` = ? WHERE id = ?`, [cr.requested_value, cr.record_id]);
    await conn.query('UPDATE change_requests SET status="approved", reviewed_by=?, reviewed_at=NOW(), review_notes=? WHERE id=?', [req.user.id, req.body.notes || null, req.params.id]);
    await conn.commit();
    res.json({ message: 'Change approved and applied' });
  } catch(e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: 'Error: ' + e.message });
  } finally {
    conn.release();
  }
});

router.patch('/:id/reject', authenticate, requireAdmin, async (req, res) => {
  try {
    await db.query('UPDATE change_requests SET status="rejected", reviewed_by=?, reviewed_at=NOW(), review_notes=? WHERE id=?', [req.user.id, req.body.notes || null, req.params.id]);
    res.json({ message: 'Change request rejected' });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Error: ' + e.message });
  }
});

router.get('/activity', authenticate, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT al.*, u.name as user_name FROM activity_log al LEFT JOIN users u ON al.user_id=u.id ORDER BY al.created_at DESC LIMIT 200');
    res.json(rows);
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

module.exports = router;
