// Reviewed unresolved identity from the unchanged0154/0155 snapshots and their
// official reports. This tiny registry is shared by incoming normalization;
// it is not an alias map and never substitutes another player's identity.
export const QUARANTINED_PROVIDER_IDENTITIES = [{
  providerPlayerId: 'bcc566fc-5452-4681-ab41-b042fae11e53',
  providerName: 'Drew Doughty',
}] as const;
export function isQuarantinedProviderIdentity(id:unknown,name:unknown):boolean {
  return QUARANTINED_PROVIDER_IDENTITIES.some(entry=>
    (typeof id==='string'&&id.toLowerCase()===entry.providerPlayerId)||
    (typeof name==='string'&&name.trim().toLowerCase()===entry.providerName.toLowerCase()));
}
