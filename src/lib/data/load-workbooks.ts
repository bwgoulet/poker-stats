import path from 'node:path'; import * as XLSX from 'xlsx';
export const WORKBOOKS=[{seasonId:'fall-2025' as const,file:'fall-2025.xlsx'},{seasonId:'spring-2026' as const,file:'spring-2026.xlsx'}];
export function loadWorkbooks(){return WORKBOOKS.map(w=>({ ...w, path:path.join(process.cwd(),'data',w.file), workbook:XLSX.readFile(path.join(process.cwd(),'data',w.file),{cellDates:true,cellFormula:true})}));}
