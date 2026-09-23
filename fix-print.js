const fs = require('fs');
let content = fs.readFileSync('components/InvoicePrint.tsx', 'utf8');

content = content.replace(/!print:text/g, 'print:text');
// Also wait! In InvoicePrint.tsx, there are `print:color-adjust-exact` classes missing maybe?
// Actually we already have `-webkit-print-color-adjust: exact !important;` in globals.css, which works.

fs.writeFileSync('components/InvoicePrint.tsx', content, 'utf8');
