import { fingerprint } from './transactionFingerprint.js';

/**
 * Merges incoming (re-imported) transactions with existing stored transactions,
 * preserving user-set categories and notes for matched transactions.
 *
 * @param {Array} incoming - Transactions from the new import
 * @param {Array} existing - Transactions currently stored for the month
 * @returns {{ merged: Array, stats: { matched: number, added: number, kept: number } }}
 */
export function mergeTransactions(incoming, existing) {
  // Build a map of fingerprint → [existing txns] to handle duplicate fingerprints
  const existingMap = new Map();
  for (const txn of existing) {
    const fp = fingerprint(txn);
    if (!existingMap.has(fp)) existingMap.set(fp, []);
    existingMap.get(fp).push(txn);
  }

  const merged = [];
  let matched = 0;
  let added = 0;

  for (const incomingTxn of incoming) {
    const fp = fingerprint(incomingTxn);
    const candidates = existingMap.get(fp);

    if (candidates && candidates.length > 0) {
      // Pop the first match (positional tiebreaker for duplicate fingerprints)
      const existingTxn = candidates.shift();
      if (candidates.length === 0) existingMap.delete(fp);

      // Preserve user-set fields; take everything else from the new import
      merged.push({
        ...incomingTxn,
        category: existingTxn.category,
        notes: existingTxn.notes,
      });
      matched++;
    } else {
      merged.push(incomingTxn);
      added++;
    }
  }

  // Collect unmatched existing transactions (no longer in the export)
  const unmatched = [];
  for (const remaining of existingMap.values()) {
    unmatched.push(...remaining);
  }

  // Append kept transactions after the merged ones
  const kept = unmatched.length;
  merged.push(...unmatched);

  return { merged, stats: { matched, added, kept } };
}
