const db = require('d:/olive-seeds-erp/backend/utils/db');

db.query('SELECT id, invoice_number, deleted_at FROM invoices')
  .then(([rows]) => {
    console.log('ALL INVOICES IN DB:', rows);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
