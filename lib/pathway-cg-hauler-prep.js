export const CG_HAULER_PREP_VERSION = 1;
export const CG_HAULER_PREP_KEY_PREFIX = 'specialty-cg-hauler-v1:';

const VALID_STATUS = new Set(['pending','complete','known','skipped']);
const CREDITED = new Set(['complete','known']);

export const CG_HAULER_PREP = {
  id:'community-goal-hauler-prep',
  title:'Community Goal Hauler Prep',
  subtitle:'Build a hauler that can stay coordinated, survive contact, and deliver the cargo.',
  doctrine:'The win condition is survive and deliver. Killing the attacker is not required.',
  steps:[
    {
      id:'cg-hauler.choose-ship',
      stage:'Choose',
      type:'build',
      title:'Choose an existing cargo ship',
      objective:'Use a cargo ship you already fly. Do not buy a special PvP ship for this path. The point is to make a real hauler safer and more useful under pressure.',
      why:'Training should improve the ships members actually use for squad logistics and Community Goals.',
    },
    {
      id:'cg-hauler.baseline',
      stage:'Observe',
      type:'learn',
      title:'Record the hauling baseline',
      objective:'Record cargo capacity, shield/hull protection, boost speed, laden jump range, rebuy cost, and any utility modules you normally carry.',
      checklist:['Cargo capacity','Shield and hull protection','Boost speed','Laden jump range','Rebuy cost','Current utility modules'],
    },
    {
      id:'cg-hauler.win-condition',
      stage:'Doctrine',
      type:'learn',
      title:'Define the real win condition',
      objective:'Treat a hostile encounter as a logistics problem. Your job is to preserve the ship when practical, keep the cargo moving, communicate clearly, and complete the delivery—not to win a duel.',
      payoff:'A hauler that escapes with cargo is succeeding even if it never fires a weapon.',
    },
    {
      id:'cg-hauler.survivability-pass',
      stage:'Build',
      type:'build',
      title:'Make one survivability pass without deleting the cargo role',
      objective:'Review shields, hull protection, speed, utilities and cargo capacity together. Add enough protection to survive an escape window while keeping the ship meaningfully useful as a hauler.',
      why:'Maximum cargo and maximum tank are both easy answers. The useful build lives between them.',
      checklist:['Keep meaningful cargo capacity','Maintain a useful shield/hull buffer','Preserve enough speed to create separation','Avoid adding defense that breaks the ship’s power or jump-range needs'],
    },
    {
      id:'cg-hauler.power-utility-check',
      stage:'Build',
      type:'build',
      title:'Check power, heat, utilities, and module priorities',
      objective:'Make sure the escape-critical modules stay powered when hardpoints or optional systems are deployed or disabled. Review heatsinks, chaff, point defence, ECM or other utilities only when they solve a real threat on this ship.',
      why:'A defensive module is not useful if the ship cannot power its Thrusters, FSD, shields, or planned escape tools when they matter.',
    },
    {
      id:'cg-hauler.pips-boost',
      stage:'Drill',
      type:'demonstrate',
      title:'Practice pips and boost without an attacker',
      objective:'Practice changing SYS/ENG pips, boosting repeatedly, turning away from a threat vector, and keeping enough ENG capacity to continue accelerating. Do it until the inputs are automatic instead of something you have to remember under fire.',
      checklist:['Move pips without staring at the panel','Boost on purpose rather than panic-spamming','Keep the escape vector in mind while maneuvering','Know how the ship behaves when laden'],
    },
    {
      id:'cg-hauler.wake-plan',
      stage:'Escape',
      type:'learn',
      title:'Know the high-wake and low-wake escape choices',
      objective:'Before entering a high-risk target system, know a nearby system you can jump to. Understand that a low wake returns to supercruise and can be delayed by another ship’s mass-lock factor, while a high wake jumps to another system and avoids that ship-mass delay.',
      why:'The decision is much easier when the escape system is already selected before the interdiction starts.',
    },
    {
      id:'cg-hauler.interdiction-response',
      stage:'Escape',
      type:'demonstrate',
      title:'Practice the interdiction response',
      objective:'Practice both trying to evade an interdiction and deliberately submitting when escape through the minigame is not the plan. A clean submission gives a much shorter FSD cooldown than losing the interdiction, creating a faster escape opportunity.',
      checklist:['Recognize when you are being interdicted','Know how to submit cleanly','Re-establish pips and boost after the drop','Begin the planned FSD escape as soon as the cooldown permits'],
    },
    {
      id:'cg-hauler.controlled-escape',
      stage:'Team Drill',
      type:'wing',
      title:'Run a controlled escape with another Mongrel',
      objective:'Have a squadmate interdict you in a controlled practice session. Execute the agreed escape: submit or evade as planned, manage pips, boost, survive the pressure, and high-wake or otherwise disengage successfully.',
      why:'Controlled practice makes the first real hostile encounter much less mysterious.',
      checklist:['Agree on the drill before starting','Use a rebuy-safe ship/load','Call the start and stop clearly','Debrief what worked and what failed'],
    },
    {
      id:'cg-hauler.target-system-awareness',
      stage:'Approach',
      type:'demonstrate',
      title:'Practice entering a busy target system',
      objective:'Enter a busy system with the mindset that hollow contacts may require attention. Keep the destination, escape system, traffic, and approach path in view without turning every Commander into an enemy.',
      why:'Awareness should improve survival without making Open Play paranoid or unpleasant.',
    },
    {
      id:'cg-hauler.delivery-under-pressure',
      stage:'Delivery',
      type:'demonstrate',
      title:'Practice the final approach and docking under pressure',
      objective:'Run a laden approach to the destination while preserving enough discipline to avoid overshooting, loitering, or forgetting the escape plan. The delivery remains the objective even after a stressful encounter.',
      checklist:['Approach efficiently','Avoid unnecessary loitering','Keep enough situational awareness to abort if needed','Complete docking and cargo delivery cleanly'],
    },
    {
      id:'cg-hauler.escort-comms',
      stage:'Coordination',
      type:'wing',
      title:'Build the escort and communications plan',
      objective:'Practice the information a hauler should give escorts or coordinators: current system, destination, cargo status, threat/contact, whether you escaped, and where to rendezvous next. Agree on what the escort is actually expected to do.',
      why:'An escort cannot help much if everyone is improvising different plans in different systems.',
    },
    {
      id:'cg-hauler.contingency',
      stage:'Coordination',
      type:'challenge',
      title:'Run one logistics contingency drill',
      objective:'Practice one failure case: destination changes, carrier moves, cargo target fills, a wingmate is separated, or you are forced to high-wake away. Re-form the plan without abandoning communication or dumping the operation.',
      payoff:'Good logistics is the ability to keep moving when the original plan stops being true.',
    },
    {
      id:'cg-hauler.capstone',
      stage:'Capstone',
      type:'challenge',
      title:'Complete a controlled hostile-delivery run',
      objective:'Carry real or practice cargo through a controlled hostile scenario with one or more squadmates acting as the threat. Survive or disengage, coordinate the recovery, reach the destination, and deliver the cargo. You do not need to destroy the attacker.',
      checklist:['Use the prepared hauler','Communicate the threat clearly','Execute the escape plan','Recover or rendezvous if separated','Finish the delivery'],
      payoff:'Capstone complete: you proved the ship and the pilot can keep a logistics mission alive under pressure.',
    },
  ],
};

export function createCgHaulerPrepState(ownerId = '') {
  return {
    version:CG_HAULER_PREP_VERSION,
    ownerId:String(ownerId || ''),
    taskStates:{},
    updatedAt:null,
  };
}

export function normalizeCgHaulerPrepState(value, ownerId = '') {
  const source = value && typeof value === 'object' ? value : {};
  const state = createCgHaulerPrepState(ownerId || source.ownerId || '');
  const validIds = new Set(CG_HAULER_PREP.steps.map(step => step.id));
  const rawStates = source.taskStates && typeof source.taskStates === 'object' ? source.taskStates : {};
  for (const [taskId, status] of Object.entries(rawStates)) {
    if (validIds.has(taskId) && VALID_STATUS.has(status)) state.taskStates[taskId] = status;
  }
  state.updatedAt = typeof source.updatedAt === 'string' ? source.updatedAt : null;
  return state;
}

export function setCgHaulerTaskStatus(stateValue, taskId, status, now = new Date().toISOString()) {
  const state = normalizeCgHaulerPrepState(stateValue);
  if (!CG_HAULER_PREP.steps.some(step => step.id === taskId) || !VALID_STATUS.has(status)) throw new Error('invalid_specialty_task');
  state.taskStates[taskId] = status;
  state.updatedAt = now;
  return state;
}

export function resetCgHaulerPrep(stateValue, now = new Date().toISOString()) {
  const state = normalizeCgHaulerPrepState(stateValue);
  state.taskStates = {};
  state.updatedAt = now;
  return state;
}

export function buildCgHaulerPrepView(stateValue) {
  const state = normalizeCgHaulerPrepState(stateValue, stateValue?.ownerId || '');
  const tasks = CG_HAULER_PREP.steps.map((step, index) => ({
    ...step,
    index:index + 1,
    status:VALID_STATUS.has(state.taskStates[step.id]) ? state.taskStates[step.id] : 'pending',
  }));
  const completed = tasks.filter(task => CREDITED.has(task.status)).length;
  const current = tasks.find(task => task.status === 'pending') || tasks.find(task => task.status === 'skipped') || null;
  return {
    id:CG_HAULER_PREP.id,
    title:CG_HAULER_PREP.title,
    subtitle:CG_HAULER_PREP.subtitle,
    doctrine:CG_HAULER_PREP.doctrine,
    tasks,
    current,
    progress:{
      completed,
      total:tasks.length,
      percent:tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
    },
    complete:!current,
  };
}
