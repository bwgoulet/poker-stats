import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

export const WORKBOOKS = [
  { seasonId: 'fall-2025' as const, file: 'fall-2025.xlsx' },
  { seasonId: 'spring-2026' as const, file: 'spring-2026.xlsx' },
];

const DATA_DIR = path.join(process.cwd(), 'data');

function workbookPath(file: string) {
  return path.join(DATA_DIR, file);
}

function readWorkbook(file: string) {
  const filePath = workbookPath(file);

  try {
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to read workbook "${file}" at ${filePath}. ` +
        'Make sure you are running the app from the repository root and that the data/*.xlsx files exist locally. ' +
        `Original error: ${detail}`,
    );
  }

  const workbookBuffer = fs.readFileSync(filePath);
  return XLSX.read(workbookBuffer, { cellDates: true, cellFormula: true, type: 'buffer' });
}

export function loadWorkbooks() {
  return WORKBOOKS.map((workbook) => ({
    ...workbook,
    path: workbookPath(workbook.file),
    workbook: readWorkbook(workbook.file),
  }));
}
