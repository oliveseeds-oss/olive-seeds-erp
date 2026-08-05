require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();

// Trust proxy for rate limiter
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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', time: new Date() }));

// Serve frontend in production
app.use(express.static(path.join(__dirname, '../frontend/build')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'), (err) => {
      if (err) {
        res.status(404).send("Frontend build not found. Please run 'npm run build' in the frontend folder or use the dev server at http://localhost:3000.");
      }
    });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Olive Seeds ERP running on port ${PORT}`));
