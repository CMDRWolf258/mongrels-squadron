export const PVP_ACTIVITY_ID = 'pvp';

const PVP_HUB = '/pvp/';
const SHIPS = '/ships/';
const ENGINEERING = '/guides/engineering/';
const RULES = '/about/#squad-rules';
const PROJECTS = '/projects/';

export const PVP_ROUTES = [
  {
    id:'pvp-foundations',
    band:'Beginner',
    title:'PvP Foundations — Survive, Fight, Learn',
    subtitle:'Build confidence in Open Play through controlled practice, defensive pips, escape planning, and one complete structured 1v1 learning loop.',
    audience:'For a Commander who is new to PvP, uncomfortable with hostile player contact, or used to NPC combat but has not yet built a repeatable survival-and-learning routine against other Commanders.',
    outcome:'Graduate by completing controlled PvP practice with another Mongrel, surviving pressure without combat logging, using deliberate pips and movement, completing at least one agreed 1v1 round, and explaining what you would change next time.',
    sourceNote:'The beginner goal is not to copy a tournament meta ship or win every duel. It is to stay composed in Open, protect the rebuy, understand when to fight or leave, and learn from real player pressure. Mongrel rules remain authoritative.',
    sources:[
      { label:'PvP Hub', url:PVP_HUB },
      { label:'Mongrel Squadron Rules', url:RULES },
      { label:'Mongrel Ship Catalogue', url:SHIPS },
    ],
    tasks:[
      {
        id:'pvp-foundations-rules', stage:'Doctrine', type:'learn', title:'Know the rules before the fight',
        objective:'Read the Mongrel rules that apply to Open Play and player combat. Be able to explain why Open is the squad standard and why intentionally disconnecting or closing the game to avoid destruction is prohibited.',
        why:'PvP training starts with conduct. A pilot who knows how the squad expects them to behave can practice hard fights without creating avoidable squad problems.',
        checklist:['Open Play standard understood.','No-combat-logging rule understood.','You know that normal in-game defeat is acceptable; forced disconnects are not.'],
        link:{ label:'Read Squadron Rules', url:RULES },
      },
      {
        id:'pvp-foundations-ship', stage:'Prepare', type:'build', title:'Prepare one rebuy-safe Open-play ship',
        objective:'Use a ship you already own and make it practical for controlled PvP: rebuy covered, fire groups usable, power priorities sane, defenses understood, and a clear plan for how the ship leaves a fight if the training round ends or the situation becomes unsafe.',
        why:'The first PvP ship is a learning platform. You need enough survivability and control to observe what is happening without turning every mistake into a financial or emotional crisis.',
        checklist:['Rebuy covered.','Fire groups tested.','Power priorities checked.','Defense strategy understood.','Escape/disengagement plan stated.'],
        link:{ label:'Browse Mongrel Combat Builds', url:SHIPS },
      },
      {
        id:'pvp-foundations-pips', stage:'Control', type:'demonstrate', title:'Practice defensive and offensive pip transitions',
        objective:'In controlled practice, deliberately move pips between SYS, ENG, and WEP while under player pressure. Prioritize survival when being focused, movement when you need position, and weapon capacity when you have a real firing window.',
        why:'Against a human opponent, static pips are punished faster. Learning to move power for the current problem gives immediate value before any build change.',
        checklist:['Defensive SYS allocation used deliberately.','ENG recovered for movement or boost.','WEP recovered before a real firing window.','You can explain one bad pip state you noticed.'],
      },
      {
        id:'pvp-foundations-movement', stage:'Movement', type:'demonstrate', title:'Create and break a firing solution',
        objective:'With a squadmate, practice one simple movement goal at a time: keep the opponent in view, deny an easy straight-line pass, create separation when pressured, then turn back in without immediately giving away a free firing angle.',
        why:'PvP movement is about controlling geometry, not simply holding boost. This drill makes positioning visible before advanced techniques are layered on top.',
        checklist:['Opponent kept in view for part of the drill.','At least one pressured pass was broken cleanly.','Separation was created deliberately.','Re-entry to the fight was controlled rather than panicked.'],
      },
      {
        id:'pvp-foundations-escape', stage:'Recovery', type:'demonstrate', title:'Practice a clean disengagement without disconnecting',
        objective:'Run a controlled escape drill with another Mongrel. Stay in-game, manage pips and movement, create enough space to execute the agreed escape plan, and finish the drill through normal game mechanics.',
        why:'Knowing you can leave legitimately removes much of the panic from hostile contact and reinforces the squad standard that combat logging is never the escape plan.',
        checklist:['Stayed connected through the drill.','Pips changed for survival/movement.','Space was created deliberately.','Escape completed through normal game mechanics.'],
      },
      {
        id:'pvp-foundations-duel', stage:'1v1', type:'wing', title:'Complete a structured training duel',
        objective:'Fight an agreed 1v1 round with a Mongrel using clear start/stop conditions. Focus on pips, movement, target tracking, and decision-making rather than the scoreboard. Follow the agreed stop condition even if you are still able to continue.',
        why:'A controlled duel produces useful repetitions without turning the first PvP lesson into an uncontrolled Open encounter.',
        checklist:['Start/stop conditions agreed before the fight.','Round completed without combat logging.','At least one deliberate pip transition used.','At least one movement mistake identified afterward.'],
        link:{ label:'Open PvP Hub', url:PVP_HUB },
      },
      {
        id:'pvp-foundations-debrief', stage:'Debrief', type:'challenge', title:'Separate build problems from pilot problems',
        objective:'After the duel, identify one problem caused mainly by flying/decision-making and one problem that may actually come from the ship or loadout. Change only one major variable before the next round.',
        why:'PvP can trigger expensive overreactions. Learning whether the failure came from positioning, pips, aim, heat, distributor, defenses, or weapon choice keeps upgrades evidence-based.',
        checklist:['One pilot-skill issue named.','One possible build issue named.','Only one major change selected for the next test.'],
      },
      {
        id:'pvp-foundations-graduate', stage:'Graduate', type:'challenge', title:'Repeat the training loop with less coaching',
        objective:'Complete another structured 1v1 or controlled hostile-contact drill with minimal prompting: prepare the ship, set the conditions, fight or disengage through normal mechanics, then debrief the result yourself.',
        why:'Graduation means player contact is no longer mysterious. You now have a repeatable loop for practice instead of relying on one lucky win or one bad loss.',
        checklist:['Training setup handled independently.','No combat logging.','Pips/movement used deliberately.','Result debriefed independently.','One next training priority chosen.'],
      },
    ],
  },
  {
    id:'pvp-duelist',
    band:'Developing',
    title:'Duelist — Range, Pips & Pressure',
    subtitle:'Turn basic survival into repeatable 1v1 control by measuring range, firing windows, defensive timing, and pressure management.',
    audience:'For a Commander who can complete controlled PvP fights but still loses too much time to bad range, weak time-on-target, unnecessary shield damage, or poor timing between offense and defense.',
    outcome:'Graduate by completing a short duel set in which you deliberately manage range and pips, create more useful firing windows, and make one evidence-based change to technique or build.',
    sourceNote:'This route does not require a specific dueling meta. The point is to understand why your own ship wins or loses exchanges and to stop treating every second of contact as equally valuable.',
    sources:[
      { label:'PvP Hub', url:PVP_HUB },
      { label:'Mongrel Ship Catalogue', url:SHIPS },
      { label:'Engineering & Shipbuilding Guide', url:ENGINEERING },
    ],
    tasks:[
      {
        id:'pvp-duelist-baseline', stage:'Baseline', type:'demonstrate', title:'Record one honest duel baseline',
        objective:'Complete several friendly rounds and record the biggest repeatable problems: losing range control, WEP starvation, excessive heat, weak shield trades, difficulty staying on target, ammo pressure, or repeated bad turns.',
        why:'A duel is easier to improve when you can name the exchange you keep losing instead of labeling the whole ship or fight as bad.',
        checklist:['Several rounds completed.','Largest repeatable problem named.','At least one ship-system limitation noted if present.','At least one flying/decision issue noted.'],
      },
      {
        id:'pvp-duelist-range', stage:'Range Control', type:'demonstrate', title:'Fight for the range your weapons actually want',
        objective:'In practice rounds, deliberately try to keep the fight in the range band where your current weapon package performs best. Notice when boost, throttle, turns, or overshoots hand control back to the opponent.',
        why:'Damage statistics mean little if the fight spends most of its time outside the range where the package can apply them.',
        checklist:['Preferred range band stated.','At least one successful range-control sequence completed.','At least one overshoot or separation mistake identified.'],
      },
      {
        id:'pvp-duelist-exchange', stage:'Pressure', type:'demonstrate', title:'Choose when to trade and when to reset',
        objective:'Practice recognizing favorable and unfavorable firing exchanges. Stay aggressive when your geometry and ship state support it; reset the engagement when the opponent owns the angle, your distributor is depleted, or your defense is taking a bad trade.',
        why:'Good dueling is not constant aggression. Strong pilots understand when an exchange is worth continuing and when preserving the next engagement matters more.',
        checklist:['At least one favorable trade extended deliberately.','At least one bad trade broken deliberately.','Distributor/defense state influenced the decision.'],
      },
      {
        id:'pvp-duelist-subsystems', stage:'Targeting', type:'demonstrate', title:'Use target information instead of tunnel vision',
        objective:'Practice reading the opponent’s ship state and using subsystem targeting when it has a clear purpose for the matchup. Do not let module targeting pull your attention away from survival or basic weapon application.',
        why:'Subsystem pressure can matter, but only when it supports the fight you are actually having. This task teaches purpose rather than button-pressing.',
        checklist:['Opponent condition monitored.','Subsystem targeting used only with a stated purpose.','Basic flying remained under control.'],
      },
      {
        id:'pvp-duelist-change', stage:'Refine', type:'challenge', title:'Change one bottleneck, not the entire build',
        objective:'Choose one meaningful technique or ship change based on the baseline—such as distributor behavior, thermal pressure, weapon mix, defense, or movement habit—then rerun comparable duel rounds.',
        why:'A single controlled change creates evidence. Rebuilding the entire ship after every loss destroys the comparison.',
        checklist:['One major variable changed.','Comparable rounds completed.','Effect on the original bottleneck compared.','Change kept, reverted, or refined based on evidence.'],
        link:{ label:'Open Engineering Guide', url:ENGINEERING },
      },
      {
        id:'pvp-duelist-graduate', stage:'Graduate', type:'challenge', title:'Complete a measured duel set',
        objective:'Complete at least three structured rounds against a competent partner while deliberately managing range, pip transitions, exchanges, and resets. Debrief the repeated pattern rather than only the win/loss count.',
        why:'The goal is repeatable control. One spectacular win teaches less than three rounds that reveal the same decision pattern.',
        checklist:['At least three rounds completed.','Range managed deliberately.','Bad exchanges reset deliberately.','Repeated pattern identified in debrief.'],
      },
    ],
  },
  {
    id:'pvp-precision-fighter',
    band:'Developing / Experienced',
    title:'Precision Fighter — Aim, Prediction & Weapon Application',
    subtitle:'Build reliable fixed-weapon and high-skill weapon application without letting aim practice destroy positioning or survivability.',
    audience:'For a Commander who wants to improve rails, plasma, fixed lasers/cannons, or another aim-dependent package and needs better prediction, convergence, trigger discipline, and firing-window selection.',
    outcome:'Graduate by demonstrating more consistent high-quality firing windows with an aim-dependent package, while keeping pips, movement, heat, and survival under control.',
    sourceNote:'This is not a requirement to abandon gimbals or copy one fashionable weapon package. It is a route for Commanders who deliberately choose weapons whose payoff depends on prediction and precision.',
    sources:[
      { label:'Mongrel Ship Catalogue', url:SHIPS },
      { label:'Engineering & Shipbuilding Guide', url:ENGINEERING },
      { label:'PvP Hub', url:PVP_HUB },
    ],
    tasks:[
      {
        id:'pvp-precision-package', stage:'Setup', type:'build', title:'Choose one precision package to train',
        objective:'Pick the aim-dependent weapon package you actually want to improve and state what each weapon is supposed to do. Keep the rest of the ship stable enough that aim—not a full rebuild—is the variable you are training.',
        why:'Precision improves faster when you know what shot you are waiting for and do not change the whole platform between practice sessions.',
        checklist:['Weapon package chosen.','Purpose of each major weapon stated.','Fire groups practical.','Heat/distributor/ammo constraints understood.'],
      },
      {
        id:'pvp-precision-window', stage:'Firing Window', type:'demonstrate', title:'Stop taking low-quality shots',
        objective:'In controlled practice, deliberately withhold fire when the geometry is poor and commit when the target motion, range, and convergence create a high-quality shot. Compare hit quality with your normal trigger habits.',
        why:'Accuracy is partly a shooting skill and partly a decision not to waste the shot before the window exists.',
        checklist:['Low-quality shots intentionally withheld.','Several deliberate firing windows created.','Hit quality compared with normal habits.'],
      },
      {
        id:'pvp-precision-prediction', stage:'Prediction', type:'demonstrate', title:'Aim where the target is going, not where it was',
        objective:'Practice reading the opponent’s vector through turns, boosts, reversals, and passes. Use repeated drills to improve lead/prediction rather than relying on last-second correction alone.',
        why:'Human opponents create less predictable motion than NPCs. Prediction turns brief alignment into usable damage.',
        checklist:['Target vector read deliberately.','Repeated identical or similar passes practiced.','One recurring prediction error identified.'],
      },
      {
        id:'pvp-precision-heat', stage:'Sustain', type:'demonstrate', title:'Keep precision damage sustainable',
        objective:'Track WEP, heat, ammo, and defensive state while using the precision package. Practice stopping the attack before the ship’s resource state ruins the next exchange.',
        why:'A perfect shot is not useful if it overheats the ship, empties the distributor, or leaves you unable to defend the next pass.',
        checklist:['WEP state monitored.','Heat/ammo constraint monitored if relevant.','At least one attack ended early to preserve the next exchange.'],
      },
      {
        id:'pvp-precision-pressure', stage:'Pressure Test', type:'challenge', title:'Keep the aim when the opponent fights back',
        objective:'Run practice rounds where the partner actively pressures you instead of presenting cooperative passes. Maintain basic defense and positioning while still creating deliberate precision shots.',
        why:'Range practice only matters when the skill survives the cognitive load of a real opponent.',
        checklist:['Opponent applied real pressure.','Survival/pips remained functional.','Precision shots still created deliberately.','Main breakdown under pressure identified.'],
      },
      {
        id:'pvp-precision-graduate', stage:'Graduate', type:'challenge', title:'Prove the package in a complete duel set',
        objective:'Complete several structured PvP rounds using the precision package. Judge success by useful hit quality, pressure created, resource control, and decision-making—not only by whether the final hull reached zero.',
        why:'A precision package is successful when it produces repeatable pressure without forcing the rest of your flying to collapse.',
        checklist:['Several rounds completed.','Useful hit quality improved or remained consistent.','Ship resources stayed manageable.','Next precision priority identified.'],
      },
    ],
  },
  {
    id:'pvp-wing-fighter',
    band:'Experienced',
    title:'Wing Fighter — Focus, Comms & Mutual Support',
    subtitle:'Move from individual dueling skill into coordinated wing PvP where target calls, positioning, survival, and disciplined switches matter more than personal score.',
    audience:'For a Commander who is comfortable in 1v1 combat and wants to become useful in organized small-group PvP, defensive response, escorts, or squad combat operations.',
    outcome:'Graduate by completing organized wing practice with clear comms, disciplined target focus, at least one coordinated target switch or disengagement, and a debrief that improves the group rather than only the individual.',
    sourceNote:'Wing PvP is not several simultaneous duels. The route emphasizes shared target pressure, keeping teammates alive, and acting on the same tactical picture.',
    sources:[
      { label:'PvP Hub', url:PVP_HUB },
      { label:'Projects & Events', url:PROJECTS },
      { label:'Mongrel Ship Catalogue', url:SHIPS },
    ],
    tasks:[
      {
        id:'pvp-wing-role', stage:'Role', type:'wing', title:'State what your ship contributes to the wing',
        objective:'Before the fight, define the ship’s real role: pressure, burst damage, control, support, survivability, pursuit, or another clear function. Explain what the wing should and should not expect from you.',
        why:'A wing becomes easier to coordinate when each pilot understands what their platform can reliably contribute.',
        checklist:['Role stated.','Primary strength stated.','Major limitation stated.','Expected wing contribution clear.'],
      },
      {
        id:'pvp-wing-comms', stage:'Comms', type:'wing', title:'Practice short useful combat calls',
        objective:'Use concise calls for target, pressure, disengagement, status, and major problems. Avoid filling comms with a continuous narration that prevents the wing from hearing decisions.',
        why:'PvP comms must be fast enough to change behavior. Information that arrives late or buried in noise does not help the wing.',
        checklist:['Target calls concise.','Major status/problem calls concise.','Disengagement call understood.','Unnecessary narration reduced.'],
      },
      {
        id:'pvp-wing-focus', stage:'Focus Fire', type:'wing', title:'Put the wing on the same target',
        objective:'Practice rapidly acquiring the called target and keeping useful pressure on it without sacrificing your own survival. Rejoin focus after evasive resets instead of drifting into a private duel.',
        why:'Shared pressure is one of the largest advantages a coordinated wing has over an uncoordinated group.',
        checklist:['Called target acquired quickly.','Pressure maintained when practical.','Private-duel drift corrected.','Rejoined focus after a defensive reset.'],
      },
      {
        id:'pvp-wing-switch', stage:'Target Switch', type:'wing', title:'Switch targets for a reason',
        objective:'Practice at least one coordinated target switch based on a clear tactical reason such as vulnerability, separation, defense state, or a changing threat. Confirm the new target instead of assuming everyone saw the same opportunity.',
        why:'Good target switching converts changing conditions into pressure; random switching scatters damage.',
        checklist:['Reason for switch stated.','New target confirmed.','Wing pressure moved together.','Old target was not chased automatically.'],
      },
      {
        id:'pvp-wing-survival', stage:'Mutual Support', type:'wing', title:'Help a pressured wingmate survive',
        objective:'During practice, recognize when a teammate is under serious focus and respond through pressure, peel, target switch, positioning, or a coordinated disengagement plan appropriate to the wing.',
        why:'Wing PvP is partly the art of keeping enough ships functional for the group to retain options.',
        checklist:['Pressured teammate identified.','Wing response communicated.','At least one mutual-support action attempted.','Result debriefed.'],
      },
      {
        id:'pvp-wing-capstone', stage:'Capstone', type:'wing', title:'Complete a structured wing fight and debrief it',
        objective:'Run an organized small-group fight or training scenario with clear roles, calls, focus, at least one target switch, and an agreed disengagement/stop condition. Debrief the group pattern afterward.',
        why:'The wing route is complete when you can contribute to the shared tactical picture instead of only surviving your own matchup.',
        checklist:['Structured wing fight completed.','Roles/comms used.','Focus and target switch demonstrated.','Stop/disengagement condition respected.','Group debrief completed.'],
      },
    ],
  },
  {
    id:'pvp-lead',
    band:'Veteran / Mentor',
    title:'PvP Lead — Plan, Command, Teach',
    subtitle:'Turn individual combat skill into safe training, disciplined wing leadership, build diagnosis, and better PvP pilots across the squad.',
    audience:'For a veteran PvP pilot who can already duel and wing-fight independently and is ready to organize training or combat without turning leadership into personal kill chasing.',
    outcome:'Graduate by planning and leading a PvP session, adapting the plan once, mentoring another Commander through one specific skill, and publishing a useful debrief or follow-up recommendation.',
    sourceNote:'Veteran PvP is not just winning more fights. It is creating useful practice, making calm decisions under pressure, protecting squad standards, and helping other pilots become less dependent on the mentor.',
    sources:[
      { label:'PvP Hub', url:PVP_HUB },
      { label:'Mongrel Squadron Rules', url:RULES },
      { label:'Projects & Events', url:PROJECTS },
      { label:'Mongrel Ship Catalogue', url:SHIPS },
    ],
    tasks:[
      {
        id:'pvp-lead-plan', stage:'Planning', type:'mentor', title:'Design a PvP session with one clear objective',
        objective:'Plan a training night, duel set, wing drill, escort-defense exercise, or other PvP session with a specific skill objective, expected ships/capabilities, start/stop rules, and a useful end condition.',
        why:'Good PvP leadership creates repetitions that teach something. “Everyone bring a combat ship and fight” is an event, not a training plan.',
        checklist:['Training/combat objective defined.','Participant capability considered.','Start/stop conditions defined.','Useful end condition defined.'],
      },
      {
        id:'pvp-lead-brief', stage:'Brief', type:'mentor', title:'Brief conduct, roles, and disengagement before launch',
        objective:'Give a concise brief covering Mongrel conduct, the session objective, roles, comms expectations, and how the group ends or disengages. Make the no-combat-logging standard explicit when the exercise involves destruction risk.',
        why:'A clear brief prevents confusion from being mistaken for tactical failure and protects the squad’s conduct standard when pressure rises.',
        checklist:['Objective briefed.','Roles/comms briefed.','Stop/disengagement briefed.','No-combat-logging standard reinforced.'],
        link:{ label:'Read Squadron Rules', url:RULES },
      },
      {
        id:'pvp-lead-run', stage:'Lead', type:'wing', title:'Lead the fight and adapt once',
        objective:'Run the session and make at least one real adjustment based on participant skill, matchup, comms quality, repeated failure, or an unexpected condition. Explain the change instead of silently changing the rules.',
        why:'A good leader preserves the training objective while adapting the scenario to what is actually happening.',
        checklist:['Session completed.','At least one real adaptation made.','Reason for adaptation communicated.','Original objective preserved or deliberately revised.'],
      },
      {
        id:'pvp-lead-build-review', stage:'Diagnosis', type:'mentor', title:'Review a build without prescribing your own ship',
        objective:'Help another Commander identify one PvP bottleneck in their own build or weapon package. Separate pilot-skill issues from ship issues and recommend the smallest useful test rather than replacing the entire build with your preference.',
        why:'Mentoring should improve judgement. A copied build can hide the reasoning the Commander needs for future matchups.',
        checklist:['Commander’s intended role understood.','Pilot issue separated from build issue.','One small test/change recommended.','Reasoning explained.'],
        link:{ label:'Open Engineering Guide', url:ENGINEERING },
      },
      {
        id:'pvp-lead-mentor', stage:'Teach / Mentor', type:'mentor', title:'Make another pilot more independent',
        objective:'Mentor another Mongrel through one specific PvP skill—pips, range, boost timing, fixed-weapon application, escape, target calls, or matchup reading—and let them perform the skill themselves under pressure.',
        why:'The goal is not to become someone’s permanent shot-caller. It is to improve their decision-making until they can diagnose the situation without you.',
        checklist:['One specific skill selected.','Commander performed it themselves.','Feedback focused on process/decision-making.','They can describe how to repeat the skill.'],
      },
      {
        id:'pvp-lead-debrief', stage:'Debrief', type:'mentor', title:'Publish the lesson, not just the score',
        objective:'Create a concise debrief covering what the group practiced, what repeatedly failed, what adaptation helped, and one next training recommendation. Preserve useful build or matchup findings without turning one session into universal doctrine.',
        why:'A good PvP session should leave the squad with better pilots and better information, not only a winner list.',
        checklist:['Training objective reviewed.','Repeated failure/success pattern recorded.','Adaptation result recorded.','One next recommendation stated.','Uncertainty preserved where appropriate.'],
      },
    ],
  },
];

export function eligiblePvpRoutes(experience = 'new') {
  if (experience === 'experienced') return ['pvp-lead','pvp-wing-fighter','pvp-precision-fighter'];
  if (experience === 'comfortable') return ['pvp-wing-fighter','pvp-precision-fighter','pvp-duelist'];
  if (experience === 'some') return ['pvp-duelist','pvp-precision-fighter','pvp-foundations'];
  return ['pvp-foundations'];
}

export function getPvpRoute(id) {
  return PVP_ROUTES.find(route => route.id === id) || null;
}
