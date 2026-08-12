const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');

const sigDir = path.join(__dirname, '../../backend/uploads/signatures');
const compDir = path.join(__dirname, '../../backend/uploads/company');

if (!fs.existsSync(sigDir)) fs.mkdirSync(sigDir, { recursive: true });
if (!fs.existsSync(compDir)) fs.mkdirSync(compDir, { recursive: true });

router.get('/signature/:filename', authenticate, (req, res) => {
  const file = path.join(sigDir, req.params.filename);
  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: 'Signature not found' });
  }
  res.sendFile(file);
});

router.get('/logo', (req, res) => {
  const files = fs.readdirSync(compDir).filter(f => f.startsWith('logo.'));
  if (!files.length) {
    return res.status(404).json({ error: 'Logo not found' });
  }
  res.sendFile(path.join(compDir, files[0]));
});

module.exports = router;
