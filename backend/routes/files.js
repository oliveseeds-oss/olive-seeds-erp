const router = require('express').Router();
const path = require('path');
const fs = require('fs');

// Base uploads directory — works in Docker
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join('/app', 'uploads');

router.get('/logo', (req, res) => {
  const companyDir = path.join(UPLOADS_DIR, 'company');
  
  // Try each extension
  const extensions = ['png', 'jpg', 'jpeg', 'svg', 'webp'];
  for (const ext of extensions) {
    const filePath = path.join(companyDir, `logo.${ext}`);
    if (fs.existsSync(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.sendFile(filePath);
    }
  }

  // Try any file starting with "logo"
  try {
    if (fs.existsSync(companyDir)) {
      const files = fs.readdirSync(companyDir);
      const logoFile = files.find(f => f.toLowerCase().startsWith('logo'));
      if (logoFile) {
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.sendFile(path.join(companyDir, logoFile));
      }
    }
  } catch (e) {
    console.error('Logo dir error:', e.message);
  }

  return res.status(404).json({ error: 'No logo uploaded' });
});

router.get('/signature/:name', (req, res) => {
  const name = req.params.name;
  
  // Security check — only allow safe filenames
  if (!/^[a-zA-Z0-9_\-]+$/.test(name)) {
    return res.status(400).json({ error: 'Invalid name' });
  }

  // If default, look in uploads/company, otherwise uploads/signatures
  const targetDir = name === 'default'
    ? path.join(UPLOADS_DIR, 'company')
    : path.join(UPLOADS_DIR, 'signatures');
    
  // If default, filename is "signature", otherwise it's the requested name (e.g. user_1)
  const targetName = name === 'default' ? 'signature' : name;

  const extensions = ['png', 'jpg', 'jpeg'];
  for (const ext of extensions) {
    const filePath = path.join(targetDir, `${targetName}.${ext}`);
    if (fs.existsSync(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.sendFile(filePath);
    }
  }

  // Try without extension
  const noExt = path.join(targetDir, targetName);
  if (fs.existsSync(noExt)) {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.sendFile(noExt);
  }

  return res.status(404).json({ error: 'Signature not found' });
});

module.exports = router;
