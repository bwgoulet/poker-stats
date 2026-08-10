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

export function getSeasonIds(): SeasonId[] {
  return discoverWorkbooks().map(({ seasonId }) => seasonId);
}

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
  return discoverWorkbooks().map((workbook) => ({
    ...workbook,
    path: workbookPath(workbook.file),
    workbook: readWorkbook(workbook.file),
  }));
}
