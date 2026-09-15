(() => {
  const select = document.querySelector('#merc-goal-select');
  const output = document.querySelector('#merc-goal-output');
  const tableBody = document.querySelector('#merc-module-rows');
  if (!select || !output || !tableBody) return;

  const esc = (s='') => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const mc = value => Number(String(value || '').replace(/[^0-9.]/g,'')) || 0;
  const range = (total, highYield, lowYield) => `${Math.ceil(total/highYield)}–${Math.ceil(total/lowYield)}`;

  function buildTargets(entry) {
    const tables = Array.isArray(entry?.tables) ? entry.tables : [];
    const out = [];
    const hardpoints = tables.find(t => t.title === 'MERC Hardpoints');
    const optionals = tables.find(t => t.title === 'MERC Optional Internals');
    for (const table of [hardpoints, optionals]) {
      for (const row of table?.rows || []) {
        out.push({ name: row[0], purchase: mc(row[1]), grade5: mc(row[2]), path: '' });
      }
    }

    const pd = tables.find(t => t.title === 'MERC Power Distributors — Purchase Cost');
    const pdPaths = tables.find(t => t.title === 'Power Distributor — Cost to Grade 5');
    for (const row of pd?.rows || []) {
      for (const path of pdPaths?.rows || []) {
        out.push({ name: row[0], purchase: mc(row[1]), grade5: mc(path[1]), path: path[0] });
      }
    }

    const standard = tables.find(t => t.title === 'MERC Engineering Blueprints for Standard Modules');
    for (const row of standard?.rows || []) {
      out.push({ name: `${row[0]} — ${row[1]}`, purchase: 0, grade5: mc(row[2]), path: 'Blueprint only' });
    }
    return out;
  }

  function renderTarget(target) {
    const total = target.purchase + target.grade5;
    const weekly = Math.ceil(total / 1000);
    output.innerHTML = `
      <div class="status-strip" style="margin-top:14px">
        <div class="status-item"><span>Purchase</span><strong class="accent">${target.purchase ? `${target.purchase} MC` : 'No MERC module purchase'}</strong></div>
        <div class="status-item"><span>G5 upgrade</span><strong>${target.grade5} MC</strong></div>
        <div class="status-item"><span>Total savings target</span><strong class="accent">${total} MC</strong></div>
        <div class="status-item"><span>1,000-MC bonus bands</span><strong>${weekly}</strong></div>
      </div>
      <div class="guide-rule" style="margin-top:14px"><strong>Planning estimate:</strong> at roughly 100–150 MC per successful Hard run, budget about <strong>${range(total,150,100)} Hard completions</strong>. At roughly 30–50 MC per Easy run, budget about <strong>${range(total,50,30)} Easy completions</strong>. These are community-observed planning ranges, not guaranteed payouts; Operation type, weekly bonus state, balancing changes, and post-allowance reductions can change the result.</div>`;
  }

  fetch('../../data/elite-knowledge-merc-modules.json', { cache: 'no-store' })
    .then(r => { if (!r.ok) throw new Error('MERC data unavailable'); return r.json(); })
    .then(data => {
      const entry = (data.entries || []).find(e => e.id === 'operations-merc-modules-costs');
      if (!entry) throw new Error('MERC entry unavailable');
      const targets = buildTargets(entry);
      targets.forEach((target, index) => {
        const total = target.purchase + target.grade5;
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = `${target.name}${target.path && target.path !== 'Blueprint only' ? ` — ${target.path}` : ''} (${total} MC total)`;
        select.appendChild(option);
      });
      tableBody.innerHTML = targets.map(target => {
        const total = target.purchase + target.grade5;
        const path = target.path && target.path !== 'Blueprint only' ? target.path : '—';
        return `<tr><td>${esc(target.name)}</td><td>${esc(path)}</td><td>${target.purchase ? `${target.purchase} MC` : '—'}</td><td>${target.grade5} MC</td><td>${total} MC</td><td>${range(total,150,100)}</td></tr>`;
      }).join('');
      select.addEventListener('change', () => renderTarget(targets[Number(select.value)] || targets[0]));
      if (targets.length) renderTarget(targets[0]);
    })
    .catch(() => {
      output.innerHTML = '<p class="empty-state">MERC planning data could not be loaded. Use the Reference Database for the current squad-maintained values.</p>';
      tableBody.innerHTML = '<tr><td colspan="6">MERC planning data unavailable.</td></tr>';
    });
})();
