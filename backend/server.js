const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const compression = require('compression');
app.use(compression());

app.set('trust proxy', 1);

// Security
app.use(helmet({ 
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
const allowedOrigins = [
  'https://billapp.oliveseedsdesignstudio.com',
  'https://www.billapp.oliveseedsdesignstudio.com',
  'https://apiapp.oliveseedsdesignstudio.com',
  'https://adminosspanel.oliveseedsdesignstudio.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const domainMatch = origin.endsWith('.oliveseedsdesignstudio.com') || origin === 'https://oliveseedsdesignstudio.com';
    if (allowedOrigins.indexOf(origin) !== -1 || domainMatch) {
      return callback(null, true);
    }
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }
    // Also allow wildcard if FRONTEND_URL is not set or is "*"
    if (!process.env.FRONTEND_URL || process.env.FRONTEND_URL === '*') {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url} - body keys: ${Object.keys(req.body || {})}`);
  next();
});
// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use('/api/', limiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d'
}));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/shipping', require('./routes/shipping'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/gst', require('./routes/gst'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/bulk', require('./routes/bulk'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/users', require('./routes/users'));
app.use('/api/changes', require('./routes/changes'));
app.use('/api/digital-invoices', require('./routes/digital-invoices'));
app.use('/api/quick-bill', require('./routes/quick_bill'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/files', require('./routes/files'));
app.use('/api/quotations', require('./routes/quotations'));
app.use('/api/import-export', require('./routes/importExport'));
app.use('/api/categories', require('./routes/categories'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', time: new Date() }));

// Serve frontend in production
const buildPath = path.join(__dirname, '../frontend/build');
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  // API 404 Handler - MUST be before the generic '*' handler
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });
  // Fallback for React Router
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(buildPath, 'index.html'));
    }
  });
} else {
  // API 404 Handler when no frontend build exists
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });
}

// Run migrations FIRST, then start server
const PORT = process.env.PORT || 5001;
const runMigrations = require('./utils/migrate');
(async () => {
  try {
    await runMigrations();
  } catch (err) {
    console.error('Migration failed, starting anyway:', err.message);
  }
  app.listen(PORT, () => console.log(`Olive Seeds ERP running on port ${PORT}`));
})();
