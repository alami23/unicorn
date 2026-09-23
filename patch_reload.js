const fs = require('fs');
let code = fs.readFileSync('app/invoice/page.tsx', 'utf8');

// Replace loadInvoices() with loadInvoices(true) inside handleDeleteInvoice
code = code.replace(
  "setInvoiceToDelete(null)\n      loadInvoices()",
  "setInvoiceToDelete(null)\n      loadInvoices(true)"
);

// Inside receive payment modal
code = code.replace(
  "toast.success('Payment received')\n              addNotification('invoice_update', 'Payment Received', `Received ৳${payment.amount} for Invoice ${selectedInvoice.id} via ${payment.method}`);\n              loadInvoices()",
  "toast.success('Payment received')\n              addNotification('invoice_update', 'Payment Received', `Received ৳\${payment.amount} for Invoice \${selectedInvoice.id} via \${payment.method}`);\n              loadInvoices(true)"
);

// EditInvoiceModal onSave
code = code.replace(
  "onSave={loadInvoices}",
  "onSave={() => loadInvoices(true)}"
);

fs.writeFileSync('app/invoice/page.tsx', code);
console.log("Done");
