// Additional Engineering prep facts that originate naturally in non-Engineering
// Pathways. Keep these separate from the original campaign-data file so cross-path
// prep can grow without turning the campaign seed data into a catch-all registry.

export const CROSS_PATH_ENGINEERING_TRACKED_FACTS = {
  'mining.ore-mined-total-tonnes': {
    id:'mining.ore-mined-total-tonnes',
    label:'Total ore mined',
    unit:'tonnes',
    kind:'counter',
    minimum:0,
    quickAdd:[25,50,100],
    description:'Track actual ore mined across normal Mining play. Selene Jean currently requires at least 500 tonnes mined before her separate unlock delivery.',
  },
};
