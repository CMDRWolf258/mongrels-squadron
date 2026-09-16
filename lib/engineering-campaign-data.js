// Goal-specific engineering dependency graphs live here.
//
// Keep this separate from the campaign/state engine so engineer unlock changes,
// prerequisite corrections, new blueprint guidance, and background-prep tuning can
// be updated without migrating stored member campaign state.
//
// Node contract supported by lib/engineering-campaign.js:
// {
//   id, kind, title, objective,
//   dependsOn: ['other.node'],
//   factCompletion: { factId:'counter.example', operator:'gte', target:50 },
//   backgroundActivities: ['trade'],
//   backgroundOnly: false,
//   chunkSize: 5,
//   resourceHint: 'inara-engineering',
//   meta: {}
// }
//
// Example future use: a large cumulative unlock requirement can be represented as
// one dependency node with target 50 and chunkSize 5. The Engineering campaign can
// show overall progress while another pathway offers an OPTIONAL five-unit prep
// opportunity. Completing that prep advances the shared fact rather than awarding
// Trade/Mining/etc. pathway credit.

export function buildEngineeringDependencyNodes({ campaign = null, facts = {} } = {}) {
  if (!campaign) return [];

  // v1 framework intentionally ships without hard-coded engineer unlock chains.
  // Add audited goal-specific nodes here as the engineer dependency database is
  // built and verified.
  void facts;
  return [];
}
