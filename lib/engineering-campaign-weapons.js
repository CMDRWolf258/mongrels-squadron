// Improve Weapon Package campaign — sixth goal-specific Engineering Campaign Planner chain.
//
// Unlike the earlier single-module campaigns, this one treats the hardpoints as a
// package. The Commander audits weapon roles, WEP/heat/ammo/range/convergence, tests
// a small representative slice first, then rolls out only the changes that proved
// useful. Engineer access is intentionally capability-based because different
// weapon families use different Engineers and max grades.

const INARA_ENGINEERS = 'https://inara.cz/elite/engineers/';
const INARA_BLUEPRINTS = 'https://inara.cz/elite/blueprints/';
const INARA_TOD = 'https://inara.cz/elite/engineer/6/';
const INARA_DWELLER = 'https://inara.cz/elite/engineer/4/';
const INARA_BROO = 'https://inara.cz/elite/engineer/15/';

export function buildWeaponEngineeringDependencyNodes({ campaign = null } = {}) {
  if (!campaign || campaign.goalId !== 'weapons') return [];

  return [
    {
      id:'weapons.package-baseline',
      kind:'assess',
      title:'Map the hardpoint package you actually fly',
      objective:'Record every weapon, mount type, current blueprint/experimental if any, fire group, typical engagement range, and the problem you want the package to solve. Also note whether the issue appears against shields, hull, modules, small targets, large targets, or during sustained fire.',
      dependsOn:['campaign.map-dependencies'],
      meta:{
        stage:'Package Baseline',
        note:'This campaign improves a weapon system, not a shopping list of independent hardpoints. Start by seeing the package as one combat tool.',
      },
    },
    {
      id:'weapons.package-role-map',
      kind:'plan',
      title:'Give each weapon a job inside the package',
      objective:'Decide what each hardpoint contributes: shield pressure, hull damage, module pressure, burst damage, sustained damage, utility, range coverage, ammunition economy, or a finishing role. A mixed package is valid when the roles complement each other; identical engineering on every hardpoint is not automatically better.',
      dependsOn:['weapons.package-baseline'],
      resourceHint:'engineering-weapons',
      meta:{
        stage:'Package Design',
        resourceUrl:'/guides/engineering/',
        resourceLabel:'Mongrel Engineering Guide',
        secondaryResources:[
          { label:'Inara · Hardpoint Blueprints', url:INARA_BLUEPRINTS },
        ],
      },
    },
    {
      id:'weapons.package-budget',
      kind:'assess',
      title:'Measure what the whole package costs to fire',
      objective:'Run the weapons as you normally use them and record the limits that actually appear: WEP drain, heat, deployed power, ammunition endurance, reload rhythm, range falloff, projectile travel time, convergence, or difficulty keeping the intended weapons on target together.',
      dependsOn:['weapons.package-role-map'],
      meta:{
        stage:'Package Budget',
        note:'More theoretical damage is not an upgrade if the package overheats, empties WEP, runs dry too quickly, or cannot apply that damage at the range you actually fight.',
      },
    },
    {
      id:'weapons.package-layout-audit',
      kind:'plan',
      title:'Fix the package before engineering more damage into it',
      objective:'Audit fire groups, weapon placement, mount choice, engagement range, damage mix, ammo burden, and whether the current hardpoints can be fired together comfortably. Change only obvious layout or usage problems first. Do not use Engineering to compensate for a package that is fighting itself.',
      dependsOn:['weapons.package-budget'],
      meta:{
        stage:'Package Audit',
        resourceUrl:'/guides/engineering/',
        resourceLabel:'Mongrel Engineering Guide',
        stoppingPoint:'A better fire-group/layout/range plan can be the whole win. Engineering is optional if the package now does the job cleanly.',
      },
    },
    {
      id:'weapons.package-layout-test',
      kind:'demonstrate',
      title:'Fight once with the corrected package before engineering it',
      objective:'Repeat the kind of combat that exposed the original problem. Check target time, WEP behavior, heat, ammo use, range control, convergence, and whether the weapons now support one another instead of competing for the same resource or engagement window.',
      dependsOn:['weapons.package-layout-audit'],
      meta:{
        stage:'Take the Win',
        readyToFinish:true,
        payoff:'If the package now solves the problem without additional Engineering, complete the campaign here. Do not manufacture a grind just because blueprints exist.',
      },
    },
    {
      id:'weapons.test-slice',
      kind:'plan',
      title:'Choose a small representative weapon slice to change first',
      objective:'Choose one weapon family or one or two hardpoints that represent the problem well. Test the proposed Engineering there before changing the entire ship. For a mixed package, start with the group whose role or resource cost is most clearly limiting performance.',
      dependsOn:['weapons.package-layout-test'],
      meta:{
        stage:'Test Slice',
        stoppingPoint:'Do not re-engineer every hardpoint at once. Preserve a clean before/after comparison.',
      },
    },
    {
      id:'weapons.slice-blueprint',
      kind:'plan',
      title:'Choose the blueprint around that weapon’s package role',
      objective:'Compare the blueprints available for the selected weapon family and choose the one that solves its role inside this package. Damage, distributor draw, heat, range, ammo, mass, power draw and integrity trade against one another differently by blueprint. Do not treat Overcharged, Efficient, Long Range, High Capacity or any other blueprint as universal.',
      dependsOn:['weapons.test-slice'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Blueprint Choice',
        resourceUrl:INARA_BLUEPRINTS,
        resourceLabel:'Inara · Hardpoint Blueprints',
        note:'The correct blueprint is the one that improves this weapon’s assigned job without breaking the rest of the package.',
      },
    },
    {
      id:'weapons.engineer.g2-access',
      kind:'unlock',
      title:'Confirm a suitable G2 Engineer for the chosen weapon slice',
      objective:'Confirm an Engineer who can apply the selected blueprint to this weapon family through at least Grade 2. Tod McQuinn is a common early path for multi-cannons, rail guns and some cannon/fragment work; The Dweller can cover early laser work; Broo Tarquin takes lasers much farther. Plasma accelerators and other families may use different Engineers. Use the current Engineer list rather than assuming one Engineer covers the whole package.',
      dependsOn:['weapons.slice-blueprint'],
      meta:{
        stage:'Engineer Access',
        resourceUrl:INARA_ENGINEERS,
        resourceLabel:'Inara · All Engineers',
        secondaryResources:[
          { label:'Tod “The Blaster” McQuinn', url:INARA_TOD },
          { label:'The Dweller', url:INARA_DWELLER },
          { label:'Broo Tarquin', url:INARA_BROO },
        ],
        note:'This step is deliberately manual. Existing access to the wrong weapon Engineer must not auto-clear access for a different weapon family.',
        stoppingPoint:'If unlocking the required Engineer is a large chain, treat that unlock as its own Engineer Network project and pause this package campaign here.',
      },
    },
    {
      id:'weapons.plan-g2-materials',
      kind:'plan',
      title:'Plan only the G1 → G2 test-slice materials',
      objective:'Use Inara or another trusted planner to calculate the materials for the selected weapon slice through complete G2. Do not multiply the shopping list across every hardpoint yet, and do not add the experimental or G3–G5 to this first gather.',
      dependsOn:['weapons.engineer.g2-access'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Material Plan',
        resourceUrl:INARA_BLUEPRINTS,
        resourceLabel:'Inara · Hardpoint Blueprints',
      },
    },
    {
      id:'weapons.gather-g2-materials',
      kind:'prepare',
      title:'Gather only the G2 materials for the test slice',
      objective:'Acquire or trade for the exact G1 → G2 materials needed by the selected test weapons and stop when that small job is covered. If your inventory already covers it, move on immediately.',
      dependsOn:['weapons.plan-g2-materials'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Targeted Gathering',
        resourceUrl:INARA_BLUEPRINTS,
        resourceLabel:'Inara · Hardpoint Blueprints',
        stoppingPoint:'Fund the test, not the entire future build.',
      },
    },
    {
      id:'weapons.slice.g2',
      kind:'engineer',
      title:'Take only the test weapon slice to G2',
      objective:'Apply the chosen blueprint through complete G2 to the selected test weapon or small weapon group. Leave the rest of the package unchanged so the next combat test tells you whether the idea is actually helping.',
      dependsOn:['weapons.gather-g2-materials'],
      meta:{
        stage:'Engineer',
        stoppingPoint:'G2 on the test slice is enough. The next job is combat, not more clicks at the Engineer.',
      },
    },
    {
      id:'weapons.test.g2',
      kind:'demonstrate',
      title:'Combat-test the G2 slice inside the unchanged package',
      objective:'Repeat the original combat workload. Check whether the changed weapon does its assigned job better and whether the whole package’s WEP draw, heat, range behavior, time on target, ammo use and kill/disable time improved or became worse.',
      dependsOn:['weapons.slice.g2'],
      meta:{
        stage:'Take the Win',
        readyToFinish:true,
        payoff:'If this was a targeted package problem and the G2 slice solved it, you can complete the campaign here. Otherwise continue only with a specific remaining reason.',
      },
    },
    {
      id:'weapons.experimental.plan',
      kind:'plan',
      title:'Choose experimentals by package function, not by habit',
      objective:'If the G2 test still leaves a useful opportunity, choose experimentals for what they contribute to the package: damage behavior, thermal management, ammunition behavior, utility, range application, module pressure, wing support or another specific role. Avoid duplicating an effect across multiple weapons unless the package actually benefits from doing so.',
      dependsOn:['weapons.test.g2'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Optional Experimental',
        resourceUrl:INARA_BLUEPRINTS,
        resourceLabel:'Inara · Hardpoint Experimentals',
        note:'Experimentals are often where package synergy lives, so decide their jobs together rather than treating each hardpoint as an isolated upgrade.',
        stoppingPoint:'If G2 already solved the package problem, finish instead of adding an experimental by default.',
      },
    },
    {
      id:'weapons.experimental.materials',
      kind:'prepare',
      title:'Gather only the chosen experimental materials',
      objective:'Acquire or trade for the exact materials needed by the selected experimental effects on the test slice. Stop when that defined job is covered.',
      dependsOn:['weapons.experimental.plan'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Optional Experimental',
        resourceUrl:INARA_BLUEPRINTS,
        resourceLabel:'Inara · Hardpoint Experimentals',
      },
    },
    {
      id:'weapons.experimental.apply',
      kind:'engineer',
      title:'Apply the chosen experimentals to the test slice',
      objective:'Apply only the experimental effects you deliberately assigned a package role. Do not use the same effect everywhere simply because one copy worked well.',
      dependsOn:['weapons.experimental.materials'],
      meta:{
        stage:'Optional Experimental',
        resourceUrl:INARA_BLUEPRINTS,
        resourceLabel:'Inara · Hardpoint Experimentals',
      },
    },
    {
      id:'weapons.experimental.test',
      kind:'demonstrate',
      title:'Combat-test the G2 + experimental slice',
      objective:'Repeat the same fight or controlled test and compare it with G2 alone. Confirm that the experimental adds the intended package function without creating a worse heat, WEP, ammo, range or handling problem.',
      dependsOn:['weapons.experimental.apply'],
      meta:{
        stage:'Take the Win',
        readyToFinish:true,
        payoff:'If the test slice now does its job and the rest of the package is already coherent, complete the campaign here. Full rollout is optional.',
      },
    },
    {
      id:'weapons.rollout-plan',
      kind:'plan',
      title:'Decide what should actually roll out to the rest of the package',
      objective:'Use the test result to choose which remaining weapons should copy the tested blueprint, which need a different blueprint, which need a different experimental, and which should stay unchanged. Preserve complementary roles instead of cloning one successful hardpoint across the ship.',
      dependsOn:['weapons.experimental.test'],
      meta:{
        stage:'Package Rollout',
        note:'A package rollout is a design decision, not a batch-copy operation.',
      },
    },
    {
      id:'weapons.rollout-materials',
      kind:'prepare',
      title:'Gather only the G2 rollout shortfall',
      objective:'Calculate and acquire the materials needed to bring only the intended remaining hardpoints to their planned G2 package state and apply the chosen experimentals. Leave G3–G5 off this rollout.',
      dependsOn:['weapons.rollout-plan'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Package Rollout',
        resourceUrl:INARA_BLUEPRINTS,
        resourceLabel:'Inara · Hardpoint Blueprints',
      },
    },
    {
      id:'weapons.rollout-apply',
      kind:'engineer',
      title:'Apply the proven G2 package plan',
      objective:'Engineer the intended remaining hardpoints to the planned G2 state and apply only the package experimentals you chose. Keep any intentionally different weapon roles different.',
      dependsOn:['weapons.rollout-materials'],
      meta:{
        stage:'Package Rollout',
        stoppingPoint:'Stop at the planned G2 package. Do not continue into G3 during the same visit just because the Engineer offers it.',
      },
    },
    {
      id:'weapons.package.full-test',
      kind:'demonstrate',
      title:'Fight with the complete G2 weapon package',
      objective:'Run the ship in the combat role it was built for. Check shield and hull pressure, target time, WEP sustain, heat, ammo endurance, reload rhythm, range coverage, convergence, fire-group workload and whether the package still supports the ship’s defenses and movement instead of monopolizing its resources.',
      dependsOn:['weapons.rollout-apply'],
      meta:{
        stage:'Take the Win',
        readyToFinish:true,
        payoff:'A coherent G2 weapon package is a complete build win. If it performs the role well, stop here and fly it rather than automatically chasing higher grades.',
      },
    },
    {
      id:'weapons.g3-access',
      kind:'unlock',
      title:'Confirm G3 access only for the weapon groups that still need it',
      objective:'If the full G2 package still has a specific limitation, confirm that the appropriate Engineer can take only those weapon families through G3. Different Engineers have different weapon families and maximum grades, so do not assume the Engineer used for one hardpoint can refine every other weapon on the ship.',
      dependsOn:['weapons.package.full-test'],
      meta:{
        stage:'Optional Refinement',
        resourceUrl:INARA_ENGINEERS,
        resourceLabel:'Inara · All Engineers',
        secondaryResources:[
          { label:'Tod “The Blaster” McQuinn', url:INARA_TOD },
          { label:'The Dweller', url:INARA_DWELLER },
          { label:'Broo Tarquin', url:INARA_BROO },
        ],
        note:'This remains manual because G3 capability must match the actual weapon family being refined.',
        stoppingPoint:'If the needed G3 Engineer requires a long unlock chain, stop the package campaign at the proven G2 build and make that Engineer unlock a separate future project.',
      },
    },
    {
      id:'weapons.plan-g3-materials',
      kind:'plan',
      title:'Plan G3 only for the weapons still limiting the package',
      objective:'Calculate the materials needed to take only the identified limiting weapon group from its current G2 state through complete G3. Do not upgrade unaffected weapons merely for symmetry, and do not append G4/G5.',
      dependsOn:['weapons.g3-access'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Optional Refinement',
        resourceUrl:INARA_BLUEPRINTS,
        resourceLabel:'Inara · Hardpoint Blueprints',
      },
    },
    {
      id:'weapons.gather-g3-materials',
      kind:'prepare',
      title:'Gather only the G3 refinement shortfall',
      objective:'Acquire or trade for the materials in that limited G3 refinement plan and stop when it is covered.',
      dependsOn:['weapons.plan-g3-materials'],
      resourceHint:'inara-engineering',
      meta:{
        stage:'Optional Refinement',
        resourceUrl:INARA_BLUEPRINTS,
        resourceLabel:'Inara · Hardpoint Blueprints',
      },
    },
    {
      id:'weapons.apply-g3',
      kind:'engineer',
      title:'Take only the limiting weapon group to G3',
      objective:'Apply G3 only where the full-package test justified it. Preserve the G2 state on weapons that were already doing their jobs well.',
      dependsOn:['weapons.gather-g3-materials'],
      meta:{
        stage:'Optional Refinement',
        stoppingPoint:'G3 is the end of this campaign phase. Do not silently extend the package into a G4/G5 grind.',
      },
    },
    {
      id:'weapons.test.g3',
      kind:'demonstrate',
      title:'Run the final package test and close the phase',
      objective:'Repeat the full combat test and confirm the selective G3 refinement improved the measured limitation without breaking WEP sustain, heat, ammo economy, range behavior, convergence, or the complementary jobs of the other hardpoints.',
      dependsOn:['weapons.apply-g3'],
      meta:{
        stage:'Take the Win',
        readyToFinish:true,
        payoff:'Keep the package if it now does the job. Future G4/G5 work should begin from a new measured limitation, not from the assumption that every hardpoint must be maxed.',
      },
    },
  ];
}
