const fs = require('fs');

function patchFile(path) {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(/, quantity: 1 /g, ' ');
  content = content.replace(/, quantity: 1/g, '');
  content = content.replace(/quantity: 1,/g, '');
  fs.writeFileSync(path, content);
}

try {
  patchFile('app/pos-wood/page.tsx');
  patchFile('app/solo-wood/page.tsx');
  console.log('carts patched');
} catch (e) {
  console.log(e);
}
