import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the shipped controller's handlers with delayed HTTP responses.
// Rendering is excluded here; the regression is request ordering and intent.
const html = fs.readFileSync(new URL('../downloads/mongrel-hud/controller.html', import.meta.url), 'utf8');
const inline = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(inline, 'Controller inline script exists');
const tick = () => new Promise(resolve => setImmediate(resolve));
const clone = value => JSON.parse(JSON.stringify(value));

function harness(storage = new Map()) {
  const nodes = new Map();
  function node(id, attrs = {}) {
    if (nodes.has(id)) return nodes.get(id);
    const classes = new Set();
    const value = {
      value: '', textContent: '', innerHTML: '', className: '', style: {},
      classList: {
        toggle(name, force) { const enabled = force === undefined ? !classes.has(name) : force; if (enabled) classes.add(name); else classes.delete(name); },
        add(name) { classes.add(name); }, remove(name) { classes.delete(name); }, contains(name) { return classes.has(name); },
      },
      getAttribute(name) { return attrs[name]; }, addEventListener() {}, querySelectorAll() { return []; },
    };
    nodes.set(id, value);
    return value;
  }
  const profileButtons = ['combat', 'surface', 'navigation'].map(profile => node(profile + 'Button', { 'data-profile': profile }));
  const visibilityButtons = ['own', 'surface', 'mission'].map(panel => node(panel + 'Visible', { 'data-panel-visible': panel }));
  const pcSystemPasteButtons = [
    node('pcPasteCarrierSource', {'data-pc-system-target': 'carrierRouteSource'}),
    node('pcPasteCarrierDestination', {'data-pc-system-target': 'carrierRouteDestination'}),
    node('pcPasteShipDestination', {'data-pc-system-target': 'routeDestination'}),
  ];
  const profileSelects = ['own', 'surface', 'mission'].map(panel => node(panel + 'Profiles', { 'data-panel-profile': panel }));
  const requests = [];
  const backend = {
    profile: 'combat',
    layout: {
      locked: true, masterVisible: true,
      panels: {
        own: { visible: true, scale: 1, profiles: ['combat'] },
        surface: { visible: true, scale: 1, profiles: ['surface'] },
        mission: { visible: true, scale: 0.9, profiles: ['combat', 'surface'] },
      },
    },
  };
  const context = {
    document: {
      getElementById: node,
      querySelectorAll(selector) {
        return ({ '[data-profile]': profileButtons, '[data-panel-visible]': visibilityButtons, '[data-panel-profile]': profileSelects, '[data-pc-system-target]': pcSystemPasteButtons })[selector] || [];
      }, addEventListener() {}, activeElement: null,
    },
    confirm(){return true},
    localStorage:{getItem(k){return storage.get(k)||null},setItem(k,v){storage.set(k,v)}},
    setTimeout,clearTimeout,
    fetch(path, options) {
      return new Promise(resolve => requests.push({ path, body: options.body === undefined ? null : JSON.parse(options.body), resolve }));
    },
  };
  vm.createContext(context);
  const expose = 'globalThis.testController={setState(v){state=v},getState(){return state},load,render,api,diagnosticText,renderFlightManifest,renderScoutNetwork,renderRavenCart,renderSourcingControls,renderDataDisplay,dataArtwork,dataBody,dataStation,dataFaction,dataOperations,dataSignalLabel,setDataFocus,dataPlacements,setDataVisible,setDataPrimary,resetDataLayout,openDataLayout,closeDataLayout,pinDataTarget,clearDataPin,getDataLayout(){return dataLayout},openDataDetail,setDataReport(v){dataReport=v;controllerTab="data";dataRequestedAddress=String(v.address);dataLastAttempt=Date.now();renderDataDisplay()},deckEnqueue,deckCancelInputs,deckStartHold,deckStopHold,setDeck(v){controllerTab="deck";deckActions=v;renderDeck()},setDeckProfile(v){deckProfile=v;renderDeck()},setSourcingResult(v){sourcingResult=v},renderSourcingResults,setRavenManualRefresh(v){ravenManualRefresh=v},expireRavenNotice(){ravenManualNoticeUntil=Date.now()-1},renderSurveyorDiscovery,renderSurveyorControls,renderCarrierRoute,restoreSavedCarrierPlan,disableRender(){render=function(){}}};';
  assert.ok(inline.includes('load();setInterval(load,1000);'), 'Initial poll entry point is present');
  vm.runInContext(inline.replace('load();setInterval(load,1000);', expose), context);
  context.testController.disableRender();
  context.testController.setState(clone(backend));

  function respond(request, failure = null, payload = null) {
    if (failure) {
      request.resolve({ ok: false, json: async () => ({ error: failure }) });
      return;
    }
    if (request.path === '/api/profile') backend.profile = request.body.profile;
    if (request.path === '/api/layout') Object.assign(backend.layout, request.body);
    if (request.path === '/api/panel') {
      const { panel, ...settings } = request.body;
      Object.assign(backend.layout.panels[panel], settings);
    }
    const result = payload || { ok: true, ...clone(backend) };
    request.resolve({ ok: true, json: async () => result });
  }
  return { node, requests, backend, respond, controller: context.testController };
}

async function drain(h, expected) {
  for (let index = 0; index < expected.length; index++) {
    await tick();
    assert.equal(h.requests.length, index + 1, 'Only one queued mutation is in flight');
    const request = h.requests[index];
    assert.equal(request.path, expected[index].path);
    assert.deepEqual(request.body, expected[index].body);
    h.respond(request);
  }
  await tick();
}

{
  const h = harness();
  const assignments = clone(h.backend.layout.panels);
  const actions = [
    h.node('surfaceButton').onclick(),
    h.node('overlayMaster').onclick(),
    h.node('overlayMaster').onclick(),
    h.node('layoutLock').onclick(),
    h.node('layoutLock').onclick(),
    h.node('ownVisible').onclick(),
    h.node('ownVisible').onclick(),
    h.node('combatButton').onclick(),
  ];
  await drain(h, [
    { path: '/api/profile', body: { profile: 'surface' } },
    { path: '/api/layout', body: { masterVisible: false } },
    { path: '/api/layout', body: { masterVisible: true } },
    { path: '/api/layout', body: { locked: false } },
    { path: '/api/layout', body: { locked: true } },
    { path: '/api/panel', body: { panel: 'own', visible: false } },
    { path: '/api/panel', body: { panel: 'own', visible: true } },
    { path: '/api/profile', body: { profile: 'combat' } },
  ]);
  await Promise.all(actions);
  assert.deepEqual(clone(h.controller.getState()), h.backend, 'Controller matches the final backend response');
  assert.deepEqual(h.backend.layout.panels, assignments, 'Combat/Surface/Both assignments survive overlapping controls');
}

{
  const h = harness();
  const actions = [];
  const expected = [];
  for (let cycle = 0; cycle < 12; cycle++) {
    for (const profile of ['surface', 'combat']) {
      actions.push(h.node(profile + 'Button').onclick());
      expected.push({ path: '/api/profile', body: { profile } });
      for (const [button, field] of [['overlayMaster', 'masterVisible'], ['layoutLock', 'locked']]) {
        for (const value of [false, true]) {
          actions.push(h.node(button).onclick());
          expected.push({ path: '/api/layout', body: { [field]: value } });
        }
      }
    }
  }
  await drain(h, expected);
  await Promise.all(actions);
  assert.equal(h.backend.profile, 'combat');
  assert.equal(h.backend.layout.masterVisible, true);
  assert.equal(h.backend.layout.locked, true);
  assert.deepEqual(clone(h.controller.getState()), h.backend);
}

{
  const h = harness();
  const select = h.node('ownProfiles');
  const actions = [];
  const expected = [];
  for (const profiles of [['surface'], ['combat', 'surface'], ['combat']]) {
    select.value = profiles.length === 2 ? 'both' : profiles[0];
    actions.push(select.onchange());
    expected.push({ path: '/api/panel', body: { panel: 'own', profiles } });
    actions.push(h.node('surfaceButton').onclick());
    expected.push({ path: '/api/profile', body: { profile: 'surface' } });
  }
  await drain(h, expected);
  await Promise.all(actions);
  assert.deepEqual(h.backend.layout.panels.own.profiles, ['combat']);
  assert.deepEqual(h.backend.layout.panels.surface.profiles, ['surface']);
  assert.deepEqual(h.backend.layout.panels.mission.profiles, ['combat', 'surface']);
}

{
  const h = harness();
  const first = h.node('overlayMaster').onclick();
  const next = h.node('layoutLock').onclick();
  await tick();
  assert.equal(h.requests.length, 1);
  h.respond(h.requests[0], 'upstream_test_failure');
  await first;
  assert.match(h.node('layoutStatus').textContent, /Display control failed/);
  await tick();
  assert.equal(h.requests.length, 2, 'Failed request does not strand the mutation queue');
  assert.deepEqual(h.requests[1].body, { locked: false });
  h.respond(h.requests[1]);
  await next;
  assert.equal(h.backend.layout.masterVisible, true);
  assert.equal(h.backend.layout.locked, false);
}

{
  const h = harness();
  const stale = clone(h.backend);
  const poll = h.controller.load(true);
  const change = h.node('surfaceButton').onclick();
  await tick();
  assert.equal(h.requests.length, 2);
  h.respond(h.requests[1]);
  await change;
  h.respond(h.requests[0], null, stale);
  await poll;
  assert.equal(h.controller.getState().profile, 'surface', 'An older state poll cannot undo a completed profile mutation');
}

{
  const h = harness();
  const diagnostics = {
    bridgeStatus: 502, upstreamStatus: 500, errorCode: '1102', responseFormat: 'json',
    endpoint: 'https://ten16-archive.pages.dev/api/mining-centers',
    detail: 'private raw response must not be displayed',
  };
  h.controller.setState({
    ...clone(h.backend), connected: true,
    siteFeed: { generatedAt: '2026-10-04T01:00:00Z' },
    siteFeedStatus: { ok: false, upstreamStatus: 503, errorCode: '1102', responseFormat: 'json' },
    miningStatus: { ok: false, depositsOk: true, centersOk: false, centersSource: 'cache', centersDiagnostics: diagnostics },
    renderErrors: [{ panel: 'mission', errorType: 'ValueError' }],
  });
  h.controller.render();
  assert.match(h.node('siteFeedStatus').textContent, /Retained site feed.*upstream HTTP 503.*Cloudflare 1102/);
  assert.match(h.node('miningDbStatus').textContent, /Scout HTTP 502.*upstream HTTP 500.*Cloudflare 1102/);
  assert.match(h.node('miningDbStatus').textContent, /centers from outage cache/);
  assert.match(h.node('connection').textContent, /Panel errors: mission \(ValueError\)/);
  assert.doesNotMatch(h.node('miningDbStatus').textContent, /private/);
  const failure = h.controller.api('/api/site-center', { siteNumber: 10 }).catch(error => error);
  h.requests[0].resolve({ ok: false, status: 502, json: async () => ({ ok: false, error: 'http_500', detail: 'private raw response', diagnostics }) });
  const error = await failure;
  assert.match(error.message, /Scout HTTP 502.*upstream HTTP 500.*Cloudflare 1102/);
  assert.equal(error.status, 502);
  assert.equal(error.code, 'http_500', 'Formatted HTTP message preserves the machine error code');
  assert.doesNotMatch(error.message, /private/);

  h.controller.setState({ ...clone(h.backend), connected: true, siteFeedStatus: { ok: true }, miningStatus: { ok: true, centersSource: 'central' } });
  h.controller.render();
  assert.equal(h.node('connection').textContent, 'Scout connected');
  assert.match(h.node('miningDbStatus').textContent, /centers from central database/);
  assert.doesNotMatch(h.node('miningDbStatus').textContent, /outage cache|HTTP 500/);
}

{
  const h = harness();
  h.node('pair').classList.add('hidden');
  const poll = h.controller.load(true);
  h.requests[0].resolve({ ok: false, status: 401, json: async () => ({ ok: false, error: 'pair_required' }) });
  await poll;
  assert.equal(h.node('pair').classList.contains('hidden'), false, 'Restarted HUD / expired pairing cookie reveals the pairing screen');
}


{
  const h=harness();
  const nav=h.node('navigationButton').onclick();
  await tick();
  assert.equal(h.requests[0].path,'/api/profile');
  assert.equal(h.requests[0].body.profile,'navigation');
  h.respond(h.requests[0]);
  await nav;
  assert.equal(h.backend.profile,'navigation');
  const assignment=h.backend.layout.panels.own.profiles;
  assert.deepEqual(assignment,['combat'],'Navigation profile must not rewrite Combat');
}

{
  const h=harness();
  const manifest=[
    {system:'Start',neutron:false},
    {system:'First Neutron',neutron:true},
    {system:'Unlisted <unsafe>',neutron:true},
    {system:'Diaba',neutron:false},
  ];
  h.controller.renderFlightManifest({id:'route-test',waypoints:manifest},{id:'route-test'},
    {routeId:'route-test',waypointIndex:0});
  assert.match(h.node('routeManifest').innerHTML,/First Neutron/);
  assert.match(h.node('routeManifest').innerHTML,/is-next/);
  assert.match(h.node('routeManifest').innerHTML,/&lt;unsafe&gt;/,'System names must be escaped for iPad markup');
  assert.equal((h.node('routeManifest').innerHTML.match(/class="waypoint-line/g)||[]).length,4,'All waypoints render, not only first few');
  h.controller.renderScoutNetwork({summary:{available:3,claimed:1,priority:2},jobs:[{system:'Miwae',rewardMillions:10,status:'available'}]});
  assert.match(h.node('scoutNetworkJobs').innerHTML,/Miwae/);
  assert.match(h.node('scoutNetworkStatus').textContent,/AVAILABLE 3/);
}

{
  const h=harness();
  h.node('routeDestination').value='Diaba';
  h.node('routeEfficiency').value='60';
  const plot=h.node('routePlot').onclick();
  await tick();
  assert.equal(h.requests[0].path,'/api/route');
  assert.deepEqual(h.requests[0].body,{action:'plot',mode:'neutron',destination:'Diaba',efficiency:60});
  h.respond(h.requests[0],null,{ok:true,id:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',status:'pending'});
  await plot;
  assert.equal(h.node('routeJobId').value,'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  const check=h.node('routeCheck').onclick();
  await tick();
  assert.equal(h.requests[1].path,'/api/route');
  assert.deepEqual(h.requests[1].body,{action:'check',routeId:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'});
  h.respond(h.requests[1],null,{ok:true,status:'ready',id:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    waypoints:[{system:'Start'},{system:'Diaba'}],navigationTargetCount:1,destination:'Diaba',ship:'Leaf'});
  await check;
  assert.match(h.node('routePlotStatus').textContent,/Ready/);
  assert.equal(h.requests.length,2,'Plotting and checking must not send activation');
}

{
  const h=harness();
  h.node('routeMode').value='galaxy';
  h.node('routeDestination').value='NGC 2546 Sector UZ-G d10-16';
  h.node('routeEfficiency').value='60';
  const pending=h.node('routePlot').onclick();
  await tick();
  assert.equal(h.requests[0].path,'/api/route');
  assert.deepEqual(h.requests[0].body,{
    action:'plot',mode:'galaxy',destination:'NGC 2546 Sector UZ-G d10-16',efficiency:60,
  });
  h.respond(h.requests[0],null,{ok:true,id:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',status:'pending'});
  await pending;
  const check=h.node('routeCheck').onclick();
  await tick();
  h.respond(h.requests[1],null,{ok:true,status:'ready',id:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    routeType:'galaxy_exact_jumps',fuelStops:1,navigationTargetCount:3,
    waypoints:[{system:'Start'},{system:'Neutron A',neutron:true,fuelInTank:99},
      {system:'Scoop B',fuelStop:true,fuelInTank:7},{system:'End',fuelInTank:120}]});
  await check;
  assert.match(h.node('routePlotStatus').textContent,/1 scheduled fuel stops/);
  h.controller.renderFlightManifest(
    {id:'galaxy-route',routeType:'galaxy_exact_jumps',waypoints:[{system:'Start'},{system:'Scoop B',fuelStop:true},{system:'End'}]},null,{});
  assert.match(h.node('routeManifest').innerHTML,/REFUEL/);
  assert.equal(h.requests.length,2,'Galaxy plotting never activates a route');
}
{
  const h=harness();
  // Manual clipboard repeat is a single local command to Scout, not plotting.
  const copy=h.node('routeCopyNext').onclick();
  await tick();
  assert.equal(h.requests[0].path,'/api/route');
  assert.deepEqual(h.requests[0].body,{action:'copy'});
  h.respond(h.requests[0],null,{ok:true,queued:true,nextSystem:'TEST NEUTRON'});
  await copy;
  assert.match(h.node('routeNotice').textContent,/Serenity/);
  assert.equal(h.requests.length,1);
}
{
  const h=harness();
  h.controller.renderFlightManifest(
    {id:'route-complete',waypoints:[{system:'Start'},{system:'Neutron'},{system:'Diaba'}]},
    null,{routeId:'route-complete',completed:true,waypointIndex:2});
  const marked=h.node('routeManifest').innerHTML;
  assert.equal((marked.match(/is-reached/g)||[]).length,3,
    'Completed manifest must retain reached indicators even after Cloudflare clears active route');
}
{
  // EDDiscovery archive values must be visible without inflating expedition earnings.
  const h=harness();
  h.controller.renderSurveyorDiscovery({
    bodies:[{name:'TEST SYSTEM 1',currentValue:12345,personallyMapped:true,wasDiscovered:false}],
    eddiscoveryHistory:{bodies:[
      {name:'TEST SYSTEM 1',estimatedValue:23456,personallyMapped:true},
      {name:'TEST SYSTEM 2',estimatedValue:null,personallyMapped:false},
    ]},
  });
  const shown=h.node('surveyorDiscoveryRows').innerHTML;
  assert.match(shown,/JOURNAL EST\.<\/strong>|JOURNAL EST\. 12,345 CR/, 'Journal estimate remains visible');
  assert.match(shown,/EDD HIST\. EST\. 23,456 CR/, 'Matching historical body retains its EDD value');
  assert.match(shown,/EDD HIST\. EST\. VALUE UNAVAILABLE/, 'Missing EDD values are not silently zero');
  assert.match(shown,/1 \/ 2 bodies/, 'The report discloses history-value coverage');
  assert.match(shown,/Not expedition credits/, 'Historical data must not be framed as new earnings');
}

{
  const h=harness();
  h.node('carrierRouteSource').value='Diaba';
  h.node('carrierRouteDestination').value='Colonia';
  h.node('carrierUsedCapacity').value='12500';
  h.node('carrierTankFuel').value='1000';
  h.node('carrierStoredTritium').value='400';
  h.node('carrierDetermineTritium').checked=true;
  const action=h.node('carrierPlot').onclick();
  await tick();
  assert.equal(h.requests.length,1);
  assert.equal(h.requests[0].path,'/api/route');
  assert.deepEqual(h.requests[0].body,{
    action:'plot',mode:'carrier',source:'Diaba',destination:'Colonia',
    usedCapacity:12500,tankFuel:1000,storedTritium:400,determineTritium:true,
  });
  h.respond(h.requests[0],null,{ok:true,id:'cccccccc-dddd-eeee-ffff-111111111111',routeType:'fleet_carrier',source:'Diaba',destination:'Colonia',status:'pending'});
  await action;
  assert.equal(h.node('carrierRouteJobId').value,'cccccccc-dddd-eeee-ffff-111111111111');
  assert.match(h.node('carrierRouteManifest').textContent,/Waiting for CHECK \/ LOAD RESULT/);
  assert.match(h.node('carrierPlotStatus').textContent,/Select CHECK \/ LOAD RESULT/);
  const check=h.node('carrierCheck').onclick();
  await tick();
  assert.deepEqual(h.requests[1].body,{action:'check',routeId:'cccccccc-dddd-eeee-ffff-111111111111',source:'Diaba',destination:'Colonia'});
  h.respond(h.requests[1],null,{
    ok:true,routeType:'fleet_carrier',status:'ready',id:'cccccccc-dddd-eeee-ffff-111111111111',
    source:'Diaba',destination:'Colonia',totalDistance:600,totalTritiumUsed:157,
    tankFuel:1000,storedTritium:400,restockStops:1,
    waypoints:[
      {system:'Diaba',distance:0,fuelUsed:0,fuelInTank:1000},
      {system:'X <danger>',distance:400,fuelUsed:94,fuelInTank:906,mustRestock:true,restockAmount:70,hasIcyRing:true},
      {system:'Colonia',distance:200,fuelUsed:63,fuelInTank:843},
    ],
  });
  await check;
  assert.match(h.node('carrierRouteSummary').innerHTML,/157 t/);
  assert.match(h.node('carrierRouteSummary').innerHTML,/Estimated Tritium burn/);
  assert.match(h.node('carrierRouteSummary').innerHTML,/Carrier jumps/);
  assert.match(h.node('carrierRouteSummary').innerHTML,/Total distance/);
  assert.match(h.node('carrierRouteSummary').innerHTML,/ROUTE SUMMARY/);
  assert.doesNotMatch(h.node('carrierRouteSummary').innerHTML,/Spansh burn/);
  assert.match(h.node('carrierRouteManifest').innerHTML,/&lt;danger&gt;/);
  assert.match(h.node('carrierRouteManifest').innerHTML,/RESTOCK/);
  assert.match(h.node('carrierRouteManifest').innerHTML,/COPY TO PC/);
  assert.match(h.node('carrierRouteManifest').innerHTML,/data-carrier-copy-index="1"/);
  assert.equal(h.requests.length,2,'Fleet Carrier plotting is preview-only');
  const copyButton={
    disabled:false,
    getAttribute(key){return key==='data-carrier-copy-index'?'1':null},
  };
  const copy=h.node('carrierRouteManifest').onclick({
    target:{closest(selector){return selector==='[data-carrier-copy-index]'?copyButton:null}},
  });
  await tick();
  assert.equal(h.requests[2].path,'/api/clipboard/system');
  assert.deepEqual(h.requests[2].body,{action:'copy_to_pc',system:'X <danger>'});
  assert.equal(copyButton.disabled,true,'Copy button disables while sending');
  h.respond(h.requests[2],null,{ok:true,system:'X <danger>'});
  await copy;
  assert.equal(copyButton.disabled,false);
  assert.match(h.node('carrierCopyNotice').textContent,/Copied X <danger> to this PC/);
  assert.equal(h.requests.length,3,'One explicit copy command per button tap');

  // Starting a carrier journey persists the loaded route (origin completed),
  // then one large tap-target checkbox confirms only the next hop.
  const journeyStart=h.node('carrierJourneyStart').onclick();
  await tick();
  assert.equal(h.requests[3].path,'/api/carrier-journey');
  assert.equal(h.requests[3].body.action,'start');
  assert.equal(h.requests[3].body.route.source,'Diaba');
  const activeJourney={
    id:'cccccccc-dddd-eeee-ffff-111111111111',status:'active',
    routeType:'fleet_carrier',source:'Diaba',destination:'Colonia',
    completedIndex:0,completedJumps:0,totalJumps:2,remainingJumps:2,
    nextSystem:'X <danger>',totalDistance:600,totalTritiumUsed:157,estimatedTritiumRemaining:157,
    waypoints:[
      {system:'Diaba',distance:0,fuelUsed:0,fuelInTank:1000},
      {system:'X <danger>',distance:400,fuelUsed:94,fuelInTank:906},
      {system:'Colonia',distance:200,fuelUsed:63,fuelInTank:843},
    ],cooldown:{status:'unknown'},
  };
  h.respond(h.requests[3],null,{ok:true,carrierJourney:activeJourney});
  await journeyStart;
  assert.match(h.node('carrierRouteManifest').innerHTML,/is-done/);
  assert.match(h.node('carrierRouteManifest').innerHTML,/data-carrier-complete-index="1"/);
  assert.match(h.node('carrierRouteManifest').innerHTML,/MARK ARRIVED/);
  assert.match(h.node('carrierJourneyStatus').textContent,/0 \/ 2 jumps/);

  h.controller.setState({connected:true,carrierJourney:{
    ...activeJourney,cooldown:{status:'scheduled',estimated:true,remainingSeconds:5400,
      departureAt:'2026-10-27T10:34:00Z'},
    scheduledDepartureAt:'2026-10-27T10:34:00Z',
  }});
  h.controller.renderCarrierRoute();
  assert.match(h.node('carrierJourneyCooldown').textContent,/JUMP PLOTTED/);
  assert.match(h.node('carrierJourneyCooldown').textContent,/01:30:00/);
  assert.match(h.node('carrierJourneyCooldown').textContent,/Estimate from journal schedule/);
  h.controller.setState({connected:true,carrierJourney:{
    ...activeJourney,cooldown:{status:'estimated_cooldown',estimated:true,
      remainingSeconds:225,readyAt:'2026-10-27T10:39:00Z'},
  }});
  h.controller.renderCarrierRoute();
  assert.match(h.node('carrierJourneyCooldown').textContent,/CARRIER COOLDOWN \(EST\.\)/);
  assert.match(h.node('carrierJourneyCooldown').textContent,/03:45/);
  h.controller.setState({connected:true,carrierJourney:{
    ...activeJourney,cooldown:{status:'estimated_ready',estimated:true,remainingSeconds:0,
      flashReady:true,readyAt:'2026-10-27T10:39:00Z'},
  }});
  h.controller.renderCarrierRoute();
  assert.match(h.node('carrierJourneyCooldown').textContent,/ESTIMATED READY/);
  assert.match(h.node('carrierJourneyCooldown').textContent,/Confirm in Carrier Management/);
  assert.equal(h.node('carrierJourneyCooldown').classList.contains('ready'),true);

  // Carrier phases are a distinct persistent feed, even if the old route
  // is completed. New plotting must immediately replace an old ready status.
  const completedJourney={
    ...activeJourney,status:'completed',completedIndex:2,completedJumps:2,
    remainingJumps:0,nextSystem:'',estimatedTritiumRemaining:0,
    cooldown:{status:'ready',remainingSeconds:0,flashReady:false},
  };
  h.controller.setState({connected:true,carrierJourney:completedJourney,carrierLive:{
    status:'plotted',label:'JUMP PLOTTED',remainingSeconds:1020,estimated:true,
    padStatus:'upcoming',padRemainingSeconds:820,destinationSystem:'New System',
  }});
  h.controller.renderCarrierRoute();
  assert.match(h.node('carrierJourneyCooldown').textContent,/JUMP PLOTTED/);
  assert.doesNotMatch(h.node('carrierJourneyCooldown').textContent,/COOLDOWN COMPLETE/);
  assert.match(h.node('carrierPadLockdown').textContent,/PAD LOCKDOWN IN 13:40/);
  assert.equal(h.node('carrierPadLockdown').classList.contains('active'),true);
  h.controller.setState({connected:true,carrierJourney:completedJourney,carrierLive:{
    status:'lockdown',label:'PAD LOCKDOWN · JUMP IMMINENT',remainingSeconds:200,
    padStatus:'locked',padRemainingSeconds:0,estimated:true,
  }});
  h.controller.renderCarrierRoute();
  assert.match(h.node('carrierJourneyCooldown').textContent,/PAD LOCKDOWN/);
  assert.match(h.node('carrierPadLockdown').textContent,/No landing or takeoff/);
  h.controller.setState({connected:true,carrierJourney:completedJourney,carrierLive:{
    status:'transit',label:'IN TRANSIT (EST.)',remainingSeconds:50,
    padStatus:'locked',padRemainingSeconds:0,estimated:true,
  }});
  h.controller.renderCarrierRoute();
  assert.match(h.node('carrierJourneyCooldown').textContent,/IN TRANSIT/);
  h.controller.setState({connected:true,carrierJourney:completedJourney,carrierLive:{
    status:'cooldown',label:'CARRIER COOLDOWN',remainingSeconds:225,
    padStatus:'open',estimated:false,
  }});
  h.controller.renderCarrierRoute();
  assert.match(h.node('carrierJourneyCooldown').textContent,/03:45/);
  assert.equal(h.node('carrierPadLockdown').textContent,'');
  h.controller.setState({connected:true,carrierJourney:completedJourney,carrierLive:{
    status:'ready',label:'COOLDOWN COMPLETE · READY TO JUMP',remainingSeconds:0,
    padStatus:'open',flashReady:true,estimated:false,
  }});
  h.controller.renderCarrierRoute();
  assert.match(h.node('carrierJourneyCooldown').textContent,/COOLDOWN COMPLETE/);
  assert.equal(h.node('carrierJourneyCooldown').classList.contains('ready'),true);


  // Return from the completed route status fixture to test sequential marking.
  h.controller.setState({connected:true,carrierJourney:activeJourney});
  h.controller.renderCarrierRoute();
  const checkbox={
    checked:true,
    getAttribute(key){return key==='data-carrier-complete-index'?'1':null},
  };
  const confirmJump=h.node('carrierRouteManifest').onchange({target:checkbox});
  await tick();
  assert.equal(h.requests[4].path,'/api/carrier-journey');
  assert.deepEqual(h.requests[4].body,{action:'confirm',index:1});
  h.respond(h.requests[4],null,{ok:true,carrierJourney:{
    ...activeJourney,completedIndex:1,completedJumps:1,remainingJumps:1,
    nextSystem:'Colonia',estimatedTritiumRemaining:63,completedVia:'manual',
    cooldown:{status:'cooldown',remainingSeconds:225,readyAt:'2026-10-27T10:38:00Z'},
  }});
  await confirmJump;
  assert.match(h.node('carrierJourneyCooldown').textContent,/03:45/);
  assert.match(h.node('carrierRouteManifest').innerHTML,/is-next/);
  assert.match(h.node('carrierRouteManifest').innerHTML,/Completed/);


}
{
  const h=harness();
  h.node('carrierRouteSource').value='Diaba';
  h.node('carrierRouteDestination').value='Colonia';
  h.node('carrierUsedCapacity').value='100';
  h.node('carrierTankFuel').value='1000';
  h.node('carrierStoredTritium').value='120';
  await h.node('carrierPlot').onclick();
  assert.equal(h.requests.length,0,'Invalid capacity and stock are blocked on the iPad');
}


{
  const h=harness();
  const clipboardActions=[
    ['pcPasteCarrierSource','carrierRouteSource','Diaba'],
    ['pcPasteCarrierDestination','carrierRouteDestination','Colonia'],
    ['pcPasteShipDestination','routeDestination','NGC 2546 Sector UZ-G d10-16'],
  ];
  for(const [buttonId,inputId,system] of clipboardActions){
    const action=h.node(buttonId).onclick();
    await tick();
    const request=h.requests.at(-1);
    assert.equal(request.path,'/api/clipboard/system');
    assert.deepEqual(request.body,{});
    h.respond(request,null,{ok:true,system});
    await action;
    assert.equal(h.node(inputId).value,system);
  }
  assert.equal(h.requests.length,3,'Each paste is one manual request, never background polling');
  assert.match(h.node('routePlotStatus').textContent,/Pasted from this PC/);
}


// A ready plan survives a HUD executable upgrade/reload without the cloud job.
{
  const h=harness();
  const restoration=h.controller.restoreSavedCarrierPlan();
  await tick();
  assert.equal(h.requests.length,1);
  assert.equal(h.requests[0].path,'/api/carrier-saved-route');
  assert.equal(h.requests[0].body,null,'Saved routes are read locally, not written or replotted');
  h.respond(h.requests[0],null,{ok:true,route:{
    ok:true,id:'aaaaaaaa-bbbb-cccc-dddd-111111111111',status:'ready',
    routeType:'fleet_carrier',source:'Diaba',destination:'Colonia',
    usedCapacity:12000,tankFuel:1000,storedTritium:440,determineTritium:true,
    totalDistance:800,totalTritiumUsed:210,restockStops:0,
    waypoints:[
      {system:'Diaba',distance:0,fuelUsed:0,fuelInTank:1000},
      {system:'Midway',distance:400,fuelUsed:108,fuelInTank:892},
      {system:'Colonia',distance:400,fuelUsed:102,fuelInTank:790},
    ],
  },pending:null});
  await restoration;
  assert.equal(h.node('carrierRouteJobId').value,'aaaaaaaa-bbbb-cccc-dddd-111111111111');
  assert.equal(h.node('carrierRouteSource').value,'Diaba');
  assert.equal(h.node('carrierRouteDestination').value,'Colonia');
  assert.equal(h.node('carrierUsedCapacity').value,'12000');
  assert.equal(h.node('carrierStoredTritium').value,'440');
  assert.match(h.node('carrierRouteSummary').innerHTML,/Colonia/);
  assert.match(h.node('carrierRouteManifest').innerHTML,/Midway/);
  assert.match(h.node('carrierPlotStatus').textContent,/saved carrier route restored/i);
  await h.controller.restoreSavedCarrierPlan();
  assert.equal(h.requests.length,1,'Full manifest is retrieved once, not every state poll');

  // Restored plan is usable immediately to START; Spansh is not called again.
  const start=h.node('carrierJourneyStart').onclick();
  await tick();
  assert.equal(h.requests[1].path,'/api/carrier-journey');
  assert.equal(h.requests[1].body.action,'start');
  assert.equal(h.requests[1].body.route.waypoints[1].system,'Midway');
  h.respond(h.requests[1],null,{ok:true,carrierJourney:{
    id:'aaaaaaaa-bbbb-cccc-dddd-111111111111',status:'active',
    routeType:'fleet_carrier',source:'Diaba',destination:'Colonia',
    completedIndex:0,completedJumps:0,totalJumps:2,remainingJumps:2,
    nextSystem:'Midway',totalDistance:800,totalTritiumUsed:210,estimatedTritiumRemaining:210,
    waypoints:[
      {system:'Diaba',distance:0,fuelUsed:0,fuelInTank:1000},
      {system:'Midway',distance:400,fuelUsed:108,fuelInTank:892},
      {system:'Colonia',distance:400,fuelUsed:102,fuelInTank:790},
    ],cooldown:{status:'unknown'},
  }});
  await start;
  assert.match(h.node('carrierRouteManifest').innerHTML,/is-done/);
}

// A pending ID can also be restored without erasing the last ready plan.
{
  const h=harness(), restore=h.controller.restoreSavedCarrierPlan();
  await tick();
  h.respond(h.requests[0],null,{ok:true,route:null,
    pending:{id:'aaaaaaaa-bbbb-cccc-dddd-222222222222',source:'Diaba',destination:'Colonia'}});
  await restore;
  assert.equal(h.node('carrierRouteJobId').value,'aaaaaaaa-bbbb-cccc-dddd-222222222222');
  assert.match(h.node('carrierPlotStatus').textContent,/CHECK \/ LOAD RESULT/);
  assert.equal(h.requests.length,1,'No background cloud fetch is required to restore pending ID');
}



// Regression: a completed old carrier route must NEVER override a new plot
// from 10-16 to the Bubble. Previously this always showed the old systems
// because renderCarrierRoute prioritized carrierJourney over carrierRoute.
{
  const h=harness(),oldId='11111111-1111-1111-1111-111111111111',
    newId='22222222-2222-2222-2222-222222222222',
    home='NGC 2546 Sector UZ-G d10-16',bubble='Sol';
  h.node('carrierUsedCapacity').value='16000';
  h.node('carrierTankFuel').value='1000';
  h.node('carrierStoredTritium').value='400';
  h.node('carrierRouteSource').value='Diaba';
  h.node('carrierRouteDestination').value='Colonia';
  h.node('carrierRouteJobId').value=oldId;
  const oldJourney={
    id:oldId,routeType:'fleet_carrier',status:'completed',
    source:'Diaba',destination:'Colonia',completedIndex:1,
    totalJumps:1,completedJumps:1,remainingJumps:0,paused:false,
    nextSystem:'',remainingDistance:0,estimatedTritiumRemaining:0,
    totalDistance:500,totalTritiumUsed:119,completedVia:'manual',
    waypoints:[
      {system:'Diaba',distance:0,fuelUsed:0,fuelInTank:1000},
      {system:'Colonia',distance:500,fuelUsed:119,fuelInTank:881},
    ],cooldown:{status:'ready',remainingSeconds:0},
  };
  h.controller.setState({connected:true,carrierJourney:oldJourney});
  h.controller.renderCarrierRoute();
  assert.match(h.node('carrierRouteManifest').innerHTML,/Colonia/);

  h.node('carrierRouteSource').value=home;
  h.node('carrierRouteDestination').value=bubble;
  h.node('carrierRouteSource').oninput();
  h.node('carrierRouteDestination').oninput();
  assert.equal(h.node('carrierRouteSummary').innerHTML,'',
    'Typing new systems immediately hides stale completed route summary');
  assert.doesNotMatch(h.node('carrierRouteManifest').innerHTML,/Colonia/,
    'Old route must not appear as the new route');

  const plotted=h.node('carrierPlot').onclick();
  await tick();
  assert.equal(h.requests[0].path,'/api/route');
  assert.equal(h.requests[0].body.source,home);
  assert.equal(h.requests[0].body.destination,bubble);
  h.respond(h.requests[0],null,{
    ok:true,routeType:'fleet_carrier',id:newId,status:'pending',
    source:home,destination:bubble,
  });
  await plotted;
  assert.equal(h.node('carrierRouteJobId').value,newId);
  assert.equal(h.node('carrierRouteManifest').innerHTML,'',
    'New route submission clears the prior completed manifest');
  assert.match(h.node('carrierRouteManifest').textContent,/CHECK \/ LOAD RESULT/);
  assert.doesNotMatch(h.node('carrierRouteManifest').textContent,/Colonia/);
  assert.match(h.node('carrierPlotStatus').textContent,/NEW route submitted/);

  const checked=h.node('carrierCheck').onclick();
  await tick();
  assert.deepEqual(h.requests[1].body,{action:'check',routeId:newId,source:home,destination:bubble});
  h.respond(h.requests[1],null,{
    ok:true,routeType:'fleet_carrier',id:newId,status:'ready',
    source:home,destination:bubble,totalDistance:300,totalTritiumUsed:77,
    tankFuel:1000,storedTritium:400,restockStops:0,
    waypoints:[
      {system:home,distance:0,fuelUsed:0,fuelInTank:1000},
      {system:'LHS 3447',distance:300,fuelUsed:77,fuelInTank:923},
      {system:bubble,distance:0,fuelUsed:0,fuelInTank:923},
    ],
  });
  await checked;
  assert.match(h.node('carrierRouteSummary').innerHTML,/Sol/);
  assert.match(h.node('carrierRouteManifest').innerHTML,/LHS 3447/);
  assert.doesNotMatch(h.node('carrierRouteManifest').innerHTML,/Colonia/);
  assert.doesNotMatch(h.node('carrierRouteManifest').innerHTML,/is-done/,
    'Completed markings from OLD journey must not bleed into new route');
  assert.equal(h.controller.getState().carrierJourney.id,oldId,
    'Older completed journey remains saved and untouched');
  const button={disabled:false,getAttribute:key=>key==='data-carrier-copy-index'?'1':null};
  const copy=h.node('carrierRouteManifest').onclick({target:{
    closest:selector=>selector==='[data-carrier-copy-index]'?button:null,
  }});
  await tick();
  assert.deepEqual(h.requests[2].body,{action:'copy_to_pc',system:'LHS 3447'},
    'Copy to PC must use the CURRENT, visible route');
  h.respond(h.requests[2],null,{ok:true,system:'LHS 3447'});
  await copy;
}

// A stale Route ID cannot quietly load old waypoints into a new system pair.
{
  const h=harness(),oldId='11111111-1111-1111-1111-111111111111';
  h.node('carrierRouteSource').value='NGC 2546 Sector UZ-G d10-16';
  h.node('carrierRouteDestination').value='Sol';
  h.node('carrierRouteJobId').value=oldId;
  const checking=h.node('carrierCheck').onclick();
  await tick();
  assert.deepEqual(h.requests[0].body,{
    action:'check',routeId:oldId,source:'NGC 2546 Sector UZ-G d10-16',
    destination:'Sol',
  });
  h.respond(h.requests[0],null,{
    ok:true,routeType:'fleet_carrier',status:'ready',id:oldId,
    source:'Diaba',destination:'Colonia',
  });
  await checking;
  assert.equal(h.node('carrierRouteSummary').innerHTML,'');
  assert.match(h.node('carrierPlotStatus').textContent,/belongs to Diaba → Colonia/);
  assert.match(h.node('carrierPlotStatus').textContent,/PLOT CARRIER ROUTE/);
}

// A pending newer route overrides an older saved preview's input fields
// during restoration, but the older preview stays archived.
{
  const h=harness(),restore=h.controller.restoreSavedCarrierPlan();
  await tick();
  h.respond(h.requests[0],null,{ok:true,route:{
    ok:true,id:'11111111-1111-1111-1111-111111111111',status:'ready',
    routeType:'fleet_carrier',source:'Diaba',destination:'Colonia',
    usedCapacity:14000,tankFuel:1000,storedTritium:100,
    totalDistance:500,totalTritiumUsed:119,
    waypoints:[{system:'Diaba',fuelUsed:0,distance:0},
               {system:'Colonia',fuelUsed:119,distance:500}],
  },pending:{id:'22222222-2222-2222-2222-222222222222',
    source:'NGC 2546 Sector UZ-G d10-16',destination:'Sol'}});
  await restore;
  assert.equal(h.node('carrierRouteSource').value,'NGC 2546 Sector UZ-G d10-16');
  assert.equal(h.node('carrierRouteDestination').value,'Sol');
  assert.equal(h.node('carrierRouteJobId').value,'22222222-2222-2222-2222-222222222222');
  assert.equal(h.node('carrierRouteSummary').innerHTML,'');
  assert.doesNotMatch(h.node('carrierRouteManifest').innerHTML,/Colonia/);
}

// A delayed save-restore request must not overwrite inputs entered on iPad.
{
  const h=harness(),restore=h.controller.restoreSavedCarrierPlan();
  await tick();
  h.node('carrierRouteSource').value='NGC 2546 Sector UZ-G d10-16';
  h.node('carrierRouteSource').oninput();
  h.respond(h.requests[0],null,{ok:true,route:{
    ok:true,id:'11111111-1111-1111-1111-111111111111',
    routeType:'fleet_carrier',status:'ready',
    source:'Diaba',destination:'Colonia',waypoints:[],
  }});
  await restore;
  assert.equal(h.node('carrierRouteSource').value,'NGC 2546 Sector UZ-G d10-16');
  assert.equal(h.node('carrierRouteJobId').value,'');
}

// Expedition pre-start recovery: show escaped labels and send only selected
// body IDs with the current system address, never a user-entered credit value.
{
  const h=harness();
  const scan={system:{address:'987'},expedition:{
    active:true,existingDataExcluded:false,estimate:0,countedScans:0,countedMaps:0,
    prestartCandidates:[{bodyId:'7',name:'<Test World>',estimatedValue:3000000,
                         observedAt:'2026-11-07T18:00:00Z'}]
  }};
  h.controller.setState({scout:{exploration:scan}});
  h.controller.renderSurveyorControls();
  assert.match(h.node('surveyorPrestartRows').innerHTML,/&lt;Test World&gt;/);
  assert.doesNotMatch(h.node('surveyorPrestartRows').innerHTML,/<Test World>/);
  h.node('surveyorPrestartRows').querySelectorAll=()=>[{value:'7'}];
  h.node('surveyorIncludePrevious').onclick();
  await tick();
  assert.equal(h.requests[0].path,'/api/surveyor');
  assert.deepEqual(h.requests[0].body,{action:'include_previous',
    value:{systemAddress:'987',bodyIds:['7']}});
  h.respond(h.requests[0],null,{ok:true,exploration:{
    ...scan,expedition:{...scan.expedition,estimate:3000000,
      countedScans:1,prestartCandidates:[]}
  }});
  await tick();
  assert.match(h.node('surveyorExpeditionNotice').textContent,/previous scans added/i);
  assert.equal(h.controller.getState().scout.exploration.expedition.estimate,3000000);
}

console.log('✓ Shipped HUD controller serializes controls, preserves assignments, recovers after errors and displays HTTP/cache/renderer diagnostics');

// The automatic Raven poll never inserts a refresh notification or changes the project list.
{
  const h=harness();
  const cart={enabled:true,reportingEnabled:true,updatedAt:"2026-11-27T05:00:00Z",projects:[{id:"a",name:"Build A"}],remaining:50};
  const update=extra=>{h.controller.setState({connected:true,scout:{colonization:{...cart,...extra}}});h.controller.renderRavenCart()};
  update({refreshing:false});
  const rows=h.node("ravenProjects").innerHTML;
  const status=h.node("ravenStatus").textContent;
  update({refreshing:true});
  assert.equal(h.node("ravenNotice").textContent,"");
  assert.equal(h.node("ravenStatus").textContent,status);
  assert.equal(h.node("ravenProjects").innerHTML,rows);
  assert.equal(h.node("ravenRefresh").disabled,false);
  update({updatedAt:"2026-11-27T05:01:00Z",refreshing:false});
  assert.equal(h.node("ravenNotice").textContent,"");
  h.controller.setRavenManualRefresh({before:cart.updatedAt,started:Date.now(),requested:true});
  update({refreshing:true});
  assert.equal(h.node("ravenRefresh").disabled,true);
  update({updatedAt:"2026-11-27T05:01:00Z",refreshing:false});
  assert.equal(h.node("ravenNotice").textContent,"Raven refreshed");
  h.controller.expireRavenNotice();
  update({updatedAt:"2026-11-27T05:01:00Z",refreshing:false});
  assert.equal(h.node("ravenNotice").textContent,"");
  update({error:"Network failed",stale:true});
  assert.match(h.node("ravenStatus").textContent,/Network failed/);
  assert.equal(h.node("ravenNotice").textContent,"");
  assert.ok(html.indexOf('id="ravenSummary"')<html.indexOf('id="ravenNotice"'));
}
console.log("✓ Quiet background Raven refresh, manual-only feedback and stable list");

{
  const h=harness();
  const project={id:"typed",name:"Hayden Vision",buildType:"eupraxia",system:"Diaba"};
  for(const source of ["raven","manual"]){
    h.controller.setState({connected:true,scout:{colonization:{enabled:true,source,projects:[project],availableProjects:[project]}}});
    h.controller.renderRavenCart();
    assert.match(h.node("ravenProjects").innerHTML,/Hayden Vision \(eupraxia\)/);
  }
  assert.ok(html.includes("COLONIZATION LOGISTICS"));
}

{
  const h=harness();
  h.controller.setState({connected:true,scout:{ship:{type:"Panther Clipper Mk II"},colonization:{enabled:true,projects:[{system:"Diaba"}],rows:[{key:"steel",name:"Steel",need:10}]}}});
  h.controller.renderSourcingControls();
  assert.equal(h.node("sourcingSystem").value,"Diaba");
  assert.match(h.node("sourcingCommodity").innerHTML,/Steel/);
  assert.equal(h.node("sourcingPad").value,"3");
  assert.equal(h.node("sourcingSearch").disabled,false);
  assert.equal(h.requests.length,0);
}

{
  const h=harness();
  h.controller.setState({connected:true,scout:{system:{name:"Sol"},colonization:{enabled:true,projects:[{system:"Diaba"}],availableProjects:[{system:"Achenar"},{system:"Diaba"}],rows:[{key:"steel",name:"Steel",need:10}]}}});
  h.controller.renderSourcingControls();
  assert.match(h.node("sourcingSystem").innerHTML,/Achenar/);
  assert.equal(h.node("sourcingSystem").value,"Diaba");
  h.node("sourcingReference").value="custom";
  h.node("sourcingCustomSystem").value="Shinrarta Dezhra";
  h.controller.renderSourcingControls();
  assert.equal(h.node("sourcingSearch").disabled,false);
  assert.equal(h.node("sourcingCustomRow").style.display,"");
  assert.equal(h.node("sourcingSystemRow").style.display,"none");
  assert.match(html,/id="sourcingPaste"/);
  assert.match(html,/<option value="0">Any<\/option>/);
}

{
  const h=harness();
  const material={key:"steel",name:"Steel",need:20,stock:20,price:100};
  const common={station:"Common",system:"Diaba",distance:1.234,arrival:123.1,pad:3,materials:[material],matched:1,covered:20,averagePrice:100,updatedAt:new Date().toISOString()};
  const rare={...common,station:"Rare",distance:2.1,arrival:null,planOrder:1,planOptimal:true,planCollect:{steel:20}};
  h.controller.setSourcingResult({status:"complete",request:{system:"Diaba",radius:50,needs:{steel:{name:"Steel",quantity:20}}},results:[common,rare]});
  h.controller.renderSourcingResults();
  const output=h.node("sourcingResults").innerHTML;
  assert.match(output,/Recommended collection · 1 stop/);
  assert.match(output,/All required quantities covered/);
  assert.match(output,/2\.10 LY · — Ls/);
  assert.match(output,/1\.24 LY · 124 Ls/);
  assert.ok(output.indexOf("Stop 1 · Rare")<output.indexOf("Alternative stations"));
  assert.ok(output.indexOf("Alternative stations")<output.indexOf("Common"));
}

{
  const h=harness();
  const ids=["SetSpeedZero","SetSpeed25","SetSpeed50","SetSpeed75","SetSpeed100","UI_Up","UI_Down","UI_Left","UI_Right","UI_Select","UI_Back","UseBoostJuice"];
  const actions=ids.map(id=>({id,label:id,binding:"K",profile:"Navigation",group:"Test",origin:"imported"}));
  h.controller.setDeck(actions);
  const display=h.node("deckControls").innerHTML;
  assert.match(display,/deck-nav-layout/);
  assert.match(display,/deck-dpad/);
  assert.ok(display.indexOf('data-deck-send="SetSpeed100"')<display.indexOf('data-deck-send="SetSpeedZero"'));
  for(const id of ids)assert.equal(display.split('data-deck-send="'+id+'"').length,2);
  assert.equal(h.controller.deckEnqueue("UI_Up",false),true);
  assert.equal(h.controller.deckEnqueue("UI_Down",false),true);
  assert.equal(h.controller.deckEnqueue("UI_Left",false),true);
  assert.equal(h.controller.deckEnqueue("UI_Up",true),false,"repeat never queues");
  await drain(h,ids.slice(5,8).map(id=>({path:"/api/ship-deck",body:{action:"send",id,binding:"K"}})));
  assert.equal(h.requests.length,3);
}
{
  const h=harness();
  h.controller.setDeck([{id:"UI_Up",label:"Up",binding:"UP",profile:"Navigation",group:"UI",origin:"imported"}]);
  const button={disabled:false,getAttribute:()=>"UI_Up",classList:{add(){},remove(){}}};
  assert.equal(h.controller.deckStartHold(button,1),true);
  await tick();
  assert.equal(h.requests.length,1);
  h.respond(h.requests[0]);
  await tick();
  await new Promise(resolve=>setTimeout(resolve,390));
  assert.equal(h.requests.length,2,"hold repeats once after threshold");
  h.controller.deckStopHold(1);
  h.respond(h.requests[1]);
  await new Promise(resolve=>setTimeout(resolve,180));
  assert.equal(h.requests.length,2,"release stops further commands");
}
{
  const h=harness();
  h.controller.setDeck([{id:"UI_Up",label:"Up",binding:"UP",profile:"Navigation",group:"UI",origin:"imported"}]);
  h.controller.deckEnqueue("UI_Up",false);
  h.controller.deckEnqueue("UI_Up",false);
  h.controller.deckCancelInputs();
  h.respond(h.requests[0]);
  await tick();
  assert.equal(h.requests.length,1,"pending input discarded on context change");
}
console.log("✓ Ship deck cross layout, ordered rapid taps, no repeat backlog and release cancellation");

{
  const h=harness();
  h.controller.setState({connected:true,scout:{system:{name:"Test",address:"123"},status:{systemAddress:"123",destination:{name:"Port",systemAddress:"123"}}}});
  h.controller.setDataReport({address:"123",status:"available",fetchedAt:Date.now()/1000,data:{stations:[{name:"Port",type:"Orbis",economies:[{name:"Industrial",percent:65}],services:["Repair"]}],factions:[],bodies:[]}});
  h.node("dataStations").onclick();
  assert.match(h.node("dataDirectory").innerHTML,/Port/);
  assert.match(h.node("dataTarget").innerHTML,/65%/);
  assert.match(h.node("dataTarget").innerHTML,/Repair/);
  h.controller.openDataDetail("stations",0);
  assert.match(h.node("dataDetail").innerHTML,/Orbis station schematic/);
  assert.notEqual(h.controller.dataArtwork("Orbis"),h.controller.dataArtwork("Coriolis"));
  h.controller.setState({connected:true,scout:{system:{name:"Other",address:"456"},status:{systemAddress:"456",destination:{name:"Port",systemAddress:"123"}}}});
  h.controller.renderDataDisplay();
  assert.doesNotMatch(h.node("dataTarget").innerHTML,/65%/);
  assert.equal(h.node("dataOverlay").classList.contains("hidden"),true);
}
console.log("✓ Data display station detail, type artwork and system scope");

{
  const h=harness();
  const body={name:"Test 3",type:"High metal content world",distance:123.43,gravity:2.02,temperature:612.99,landable:true,rings:[{name:"Test 3 A Ring",type:"Metallic"}],signals:{"$PlanetaryMiningLocation_Name;":17,"$SAA_SignalType_Geological;":3,"$SAA_SignalType_Human;":5}};
  const out=h.controller.dataBody(body);
  assert.match(out,/Mining locations/);assert.match(out,/Geological/);assert.match(out,/Human/);
  assert.doesNotMatch(out,/\$SAA_|\$Planetary/);
  assert.match(out,/A Ring/);assert.doesNotMatch(out,/Test 3 A Ring/);
  assert.match(h.controller.dataArtwork("Planet",true,true),/<ellipse/);
  assert.doesNotMatch(h.controller.dataArtwork("Planet",true,false),/<ellipse/);
  h.controller.setDataFocus("Target");
  assert.equal(h.node("dataGrid").classList.contains("data-expanded"),true);
  assert.equal(h.node("dataPanelTarget").classList.contains("data-focused"),true);
  h.controller.setDataFocus("Target");
  assert.equal(h.node("dataGrid").classList.contains("data-expanded"),false);
}
assert.match(html,/grid-template-rows:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(html,/height:100dvh/);
console.log("✓ Fixed data viewport, expand controls, compact planet labels and signal localization");

{
  const h=harness();
  assert.match(html,/\.data-expand\{width:72px;min-width:72px;height:48px;min-height:48px/);
  assert.notEqual(h.controller.dataArtwork("Orbis"),h.controller.dataArtwork("Ocellus"));
  assert.notEqual(h.controller.dataArtwork("Coriolis"),h.controller.dataArtwork("Dodecahedral"));
  const station=h.controller.dataStation({name:"Port",type:"Orbis",distance:12,pads:{large:4},economies:[{name:"Extraction",percent:65}],services:["Repair","Shipyard","Mission Board","Vista Genomics"]},true);
  assert.match(station,/Flight support/);assert.match(station,/Markets & equipment/);
  assert.match(station,/Command & contacts/);assert.match(station,/Exploration & other/);
  assert.match(station,/65%/);assert.match(station,/Large pads/);
  assert.match(h.controller.dataFaction({name:"Control",influence:45,states:["Boom","Civil War","Famine"]},"Control"),/data-controlling/);
  assert.match(h.controller.dataFaction({name:"Control",states:["Boom"]},"Control"),/data-state-good/);
  const manifest=h.controller.dataOperations("cargo",{cargo:{used:25,capacity:100,free:75,items:[{name:"Steel",count:25}],missionNeeds:[{name:"Water",stillNeeded:8}]}},{},{},{},{});
  assert.match(manifest,/Steel/);assert.match(manifest,/8 t needed/);
  h.controller.setState({connected:true,scout:{system:{name:"Test",address:"123"}}});
  h.controller.setDataReport({address:"123",status:"available",fetchedAt:Date.now()/1000,data:{stations:[{name:"Alpha",type:"Orbis"},{name:"Beta",type:"Coriolis"}],factions:[],bodies:[]}});
  h.node("dataStations").onclick();
  h.node("dataSearch").value="Beta";h.node("dataSearch").oninput();
  assert.doesNotMatch(h.node("dataDirectory").innerHTML,/Alpha/);
  assert.match(h.node("dataDirectory").innerHTML,/data-object-index="1"/);
  h.controller.openDataDetail("stations",1);assert.match(h.node("dataDetail").innerHTML,/Beta/);
  h.node("dataSearchClear").onclick();assert.match(h.node("dataDirectory").innerHTML,/Alpha/);
}
console.log("✓ Enlarged data controls, station illustrations, categorized services, faction states and filtered directory identity");

{
  const storage=new Map(),h=harness(storage),c=h.controller;
  assert.equal(h.node("dataGrid").classList.contains("data-layout-four"),true);
  h.node("dataHideContact").onclick();
  assert.equal(h.node("dataPanelContact").classList.contains("data-panel-hidden"),true);
  assert.equal(h.node("dataGrid").classList.contains("data-layout-three"),true);
  c.setDataPrimary("Target");
  assert.equal(h.node("dataPanelTarget").style.gridColumn,"1");
  assert.equal(h.node("dataPanelTarget").style.gridRow,"1 / span 2");
  assert.equal(h.node("dataPanelSystem").style.gridColumn,"2");
  assert.equal(h.node("dataPanelOps").style.gridRow,"2");
  c.setDataFocus("Ops");
  assert.equal(h.node("dataGrid").classList.contains("data-expanded"),true);
  assert.equal(h.node("dataPanelOps").style.gridColumn,"1");
  c.setDataFocus("Ops");
  assert.equal(h.node("dataPanelTarget").style.gridRow,"1 / span 2");
  assert.equal(h.node("dataPanelContact").classList.contains("data-panel-hidden"),true);
  const restored=harness(storage);
  assert.equal(restored.node("dataPanelTarget").style.gridRow,"1 / span 2");
  assert.equal(restored.node("dataPanelContact").classList.contains("data-panel-hidden"),true);
  c.openDataLayout();
  h.node("dataVisibleContact").checked=true;h.node("dataVisibleContact").onchange();
  assert.equal(h.node("dataGrid").classList.contains("data-layout-four"),true);
  c.setDataVisible("System",false);c.setDataVisible("Contact",false);
  assert.equal(h.node("dataGrid").classList.contains("data-layout-two"),true);
  assert.equal(h.node("dataPanelTarget").style.gridColumn,"1");
  c.setDataVisible("Ops",false);
  assert.equal(h.node("dataGrid").classList.contains("data-layout-one"),true);
  assert.equal(c.setDataVisible("Target",false),false);
  assert.equal(h.node("dataVisibleTarget").disabled,true);
  c.resetDataLayout();
  assert.equal(h.node("dataGrid").classList.contains("data-layout-four"),true);
}
{
  const h=harness(),c=h.controller;
  c.setState({connected:true,scout:{system:{name:"Test",address:"123"},status:{systemAddress:"123",destination:{name:"Beta",systemAddress:"123"}}}});
  c.setDataReport({address:"123",status:"available",fetchedAt:Date.now()/1000,data:{stations:[{name:"Alpha",type:"Orbis"},{name:"Beta",type:"Coriolis"}],factions:[],bodies:[]}});
  c.setDataVisible("Target",false);
  c.openDataDetail("stations",0);c.pinDataTarget();
  assert.match(h.node("dataTarget").innerHTML,/PINNED/);
  assert.match(h.node("dataTarget").innerHTML,/Alpha/);
  assert.equal(h.node("dataPanelTarget").classList.contains("data-panel-hidden"),false);
  c.clearDataPin();
  assert.match(h.node("dataTarget").innerHTML,/Beta/);
  c.openDataDetail("stations",0);c.pinDataTarget();
  c.setState({connected:true,scout:{system:{name:"Other",address:"456"},status:{systemAddress:"456"}}});
  c.renderDataDisplay();
  assert.doesNotMatch(h.node("dataTarget").innerHTML,/PINNED|Alpha/);
}
console.log("✓ Data Display persistent layouts, primary selection, focus restore, last-panel guard and scoped target pin");
