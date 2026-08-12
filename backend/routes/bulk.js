const router = require('express').Router();
const db = require('../utils/db');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Setup multer upload directory
const upload = multer({ dest: path.join(__dirname, '../uploads/bulk/') });

router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const wb = XLSX.readFile(req.file.path);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });
    
    if (rawData.length < 3) {
      return res.status(400).json({ error: 'File is empty or contains no data rows (must have headers, descriptions, and at least one data row)' });
    }
    
    // Row 0 is headers, Row 1 is descriptions, Row 2 onwards is data
    const headers = rawData[0];
    const dataRows = rawData.slice(2);
    
    const data = dataRows.map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] !== undefined ? row[i] : null;
      });
      return obj;
    }).filter(obj => obj['Customer Name'] || obj['Product Name']);

    if (!data.length) {
      return res.status(400).json({ error: 'No valid order rows found after row 2' });
    }

    await conn.beginTransaction();

    const [[{ count }]] = await conn.query('SELECT COUNT(*) as count FROM bulk_order_batches');
    const batchId = `BULK${String(count + 1).padStart(4, '0')}`;
    const [batch] = await conn.query(
      'INSERT INTO bulk_order_batches (batch_id, name, total_orders, source_file, status, created_by) VALUES (?, ?, ?, ?, "processing", ?)',
      [batchId, `Bulk Upload ${new Date().toLocaleDateString()}`, data.length, req.file.originalname, req.user.id]
    );

    const results = { created: 0, failed: 0, errors: [] };

    for (const row of data) {
      try {
        const date = new Date();
        const [[{ oc }]] = await conn.query('SELECT COUNT(*) as oc FROM orders');
        const orderId = `OS${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(oc + 1).padStart(5, '0')}`;

        const qty = parseInt(row['Quantity'] || 1);
        const price = parseFloat(row['Unit Price'] || 0);
        const discPercent = parseFloat(row['Discount %'] || 0);
        const gstPercent = parseFloat(row['GST %'] || 0);
        const shippingFee = parseFloat(row['Shipping Fee'] || 0);

        const subtotalBeforeDisc = qty * price;
        const discountAmount = subtotalBeforeDisc * (discPercent / 100);
        const taxable = subtotalBeforeDisc - discountAmount;
        
        const taxTotal = taxable * (gstPercent / 100);
        
        const state = (row['Shipping State'] || '').trim().toLowerCase();
        const isInterstate = state && state !== 'tamil nadu';
        
        const igst = isInterstate ? taxTotal : 0;
        const cgst = !isInterstate ? taxTotal / 2 : 0;
        const sgst = !isInterstate ? taxTotal / 2 : 0;
        const total = taxable + taxTotal + shippingFee;

        const isGstInvoice = (row['GST Invoice (Yes/No)'] || 'Yes').trim().toLowerCase() === 'yes' ? 1 : 0;

        const [orderR] = await conn.query(
          `INSERT INTO orders 
          (order_id, order_type, source, customer_name, customer_email, customer_phone, 
           billing_address, shipping_address, shipping_city, shipping_state, shipping_pincode, shipping_country, 
           subtotal, discount, cgst, sgst, igst, total_tax, shipping_cost, total, 
           is_gst_invoice, notes, payment_method, personalization_text, remark, created_by) 
           VALUES (?, 'bulk', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            row['Source'] || 'manual',
            row['Customer Name'] || 'Cash Customer',
            row['Customer Email'] || '',
            row['Customer Phone'] || '',
            row['Shipping Address'] || '',
            row['Shipping Address'] || '',
            row['Shipping City'] || '',
            row['Shipping State'] || '',
            row['Shipping Pincode'] || '',
            row['Shipping Country'] || 'India',
            taxable,
            discountAmount,
            cgst,
            sgst,
            igst,
            taxTotal,
            shippingFee,
            total,
            isGstInvoice,
            row['Remark'] || '',
            row['Payment Mode'] || 'cash',
            row['Personalization Text'] || '',
            row['Remark'] || '',
            req.user.id
          ]
        );

        // Deduct stock and log movement
        // Let's resolve product_id if SKU matches
        let productId = null;
        if (row['SKU']) {
          const [[prod]] = await conn.query('SELECT id, stock FROM products WHERE sku = ?', [row['SKU']]);
          if (prod) {
            productId = prod.id;
            const newStock = prod.stock - qty;
            await conn.query('UPDATE products SET stock = ? WHERE id = ?', [newStock, prod.id]);
            await conn.query(
              `INSERT INTO inventory_movements (product_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
               VALUES (?, 'out', ?, 'bulk_order', ?, 'Bulk uploaded order', ?)`,
              [prod.id, qty, orderR.insertId, req.user.id]
            );
          }
        }

        await conn.query(
          `INSERT INTO order_items 
           (order_id, product_id, product_name, sku, hsn_code, quantity, unit_price, discount_percent, gst_percent, cgst_amount, sgst_amount, igst_amount, total, personalization) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderR.insertId,
            productId,
            row['Product Name'] || 'Custom Bulk Item',
            row['SKU'] || '',
            row['HSN Code'] || '',
            qty,
            price,
            discPercent,
            gstPercent,
            cgst,
            sgst,
            igst,
            total,
            row['Personalization Text'] || ''
          ]
        );

        results.created++;
      } catch (e) {
        results.failed++;
        results.errors.push(`Row: ${JSON.stringify(row)} - ${e.message}`);
      }
    }

    await conn.query('UPDATE bulk_order_batches SET status="completed" WHERE id=?', [batch.insertId]);
    await conn.commit();
    res.json({ batch_id: batchId, ...results });
  } catch (e) {
    await conn.rollback();
    console.error('Bulk upload error:', e);
    res.status(500).json({ error: 'Bulk upload failed: ' + e.message });
  } finally {
    conn.release();
  }
});

router.get('/template', authenticate, (req, res) => {
  try {
    const headers = [
      'Customer Name', 'Customer Email', 'Customer Phone',
      'Shipping Address', 'Shipping City', 'Shipping State',
      'Shipping Pincode', 'Shipping Country',
      'Product Name', 'SKU', 'HSN Code', 'Size',
      'Quantity', 'Unit Price', 'Discount %',
      'GST %', 'Shipping Fee',
      'GST Invoice (Yes/No)', 'Source', 'Payment Mode',
      'Personalization Text', 'Remark'
    ];
    
    const descriptions = [
      'Required', 'Optional', 'Optional',
      'Full address', 'City', 'State',
      'PIN', 'Default: India',
      'Required', 'Optional', 'Optional', 'e.g. A4',
      'Required - number', 'Required - number', '0 if none',
      'e.g. 18', '0 if none',
      'Yes or No',
      'website/amazon/flipkart/etsy/manual/walkin',
      'cash/upi/card/cod',
      'Engraving text etc.', 'Internal notes'
    ];
    
    const sample = [
      'John Doe', 'john@email.com', '9876543210',
      '123 Main Street', 'Chennai', 'Tamil Nadu',
      '600001', 'India',
      'Acrylic Name Board', 'SKU001', '392690', 'A4',
      '2', '500', '0',
      '18', '50',
      'Yes', 'website', 'upi',
      'Engrave: JOHN', 'Gift item'
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, descriptions, sample]);
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bulk Orders');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="bulk_order_template.xlsx"');
    res.send(buf);
  } catch (err) {
    console.error('Template generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/batches', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT b.*, u.name as created_by_name 
       FROM bulk_order_batches b 
       LEFT JOIN users u ON b.created_by = u.id 
       ORDER BY b.created_at DESC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Error fetching batches: ' + e.message });
  }
});

module.exports = router;
