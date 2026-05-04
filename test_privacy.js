const ExcelJS = require('exceljs');

async function test() {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Sheet1');
  ws.getCell('A1').value = 'Test';
  
  await workbook.xlsx.writeFile('test_privacy.xlsx');
  console.log('Saved test_privacy.xlsx');
}

test();
