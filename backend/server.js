require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const compression = require('compression');
app.use(compression());

app.set('trust proxy', 1);

// Security
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

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

// Run database migrations on startup
require('./utils/migrate')();

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', time: new Date() }));

// Serve frontend in production
app.use(express.static(path.join(__dirname, '../frontend/build')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Olive Seeds ERP running on port ${PORT}`));
