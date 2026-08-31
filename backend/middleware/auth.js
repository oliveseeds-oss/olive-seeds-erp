const jwt = require('jsonwebtoken');
const db = require('../utils/db');

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [users] = await db.query('SELECT id, user_id, name, email, role, is_active FROM users WHERE id = ?', [decoded.id]);
    
    if (!users.length || !users[0].is_active) {
      return res.status(401).json({ error: 'Invalid or inactive user' });
    }
    
    req.user = users[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role?.toLowerCase() !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const requireAdminOrEmployee = (req, res, next) => {
  const role = req.user.role?.toLowerCase();
  if (!['admin', 'employee'].includes(role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

const canWrite = (req, res, next) => {
  if (req.user.role?.toLowerCase() === 'viewer') {
    return res.status(403).json({ error: 'Viewer role cannot make changes' });
  }
  next();
};

const canModify = (req, res, next) => {
  const role = req.user.role?.toLowerCase();
  if (role === 'employee') {
    return res.status(403).json({ 
      error: 'Employee cannot modify existing records. Please submit a change request.',
      requiresChangeRequest: true
    });
  }
  if (role === 'viewer') {
    return res.status(403).json({ error: 'Viewer role cannot make changes' });
  }
  next();
};

const logActivity = async (userId, action, module, recordId, oldVal, newVal, ip) => {
  try {
    await db.query(
      'INSERT INTO activity_log (user_id, action, module, record_id, old_value, new_value, ip_address) VALUES (?,?,?,?,?,?,?)',
      [userId, action, module, recordId, oldVal ? JSON.stringify(oldVal) : null, newVal ? JSON.stringify(newVal) : null, ip]
    );
  } catch (e) { /* silent fail */ }
};

module.exports = { authenticate, requireAdmin, requireAdminOrEmployee, canWrite, canModify, logActivity };
