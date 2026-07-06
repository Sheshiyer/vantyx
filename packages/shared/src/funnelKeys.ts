/** KV key helpers for buyer leads. Leads live in the LEADS namespace, namespaced by tenant slug. */
export function leadKvKey(slug: string, leadId: string): string {
  return `lead:${slug}:${leadId}`;
}
export function leadIndexPrefix(slug: string): string {
  return `lead:${slug}:`;
}
