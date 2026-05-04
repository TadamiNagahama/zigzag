const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'node_modules', 'exceljs', 'lib', 'xlsx', 'xform', 'book', 'workbook-properties-xform.js');

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');
  // filterPrivacy: 1 を filterPrivacy: 0 に書き換える
  if (content.includes('filterPrivacy: 1')) {
    content = content.replace('filterPrivacy: 1', 'filterPrivacy: 0');
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('Successfully patched exceljs to disable filterPrivacy.');
  } else {
    console.log('exceljs is already patched or filterPrivacy string not found.');
  }
} else {
  console.log('exceljs target file not found.');
}
