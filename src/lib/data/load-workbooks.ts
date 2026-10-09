import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { SeasonId } from '@/types/poker';

const DATA_DIR = path.join(process.cwd(), 'data');
const SEASON_WORKBOOK = /^([a-z][a-z0-9-]*-\d{4})\.xlsx$/i;

export interface WorkbookSource {
  seasonId: SeasonId;
  file: string;
}

/** Discover season workbooks so adding an xlsx file never requires a code change. */
export function discoverWorkbooks(dataDir = DATA_DIR): WorkbookSource[] {
  return fs.readdirSync(dataDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .flatMap((entry) => {
      const match = entry.name.match(SEASON_WORKBOOK);
      return match ? [{ seasonId: match[1].toLowerCase(), file: entry.name }] : [];
    })
    .sort((a, b) => a.seasonId.localeCompare(b.seasonId));
}

function readWorkbook(file: string, dataDir: string) {
  const filePath = path.join(dataDir, file);

  try {
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to read workbook "${file}" at ${filePath}. ` +
        'Provide the directory containing your archived season workbooks. ' +
        `Original error: ${detail}`,
    );
  }

  const workbookBuffer = fs.readFileSync(filePath);
  return XLSX.read(workbookBuffer, { cellDates: true, cellFormula: true, type: 'buffer' });
}

export function loadWorkbooks(dataDir = DATA_DIR) {
  return discoverWorkbooks(dataDir).map((workbook) => ({
    ...workbook,
    path: path.join(dataDir, workbook.file),
    workbook: readWorkbook(workbook.file, dataDir),
  }));
}
