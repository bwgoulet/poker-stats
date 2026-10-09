import snapshot from '../fixtures/historical-data.json';
import type { NormalizedWorkbookData } from '@/lib/backend/import-workbooks';

/** Frozen pre-retirement normalization snapshot, for historical parity tests only. */
export function historicalData(): NormalizedWorkbookData {
  return structuredClone(snapshot) as NormalizedWorkbookData;
}
