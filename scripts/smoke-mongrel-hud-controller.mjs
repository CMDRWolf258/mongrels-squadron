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
      dataset: {}, getAttribute(name) { return attrs[name]; }, addEventListener() {},
    };
    nodes.set(id, value);
    return value;
  }
  const profileButtons = ['combat', 'ax', 'surface'].map(profile => node(profile + 'Button', { 'data-profile': profile }));
  const visibilityButtons = ['own', 'axstatus', 'surface', 'mission'].map(panel => node(panel + 'Visible', { 'data-panel-visible': panel }));
  const scaleSelects = ['own', 'axstatus', 'surface', 'mission'].map(panel => node(panel + 'Scale', { 'data-panel-scale': panel }));
  const profileSelects = ['own', 'axstatus', 'surface', 'mission'].map(panel => node(panel + 'Profiles', { 'data-panel-profile': panel }));
  const axActionButtons = ['heart_exerted','heart_down','shield_up','shield_down','reset'].map(action => node('axAction' + action, { 'data-ax-action': action }));
  const axAlertButtons = ['emp','caustic_missile','clear'].map(code => node('axAlert' + code, { 'data-ax-alert': code }));
  const requests = [];
  const backend = {
    profile: 'combat',
    layout: {
      locked: true, masterVisible: true,
      panels: {
        own: { visible: true, scale: 1, profiles: ['combat', 'ax'] },
        axstatus: { visible: true, scale: 1, profiles: ['ax'] },
        surface: { visible: true, scale: 1, profiles: ['surface'] },
        mission: { visible: true, scale: 0.9, profiles: ['combat', 'ax', 'surface'] },
      },
    },
  };
  const context = {
    document: {
      getElementById: node,
      querySelectorAll(selector) {
        return ({ '[data-profile]': profileButtons, '[data-panel-visible]': visibilityButtons, '[data-panel-scale]': scaleSelects, '[data-panel-profile]': profileSelects, '[data-ax-action]': axActionButtons, '[data-ax-alert]': axAlertButtons })[selector] || [];
      }, addEventListener() {}, activeElement: null,
    },
    fetch(path, options) {
      return new Promise(resolve => requests.push({ path, body: options.body === undefined ? null : JSON.parse(options.body), resolve }));
    },
  };
  vm.createContext(context);
  const expose = 'globalThis.testController={setState(v){state=v},getState(){return state},load,render,api,diagnosticText,disableRender(){render=function(){}}};';
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
    h.node('axButton').onclick(),
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
    { path: '/api/profile', body: { profile: 'ax' } },
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
  assert.deepEqual(h.backend.layout.panels, assignments, 'Combat/AX/Surface assignments survive overlapping controls');
}

{
  const h = harness();
  const actions = [];
  const expected = [];
  for (let cycle = 0; cycle < 12; cycle++) {
    for (const profile of ['surface', 'ax', 'combat']) {
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
  for (const [profiles, value] of [
    [['surface'], 'surface'],
    [['combat', 'surface'], 'both'],
    [['combat', 'ax'], 'combat_ax'],
    [['combat', 'ax', 'surface'], 'all'],
    [['ax'], 'ax'],
    [['combat'], 'combat'],
  ]) {
    select.value = value;
    actions.push(select.onchange());
    expected.push({ path: '/api/panel', body: { panel: 'own', profiles } });
    actions.push(h.node('surfaceButton').onclick());
    expected.push({ path: '/api/profile', body: { profile: 'surface' } });
  }
  await drain(h, expected);
  await Promise.all(actions);
  assert.deepEqual(h.backend.layout.panels.own.profiles, ['combat']);
  assert.deepEqual(h.backend.layout.panels.surface.profiles, ['surface']);
  assert.deepEqual(h.backend.layout.panels.mission.profiles, ['combat', 'ax', 'surface']);
}

{
  const h = harness();
  const action = h.node('axActionheart_down').onclick();
  await tick();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].path, '/api/ax-action');
  assert.deepEqual(h.requests[0].body, { action: 'heart_down' });
  h.respond(h.requests[0], null, { ok:true, ax:{ phase:{ phase:'shield', heartsRemaining:4, heartsTotal:5 } } });
  await action;

  h.node('axVariantOverride').value='basilisk';
  h.node('axShipBoost').value='512';
  h.node('axColdHeat').value='20';
  h.node('axOrbitMin').value='900';
  h.node('axOrbitMax').value='1500';
  const save = h.node('saveAxSettings').onclick();
  await tick();
  assert.equal(h.requests.length, 2);
  assert.equal(h.requests[1].path, '/api/ax-settings');
  assert.deepEqual(h.requests[1].body, { variantOverride:'basilisk', shipBoostMps:512, coldHeatPercent:20, orbitMinM:900, orbitMaxM:1500 });
  h.respond(h.requests[1], null, { ok:true, ax:{ settings:{ variantOverride:'basilisk' } } });
  await save;

  const emp = h.node('axAlertemp').onclick();
  await tick();
  assert.equal(h.requests.length, 3);
  assert.equal(h.requests[2].path, '/api/ax-alert');
  assert.deepEqual(h.requests[2].body, { code:'emp', ttlSeconds:8, source:'test' });
  h.respond(h.requests[2], null, { ok:true, ax:{ statusBar:{ code:'emp', severity:'critical', flash:true } } });
  await emp;

  const caustic = h.node('axAlertcaustic_missile').onclick();
  await tick();
  assert.equal(h.requests[3].path, '/api/ax-alert');
  assert.deepEqual(h.requests[3].body, { code:'caustic_missile', ttlSeconds:8, source:'test' });
  h.respond(h.requests[3], null, { ok:true, ax:{ statusBar:{ code:'caustic_missile', severity:'critical', flash:true } } });
  await caustic;

  h.node('axstatusScale').value='2';
  const resize=h.node('axstatusScale').onchange();
  await tick();
  assert.equal(h.requests[4].path,'/api/panel');
  assert.deepEqual(h.requests[4].body,{panel:'axstatus',scale:2});
  h.respond(h.requests[4]);
  await resize;
  assert.equal(h.backend.layout.panels.axstatus.scale,2);
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

assert.match(html,/AX STATUS BAR/);
assert.match(html,/TEST CAUSTIC/);
assert.match(html,/Panel Scale changes both text size and window footprint/);
console.log('✓ Shipped HUD controller serializes Combat/AX/Surface controls, AX status tests, responsive scaling, preserves assignments, recovers after errors and displays diagnostics');
