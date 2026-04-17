/**
 * Returns a stable string identity for a transaction based on its content.
 * Used to match transactions across re-imports where IDs are ephemeral.
 */
export function fingerprint(txn) {
  return `${txn.date}|${txn.amount}|${txn.description}|${txn.account}`;
}
