const router = require('express').Router();
const db = require('../utils/db');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const { authenticate, canWrite } = require('../middleware/auth');

const upload = multer({ dest: path.join(__dirname,'../uploads/bulk/') });

router.post('/upload', authenticate, canWrite, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error:'No file uploaded' });
    const wb = XLSX.readFile(req.file.path);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws);
    if (!data.length) return res.status(400).json({ error:'Empty file' });

    const [[{count}]] = await db.query('SELECT COUNT(*) as count FROM bulk_order_batches');
    const batchId = `BULK${String(count+1).padStart(4,'0')}`;
    const [batch] = await db.query('INSERT INTO bulk_order_batches (batch_id, name, total_orders, source_file, created_by) VALUES (?,?,?,?,?)',
      [batchId, `Bulk Upload ${new Date().toLocaleDateString()}`, data.length, req.file.originalname, req.user.id]);

    const results = { created:0, failed:0, errors:[] };
    for (const row of data) {
      try {
        const date = new Date();
        const [[{oc}]] = await db.query('SELECT COUNT(*) as oc FROM orders');
        const orderId = `OS${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(oc+1).padStart(5,'0')}`;
        const gst = parseFloat(row['GST%']||0);
        const qty = parseInt(row['Quantity']||1);
        const price = parseFloat(row['Unit Price']||0);
        const subtotal = qty * price;
        const taxAmt = subtotal * gst/100;
        const isInterstate = (row['State']||'').toLowerCase() !== 'tamil nadu';
        const igst = isInterstate ? taxAmt : 0;
        const cgst = !isInterstate ? taxAmt/2 : 0;
        const sgst = !isInterstate ? taxAmt/2 : 0;
        const total = subtotal + taxAmt + parseFloat(row['Shipping']||0);

        const [orderR] = await db.query(
          `INSERT INTO orders (order_id, source, customer_name, customer_email, customer_phone, shipping_address, shipping_city, shipping_state, shipping_pincode, shipping_country, subtotal, cgst, sgst, igst, total_tax, shipping_cost, total, is_gst_invoice, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [orderId, row['Source']||'manual', row['Customer Name'], row['Email'], row['Phone'], row['Address'], row['City'], row['State'], row['Pincode'], row['Country']||'India', subtotal, cgst, sgst, igst, taxAmt, parseFloat(row['Shipping']||0), total, row['GST Invoice']!=='No'?1:0, row['Notes'], req.user.id]
        );
        await db.query('INSERT INTO order_items (order_id, product_name, sku, hsn_code, quantity, unit_price, gst_percent, cgst_amount, sgst_amount, igst_amount, total) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          [orderR.insertId, row['Product Name'], row['SKU'], row['HSN Code'], qty, price, gst, cgst, sgst, igst, subtotal]);
        results.created++;
      } catch(e) { results.failed++; results.errors.push(`Row: ${JSON.stringify(row)} - ${e.message}`); }
    }

    await db.query('UPDATE bulk_order_batches SET status="completed" WHERE id=?', [batch.insertId]);
    res.json({ batch_id: batchId, ...results });
  } catch(e) { console.error(e); res.status(500).json({ error:'Bulk upload error' }); }
});

router.get('/template', authenticate, (req, res) => {
  const wb = XLSX.utils.book_new();
  const headers = [['Customer Name','Email','Phone','Address','City','State','Pincode','Country','Product Name','SKU','HSN Code','Quantity','Unit Price','GST%','Shipping','GST Invoice','Source','Notes']];
  const sample = [['John Doe','john@email.com','9876543210','123 Main St','Chennai','Tamil Nadu','600001','India','Acrylic Board','SKU001','3926','1','500','18','50','Yes','website','Gift item']];
  const ws = XLSX.utils.aoa_to_sheet([...headers, ...sample]);
  XLSX.utils.book_append_sheet(wb, ws, 'Bulk Orders');
  const buf = XLSX.write(wb, { type:'buffer', bookType:'xlsx' });
  res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition','attachment; filename="bulk_order_template.xlsx"');
  res.send(buf);
});

router.get('/batches', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT b.*, u.name as created_by_name FROM bulk_order_batches b LEFT JOIN users u ON b.created_by=u.id ORDER BY b.created_at DESC');
    res.json(rows);
  } catch(e) { res.status(500).json({ error:'Error' }); }
});

module.exports = router;
