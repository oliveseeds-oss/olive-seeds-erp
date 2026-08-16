const db = require('d:/olive-seeds-erp/backend/utils/db');

async function run() {
  try {
    const q = `
      SELECT 
        i.*, 
        c.name as customer_name_joined,
        c.email as customer_email_joined,
        c.phone as customer_phone_joined,
        c.gstin as customer_gstin_joined,
        u.name as created_by_name,
        (SELECT COUNT(*) FROM invoice_items ii WHERE ii.invoice_id = i.id) as item_count
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN users u ON i.created_by = u.id
      WHERE i.deleted_at IS NULL
    `;
    const [rows] = await db.query(q);
    console.log('QUERY SUCCESSFUL, ROWS COUNT:', rows.length);
    process.exit(0);
  } catch (err) {
    console.error('QUERY FAILED:', err);
    process.exit(1);
  }
}

run();
