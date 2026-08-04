import XLSX from "xlsx";

const workbook = XLSX.readFile("C:\\Users\\lenovo\\Downloads\\Bissi.xlsx");
console.log("Sheet names in C:\\Users\\lenovo\\Downloads\\Bissi.xlsx:");
console.log(workbook.SheetNames);

workbook.SheetNames.forEach((sheetName) => {
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);
  console.log(`Sheet "${sheetName}": ${data.length} rows`);
});
