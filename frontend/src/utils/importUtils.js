export const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQuotes && line[i+1] === '"') {
        current += '"'; i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (line[i] === ',' && !inQuotes) {
      result.push(current.trim()); current = '';
    } else {
      current += line[i];
    }
  }
  result.push(current.trim());
  return result;
};

export const parseCSV = (text) => {
  const cleaned = text.replace(/^\uFEFF/, '');
  const lines = cleaned.split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return [headers, ...lines.slice(1).map(line => parseCSVLine(line))];
};

export const SCHEMAS = {
  customers: [
    { key: 'name', label: 'Name', required: true },
    { key: 'phone', label: 'Phone', required: true },
    { key: 'email', label: 'Email', required: false },
    { key: 'gstin', label: 'GSTIN', required: false },
    { key: 'company_name', label: 'Company Name', required: false },
    { key: 'billing_address', label: 'Billing Address', required: false },
    { key: 'billing_city', label: 'Billing City', required: false },
    { key: 'billing_state', label: 'Billing State', required: false },
    { key: 'billing_pincode', label: 'Billing Pincode', required: false },
    { key: 'outstanding_balance', label: 'Outstanding Balance', required: false }
  ],
  products: [
    { key: 'sku', label: 'SKU', required: true },
    { key: 'name', label: 'Name', required: true },
    { key: 'selling_price', label: 'Selling Price', required: true },
    { key: 'purchase_price', label: 'Cost Price', required: false },
    { key: 'stock', label: 'Stock Count', required: true },
    { key: 'gst_percent', label: 'GST %', required: false },
    { key: 'category', label: 'Category', required: false }
  ]
};

export const validateImportData = (rows, entityName, mapping) => {
  const schema = SCHEMAS[entityName] || [];
  const validRows = [];
  const errors = [];

  rows.forEach((row, idx) => {
    const obj = {};
    const rowIssues = [];

    schema.forEach(field => {
      const headerIdx = mapping[field.key];
      const val = headerIdx !== undefined ? row[headerIdx] : undefined;

      if (field.required && (val === undefined || val === null || val.toString().trim() === '')) {
        rowIssues.push({
          column: field.label,
          issue: 'Missing required value',
          suggestion: 'Provide a valid value'
        });
      } else {
        obj[field.key] = val !== undefined ? val : '';
      }
    });

    if (rowIssues.length > 0) {
      errors.push({
        rowNum: idx + 2,
        issues: rowIssues
      });
    } else {
      validRows.push(obj);
    }
  });

  return { validRows, errors };
};
