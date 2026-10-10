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

function harness() {
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
        return ({ '[data-profile]': profileButtons, '[data-panel-visible]': visibilityButtons, '[data-panel-profile]': profileSelects })[selector] || [];
      }, addEventListener() {}, activeElement: null,
    },
    fetch(path, options) {
      return new Promise(resolve => requests.push({ path, body: options.body === undefined ? null : JSON.parse(options.body), resolve }));
    },
  };
  vm.createContext(context);
  const expose = 'globalThis.testController={setState(v){state=v},getState(){return state},load,render,api,diagnosticText,renderFlightManifest,renderScoutNetwork,disableRender(){render=function(){}}};';
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
console.log('✓ Shipped HUD controller serializes controls, preserves assignments, recovers after errors and displays HTTP/cache/renderer diagnostics');
