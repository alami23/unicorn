const fs = require('fs');

let code = fs.readFileSync('app/invoice/page.tsx', 'utf8');

// Insert customerFilter effect
code = code.replace(
  "  // Use a ref to debounce the search term effect",
  `  useEffect(() => {\n    if (customerFilter) {\n      setSearchTerm(customerFilter)\n    }\n  }, [customerFilter])\n\n  // Use a ref to debounce the search term effect`
);

fs.writeFileSync('app/invoice/page.tsx', code);
console.log("Done");
