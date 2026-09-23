const fs = require('fs');
const filePath = 'app/wood-category/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/unit: 'cu ft',/g, '');
content = content.replace(/unit: 'cu ft'/g, '');
content = content.replace(/unit: newCategory.unit,/g, '');
content = content.replace(/unit: editCategoryData.unit,/g, '');
// For the useState
content = content.replace(/, unit: '' \}/g, ' }'); // If any

fs.writeFileSync(filePath, content);
console.log('patched');
