const fs = require('fs');
let content = fs.readFileSync('components/InvoicePrint.tsx', 'utf8');

content = content.replace(/text-emerald-\[2800px\]/g, 'text-emerald-700 !print:text-emerald-700');
content = content.replace(/text-rose-\[2400px\]/g, 'text-rose-600 !print:text-rose-600');
content = content.replace(/text-rose-\[2800px\]/g, 'text-rose-700 !print:text-rose-700');

fs.writeFileSync('components/InvoicePrint.tsx', content, 'utf8');
