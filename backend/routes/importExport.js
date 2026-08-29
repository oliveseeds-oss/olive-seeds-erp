const router = require('express').Router();
const db = require('../utils/db');
const { authenticate } = require('../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const upload = multer({
  dest: path.join(__dirname, '../uploads/import/'),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

// ── TEMPLATE DOWNLOAD ──────────────────────────────
router.get('/template/:entity', authenticate, (req, res) => {
  try {
    const entity = req.params.entity;
    const templates = {
      customers: {
        headers: ['Name*','Email','Phone','Alt Phone','Company Name',
          'GSTIN','PAN','Type','Billing Address','Billing City',
          'Billing State','Billing Pincode','Billing Country',
          'Shipping Address','Shipping City','Shipping State',
          'Shipping Pincode','Shipping Country','Currency',
          'Customer Group','Credit Limit','Notes'],
        sample: ['John Doe','john@email.com','9876543210','',
          'ABC Corp','33XXXXX','ABCDE1234F','personal',
          '123 Main St','Chennai','Tamil Nadu','600001','India',
          '','','','','India','INR','Regular','0','Regular customer']
      },
      products: {
        headers: ['Name*','Type','Category','SKU','Barcode',
          'HSN Code','GST%','Purchase Price','Selling Price*',
          'Bulk Price','Min Order','Current Stock','Reorder Level',
          'Material','Color','Finish','Size','Weight','Description'],
        sample: ['Acrylic Name Board','physical','Engraved Products',
          'ACR-001','','392690','18','200','500',
          '400','1','50','10',
          'Acrylic','Clear','Glossy','A4','0.2','Custom engraved board']
      },
      orders: {
        headers: ['Customer Name*','Customer Email','Customer Phone',
          'Product Name*','Size','Quantity*','Unit Price*',
          'Discount%','GST%','Shipping Fee','Payment Mode',
          'Source','Shipping Address','City','State','Pincode',
          'Country','Personalization','Remark'],
        sample: ['John Doe','john@email.com','9876543210',
          'Acrylic Board','A4','2','500',
          '0','18','50','upi',
          'website','123 Main St','Chennai','Tamil Nadu','600001',
          'India','Engrave: JOHN','Gift item']
      },
      expenses: {
        headers: ['Date*','Category*','Vendor','Description',
          'Amount*','GST Amount','Payment Method','Reference Number','Notes'],
        sample: ['2025-01-25','Raw Materials','Supplier Name',
          'Acrylic sheets purchase','5000','0','cash','','Monthly stock']
      },
      suppliers: {
        headers: ['Name*','Company Name','GSTIN','PAN','Email',
          'Phone','Address','City','State','Pincode','Country',
          'Bank Name','Account No','IFSC','Payment Terms','Notes'],
        sample: ['ABC Suppliers','ABC Pvt Ltd','33XXXXX','ABCDE1234F',
          'supplier@email.com','9876543210','123 Street','Chennai',
          'Tamil Nadu','600001','India','HDFC Bank','12345678','HDFC0001','Net 30','']
      }
    };

    const tmpl = templates[entity];
    if (!tmpl) {
      return res.status(400).json({ error: 'Unknown entity: ' + entity });
    }

    const wb = XLSX.utils.book_new();
    const data = [
      tmpl.headers,
      tmpl.headers.map(h => h.includes('*') ? 'REQUIRED' : 'Optional'),
      tmpl.sample
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = tmpl.headers.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${entity}_template.xlsx"`);
    res.send(buf);
  } catch (err) {
    console.error('Template error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── EXPORT DATA ──────────────────────────────────────
router.get('/export/:entity', authenticate, async (req, res) => {
  try {
    const { from, to, format = 'xlsx' } = req.query;
    const entity = req.params.entity;

    const tableMap = {
      customers: 'customers',
      products: 'products',
      orders: 'orders',
      invoices: 'invoices',
      payments: 'payments',
      expenses: 'expenses',
      suppliers: 'suppliers',
      shipments: 'shipments',
      quotations: 'quotations'
    };

    const table = tableMap[entity];
    if (!table) return res.status(400).json({ error: 'Unknown entity' });

    let query = `SELECT * FROM \`${table}\` WHERE 1=1`;

    const params = [];
    if (from) { query += ' AND DATE(created_at) >= ?'; params.push(from); }
    if (to) { query += ' AND DATE(created_at) <= ?'; params.push(to); }
    query += ' ORDER BY id DESC';

    const [rows] = await db.query(query, params);
    const dateStr = new Date().toISOString().slice(0,10);
    const filename = `${entity}_export_${dateStr}`;

    if (format === 'csv') {
      if (rows.length === 0) {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        return res.send('\uFEFF' + 'No data found for selected period');
      }
      const headers = Object.keys(rows[0]).join(',');
      const csvRows = rows.map(row =>
        Object.values(row).map(val => {
          if (val === null || val === undefined) return '';
          const s = String(val);
          return (s.includes(',') || s.includes('"') || s.includes('\n'))
            ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(',')
      );
      const csv = '\uFEFF' + [headers, ...csvRows].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csv);
    }

    // Excel
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{}]);
    XLSX.utils.book_append_sheet(wb, ws, entity);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    res.send(buf);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── IMPORT DATA ──────────────────────────────────────
router.post('/upload/:entity', authenticate, upload.single('file'), async (req, res) => {
  try {
    const entity = req.params.entity;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const wb = XLSX.readFile(req.file.path);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    // Remove template description row if present
    const dataRows = rows.filter((row, i) => {
      const values = Object.values(row);
      const isDescRow = values.some(v =>
        String(v).toUpperCase() === 'REQUIRED' ||
        String(v).toUpperCase() === 'OPTIONAL'
      );
      return !isDescRow;
    });

    if (dataRows.length === 0) {
      return res.status(400).json({ error: 'No data rows found in file' });
    }

    let created = 0;
    let failed = 0;
    const errors = [];

    for (const row of dataRows) {
      try {
        if (entity === 'customers') {
          await db.query(`
            INSERT INTO customers 
            (name, email, phone, alt_phone, company_name, gstin, pan,
             customer_type, billing_address, billing_city, billing_state,
             billing_pincode, billing_country, currency, customer_group,
             credit_limit, notes)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [row['Name*'] || row['Name'], row['Email'],
             row['Phone'], row['Alt Phone'],
             row['Company Name'], row['GSTIN'], row['PAN'],
             row['Type'] || 'personal',
             row['Billing Address'], row['Billing City'],
             row['Billing State'], row['Billing Pincode'],
             row['Billing Country'] || 'India',
             row['Currency'] || 'INR',
             row['Customer Group'],
             parseFloat(row['Credit Limit'] || 0),
             row['Notes']]
          );
          created++;
        } else if (entity === 'products') {
          await db.query(`
            INSERT INTO products 
            (name, product_type, sku, barcode, hsn_code, gst_percent,
             purchase_price, selling_price, bulk_price, min_order,
             stock, reorder_level, material, color, finish, size,
             weight, description)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [row['Name*'] || row['Name'],
             row['Type'] || 'physical',
             row['SKU'], row['Barcode'],
             row['HSN Code'],
             parseFloat(row['GST%'] || 18),
             parseFloat(row['Purchase Price'] || 0),
             parseFloat(row['Selling Price*'] || row['Selling Price'] || 0),
             parseFloat(row['Bulk Price'] || 0),
             parseInt(row['Min Order'] || 1),
             parseInt(row['Current Stock'] || 0),
             parseInt(row['Reorder Level'] || 5),
             row['Material'], row['Color'],
             row['Finish'], row['Size'],
             parseFloat(row['Weight'] || 0),
             row['Description']]
          );
          created++;
        } else if (entity === 'expenses') {
          await db.query(`
            INSERT INTO expenses 
            (category, vendor, description, amount, gst_amount,
             expense_date, payment_method, reference_number, notes, created_by)
            VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [row['Category*'] || row['Category'],
             row['Vendor'],
             row['Description'],
             parseFloat(row['Amount*'] || row['Amount'] || 0),
             parseFloat(row['GST Amount'] || 0),
             row['Date*'] || row['Date'] || new Date().toISOString().split('T')[0],
             row['Payment Method'] || 'cash',
             row['Reference Number'],
             row['Notes'],
             req.user.id]
          );
          created++;
        }
      } catch (rowErr) {
        failed++;
        errors.push(`Row error: ${rowErr.message}`);
      }
    }

    // Clean up uploaded file
    try { fs.unlinkSync(req.file.path); } catch {}

    res.json({
      message: `Import complete`,
      created, failed,
      total: dataRows.length,
      errors: errors.slice(0, 10)
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
