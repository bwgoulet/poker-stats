# Data Quality Report

Known issues are generated at runtime by `normalizeWorkbooks`: malformed `?` payout rows are skipped, and nights where sum(profit) does not reconcile to zero are flagged. Original workbooks are not modified.
