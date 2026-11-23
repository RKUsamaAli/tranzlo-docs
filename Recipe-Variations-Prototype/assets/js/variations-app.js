/* ==========================================================================
   variations-app.js — recipe variation groups, RULE TABLES per line, and the
   three order modes, as a working simulation (window.VAR = state; devtools).

     Recipe      open groups (Colour, Size, Fit, Sleeve…); each line depends on
                 ANY number of groups and carries rules: "for these values →
                 this material and/or this qty" — an unnamed group = Any.
     Order       Single product (today) · One variation · Grid
                 (rows × columns + any number of SPLIT-BY groups = blocks)
     Complete    good pieces per output line; WIP shared by standard material

   The ONE rule the real module implements is resolve(line, chosen):
     for material and for qty separately:
       candidates = rules that set the field and whose every named group equals the choice
       winner     = most named groups (most specific); tie → the upper row
       none       = the line's default
     material empty → line not used
     need = orderQty ÷ recipe.outputQty × qty × (1 + wastage%)
   ========================================================================== */
(function () {
  const { $, el } = UI;
  const V = CFG.var;
  const clone = o => JSON.parse(JSON.stringify(o));

  const R = clone(V.recipe);
  const st = {
    mode: V.settings.defaultMode,
    single: clone(V.demo.single),
    variation: clone(V.demo.variation),
    grid: clone(V.demo.grid),
    gridView: 'blocks',           // 'blocks' | 'list'
    outputTo: 'own',              // 'own' = each variation its own product · 'base' = recipe product + description
    products: clone(V.products),
    perCell: false,
    saved: false,
    done: {},                     // cell key → good pieces at Complete
    tableView: {},                // line id → { axes: [rows, cols], forv: { otherGroup: value|'' } } while its qty table is open
  };
  window.VAR = { recipe: R, state: st };

  /* ---------- lookups ------------------------------------------------------ */
  const mat = id => V.materials.find(m => m.id === id);
  const matName = id => (mat(id) || {}).name || '—';
  const grp = id => R.groups.find(g => g.id === id);
  const gname = id => (grp(id) || {}).name || id;
  const num = (n, d) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: d == null ? 2 : d });
  const money = n => UI.money(n);
  const has = v => v !== undefined && v !== null && v !== '';
  let seq = 0; const uid = p => p + (++seq) + Date.now().toString(36).slice(-3);

  function toast(msg, bad) {
    let t = $('#toast');
    if (!t) { t = el('div', { id: 'toast', class: 'toast' }); document.body.appendChild(t); }
    t.textContent = msg; t.classList.toggle('bad', !!bad); t.classList.add('on');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2800);
  }

  /* ---------- THE rule ----------------------------------------------------- */
  const named = r => Object.keys(r.when).filter(k => has(r.when[k]));
  const ruleText = r => named(r).length ? named(r).map(k => r.when[k]).join(' · ') : 'Any';
  const matches = (r, chosen) => named(r).every(k => chosen[k] === r.when[k]);

  function pick(line, field, chosen) {
    let best = null, bestN = -1;
    line.rules.forEach(r => {
      if (!has(r[field]) || !matches(r, chosen)) return;
      const n = named(r).length;
      if (n > bestN) { best = r; bestN = n; }          // strictly greater → the upper row wins a tie
    });
    return best;
  }

  function resolve(line, chosen) {
    const rm = pick(line, 'material', chosen), rq = pick(line, 'qty', chosen);
    const m = rm ? rm.material : line.material;
    if (!m) return null;
    const q = rq ? Number(rq.qty) : Number(line.qty);
    const why = [];
    why.push(rm ? '[' + ruleText(rm) + '] → ' + matName(m) : 'default material');
    why.push(rq ? '[' + ruleText(rq) + '] → ' + q : 'default ' + q);
    return { mat: m, qty: q, wastage: Number(line.wastage || 0), why: line.dependsOn.length ? why.join(' · ') : 'fixed' };
  }

  const valuesText = chosen => R.groups.filter(g => chosen[g.id]).map(g => chosen[g.id]).join(' / ');
  const variantName = chosen => { const t = valuesText(chosen); return t ? R.product + ' - ' + t : R.product; };

  /* ---------- the order's output lines (cells) ----------------------------- */
  function cells() {
    if (st.mode === 'single') return [{ key: 'single', chosen: {}, qty: Number(st.single.qty) || 0 }];
    if (st.mode === 'variation') return [{ key: 'variation', chosen: { ...st.variation.pick }, qty: Number(st.variation.qty) || 0 }];
    const g = st.grid, out = [];
    if (!grp(g.rows) || !grp(g.cols) || g.rows === g.cols) return out;
    g.blocks.forEach(b => grp(g.rows).values.forEach(rv => grp(g.cols).values.forEach(cv => {
      const q = Number(b.cells[rv + '|' + cv]) || 0;
      if (q > 0) out.push({ key: b.id + '|' + rv + '|' + cv, block: b, chosen: { ...g.fixed, ...b.values, [g.rows]: rv, [g.cols]: cv }, qty: q });
    })));
    return out;
  }
  function outputOf(c) {
    if (st.mode === 'single' || st.outputTo === 'base') return { product: R.product, desc: valuesText(c.chosen), exists: true };
    const name = variantName(c.chosen);
    return { product: name, desc: valuesText(c.chosen), exists: st.products.includes(name) };
  }
  function explode(list) {
    const agg = {}, per = [];
    list.forEach(c => {
      const factor = c.qty / R.outputQty, label = valuesText(c.chosen) || R.product;
      R.lines.forEach(line => {
        const r = resolve(line, c.chosen);
        if (!r) { per.push({ cell: label, line: line.label, skipped: true }); return; }
        const need = factor * r.qty * (1 + r.wastage / 100);
        per.push({ cell: label, line: line.label, mat: r.mat, qty: need, why: r.why });
        const a = agg[r.mat] || (agg[r.mat] = { mat: r.mat, qty: 0, why: new Set(), lines: new Set() });
        a.qty += need; a.why.add(r.why); a.lines.add(line.label);
      });
    });
    return { agg: Object.values(agg), per };
  }
  const stdPerPiece = chosen => R.lines.reduce((s, line) => {
    const r = resolve(line, chosen); if (!r) return s;
    return s + r.qty * (1 + r.wastage / 100) * mat(r.mat).rate / R.outputQty;
  }, 0);

  function issues() {
    const out = [];
    if (st.mode === 'variation') {
      R.groups.filter(g => g.required && !st.variation.pick[g.id]).forEach(g => out.push('Pick a ' + g.name + ' — this recipe needs it.'));
      if (!(Number(st.variation.qty) > 0)) out.push('Enter the quantity to produce.');
    }
    if (st.mode === 'grid') {
      const g = st.grid;
      if (g.rows === g.cols) out.push('Rows and columns must be two different groups.');
      R.groups.filter(x => x.required && x.id !== g.rows && x.id !== g.cols && !g.split.includes(x.id) && !g.fixed[x.id])
        .forEach(x => out.push('Pick a ' + x.name + ' for the whole order — this recipe needs it.'));
      g.blocks.forEach((b, i) => g.split.filter(id => grp(id).required && !b.values[id])
        .forEach(id => out.push('Block ' + (i + 1) + ': pick a ' + gname(id) + '.')));
      const n = cells().length;
      if (!n) out.push('Type at least one quantity in the grid.');
      if (n > V.settings.maxOutputLines) out.push(n + ' output lines — the company limit is ' + V.settings.maxOutputLines + '. Split it into two orders.');
    }
    if (st.mode === 'single' && !(Number(st.single.qty) > 0)) out.push('Enter the quantity to produce.');
    if (st.mode !== 'single' && st.outputTo === 'own') {
      const missing = cells().map(outputOf).filter(o => !o.exists).length;
      if (missing) out.push(missing + ' output product(s) do not exist yet — press Create (or Create all).');
    }
    return out;
  }

  /* ======================================================================
     TAB 1 — RECIPE
     ====================================================================== */
  function renderRecipe() { renderGroups(); renderLines(); renderPreview(); }

  function usedBy(gid) { return R.lines.filter(l => l.dependsOn.includes(gid)).map(l => l.label); }

  function renderGroups() {
    const host = $('#groups'); host.innerHTML = '';
    const tb = el('tbody');
    R.groups.forEach((g, gi) => {
      const chips = el('div', { class: 'vchips' });
      g.values.forEach((v, vi) => chips.appendChild(el('span', { class: 'vchip' }, [v,
        el('button', { type: 'button', class: 'x', title: 'Remove ' + v, onclick: () => { g.values.splice(vi, 1); afterRecipeEdit(); } }, ['×'])])));
      const add = el('input', { class: 'vadd', placeholder: '+ value, Enter', 'data-g': g.id });
      add.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        const v = add.value.trim(); if (!v) return;
        if (g.values.some(x => x.toLowerCase() === v.toLowerCase())) { toast('"' + v + '" is already in ' + g.name + '.', true); return; }
        g.values.push(v); afterRecipeEdit(); setTimeout(() => $('#groups .vadd[data-g="' + g.id + '"]').focus(), 0);
      });
      chips.appendChild(add);
      const name = el('input', { class: 'cell-in', value: g.name });
      name.addEventListener('change', () => { g.name = name.value.trim() || g.name; afterRecipeEdit(); });
      const req = el('select', { class: 'cell-in' }, [el('option', { value: '1', text: 'Required' }), el('option', { value: '0', text: 'Optional' })]);
      req.value = g.required ? '1' : '0';
      req.addEventListener('change', () => { g.required = req.value === '1'; afterRecipeEdit(); });
      const used = usedBy(g.id);
      tb.appendChild(el('tr', null, [
        el('td', { style: 'width:170px' }, [name]),
        el('td', { style: 'width:120px' }, [req]),
        el('td', null, [chips]),
        el('td', { class: 'hint', style: 'width:200px' }, [used.length ? 'Used by: ' + used.join(', ') : 'Not used by any line yet']),
        el('td', { style: 'width:40px' }, [el('button', { type: 'button', class: 'icon-x', title: used.length ? 'Used by ' + used.join(', ') + ' — remove it from those lines first' : 'Remove group',
          disabled: used.length ? '' : null, onclick: () => { R.groups.splice(gi, 1); afterRecipeEdit(); } }, ['🗑'])]),
      ]));
    });
    host.appendChild(el('div', { class: 'ltable-wrap' }, [el('table', { class: 'ltable' }, [
      el('thead', null, [el('tr', null, ['Group', 'Rule', 'Values (typed — no product needed)', 'Where used', ''].map(h => el('th', { scope: 'col', text: h })))]),
      tb])]));
  }

  function groupSelect(sel, opts) {
    opts = opts || {};
    const s = el('select', { class: 'cell-in' });
    if (opts.none) s.appendChild(el('option', { value: '', text: opts.none }));
    (opts.only || R.groups.map(g => g.id)).forEach(id => s.appendChild(el('option', { value: id, text: gname(id) })));
    s.value = sel || '';
    return s;
  }
  function valueSelect(gid, sel, anyText) {
    const s = el('select', { class: 'cell-in' + (has(sel) ? ' named' : '') }, [el('option', { value: '', text: anyText || 'Any' })]);
    grp(gid).values.forEach(v => s.appendChild(el('option', { value: v, text: v })));
    s.value = sel || '';
    return s;
  }
  function matSelect(sel, blankText) {
    const s = el('select', { class: 'cell-in' });
    s.appendChild(el('option', { value: '', text: blankText || '— none —' }));
    V.materials.forEach(m => s.appendChild(el('option', { value: m.id, text: m.name })));
    s.value = sel || '';
    return s;
  }
  /* exact-match rule lookup — what the list and table editors read and write */
  const sameWhen = (r, when) => { const a = named(r), b = Object.keys(when).filter(k => has(when[k])); return a.length === b.length && a.every(k => r.when[k] === when[k]); };
  const ruleFor = (line, when) => line.rules.find(r => sameWhen(r, when));
  function setField(line, when, field, value) {
    let r = ruleFor(line, when);
    if (!r && !has(value)) return;
    if (!r) { r = { when: { ...when } }; line.rules.push(r); }
    if (has(value)) r[field] = value; else delete r[field];
    if (!has(r.material) && !has(r.qty)) line.rules.splice(line.rules.indexOf(r), 1);
  }

  function renderLines() {
    const host = $('#lines'); host.innerHTML = '';
    R.lines.forEach(line => host.appendChild(lineCard(line)));
  }

  function lineCard(line) {
    const card = el('div', { class: 'linecard' });
    const lbl = el('input', { class: 'cell-in strong', value: line.label });
    lbl.addEventListener('change', () => { line.label = lbl.value; afterRecipeEdit(); });
    const dm = matSelect(line.material, '— none (line used only when a rule sets one) —');
    dm.addEventListener('change', () => { line.material = dm.value; afterRecipeEdit(); });
    const dq = el('input', { class: 'cell-in num', type: 'number', step: 'any', value: line.qty });
    dq.addEventListener('change', () => { line.qty = Number(dq.value) || 0; afterRecipeEdit(); });
    const ws = el('input', { class: 'cell-in num', type: 'number', step: 'any', value: line.wastage });
    ws.addEventListener('change', () => { line.wastage = Number(ws.value) || 0; afterRecipeEdit(); });

    const deps = el('div', { class: 'deps' });
    R.groups.forEach(g => {
      const on = line.dependsOn.includes(g.id);
      deps.appendChild(el('button', { type: 'button', class: 'dep' + (on ? ' on' : ''), onclick: () => toggleDep(line, g.id) }, [g.name]));
    });

    card.appendChild(el('div', { class: 'linehead' }, [
      el('div', { class: 'field' }, [el('label', { text: 'Line' }), lbl]),
      el('div', { class: 'field' }, [el('label', { text: 'Default material' }), dm]),
      el('div', { class: 'field' }, [el('label', { text: 'Default qty / pc' }), dq]),
      el('div', { class: 'field' }, [el('label', { text: 'Wastage %' }), ws]),
      el('div', { class: 'field' }, [el('label', { html: 'Depends on <span class="tag-new">any number of groups</span>' }), deps]),
    ]));

    const n = line.dependsOn.length;
    const body = el('div', { class: 'linetables' });
    if (n === 0) body.appendChild(el('div', { class: 'hint', text: 'Fixed line — same material and quantity for every variation.' }));
    if (n === 1) body.appendChild(oneGroupList(line));
    if (n >= 2) body.appendChild(ruleList(line));
    card.appendChild(body);
    return card;
  }

  function toggleDep(line, gid) {
    if (line.dependsOn.includes(gid)) {
      const drop = line.rules.filter(r => has(r.when[gid])).length;
      line.dependsOn = line.dependsOn.filter(x => x !== gid);
      line.rules = line.rules.filter(r => !has(r.when[gid]));
      const tvw = st.tableView[line.id];
      if (tvw) { if (tvw.axes.includes(gid)) delete st.tableView[line.id]; else delete tvw.forv[gid]; }
      if (drop) toast(drop + ' rule(s) naming ' + gname(gid) + ' removed from ' + line.label + '.');
    } else {
      line.dependsOn = R.groups.map(g => g.id).filter(id => id === gid || line.dependsOn.includes(id));   // keep recipe order
    }
    afterRecipeEdit();
  }

  /* 1 group → a short list: one row per value, material and qty side by side */
  function oneGroupList(line) {
    const g = grp(line.dependsOn[0]), tb = el('tbody');
    g.values.forEach(v => {
      const when = { [g.id]: v }, r = ruleFor(line, when) || {};
      const ms = matSelect(r.material, '— default: ' + (line.material ? matName(line.material) : 'none') + ' —');
      ms.addEventListener('change', () => { setField(line, when, 'material', ms.value); afterRecipeEdit(); });
      const qi = el('input', { class: 'cell-in num', type: 'number', step: 'any', placeholder: 'default ' + line.qty, value: has(r.qty) ? r.qty : '' });
      qi.addEventListener('change', () => { setField(line, when, 'qty', qi.value === '' ? '' : Number(qi.value)); afterRecipeEdit(); });
      tb.appendChild(el('tr', null, [el('td', { class: 'vcell', text: v }), el('td', null, [ms]), el('td', { style: 'width:120px' }, [qi])]));
    });
    return el('div', { class: 'mini' }, [el('div', { class: 'mini-h', text: 'One row per ' + g.name + ' — blank keeps the default' }),
      el('table', { class: 'ltable' }, [el('thead', null, [el('tr', null, [g.name, 'Material', 'Qty / pc'].map(h => el('th', { scope: 'col', text: h })))]), tb])]);
  }

  /* 2+ groups → the rule list (Any = wildcard) + an optional qty table over two of the groups */
  function ruleList(line) {
    const wrap = el('div', { class: 'rulewrap' });
    const hr = el('tr', null, [el('th', { scope: 'col', text: '#' })]);
    line.dependsOn.forEach(id => hr.appendChild(el('th', { scope: 'col', text: gname(id) })));
    ['Material', 'Qty / pc', 'Specific', ''].forEach(h => hr.appendChild(el('th', { scope: 'col', text: h })));
    const tb = el('tbody');
    line.rules.forEach((r, i) => {
      const tr = el('tr', null, [el('td', { class: 'hint', text: String(i + 1) })]);
      line.dependsOn.forEach(id => {
        const s = valueSelect(id, r.when[id]);
        s.addEventListener('change', () => {
          const next = { ...r.when, [id]: s.value }; if (!s.value) delete next[id];
          const twin = line.rules.find(x => x !== r && sameWhen(x, next));
          if (twin && ['material', 'qty'].some(f => has(twin[f]) && has(r[f]))) { toast('Another rule already sets that for ' + ruleText({ when: next }) + ' — edit that one.', true); s.value = r.when[id] || ''; return; }
          r.when = next; afterRecipeEdit();
        });
        tr.appendChild(el('td', null, [s]));
      });
      const ms = matSelect(r.material, '— keep —');
      ms.addEventListener('change', () => { if (ms.value) r.material = ms.value; else delete r.material; afterRecipeEdit(); });
      const qi = el('input', { class: 'cell-in num', type: 'number', step: 'any', placeholder: 'keep', value: has(r.qty) ? r.qty : '' });
      qi.addEventListener('change', () => { if (qi.value === '') delete r.qty; else r.qty = Number(qi.value); afterRecipeEdit(); });
      tr.appendChild(el('td', { style: 'min-width:170px' }, [ms]));
      tr.appendChild(el('td', { style: 'width:90px' }, [qi]));
      tr.appendChild(el('td', { class: 'num' }, [el('span', { class: 'spec s' + named(r).length, text: named(r).length + ' / ' + line.dependsOn.length })]));
      tr.appendChild(el('td', null, [el('button', { type: 'button', class: 'icon-x', title: 'Remove rule', onclick: () => { line.rules.splice(i, 1); afterRecipeEdit(); } }, ['🗑'])]));
      tb.appendChild(tr);
    });
    if (!line.rules.length) tb.appendChild(el('tr', null, [el('td', { colspan: String(line.dependsOn.length + 5), class: 'hint', text: 'No rules — every variation uses the default. Add a rule below.' })]));

    wrap.appendChild(el('div', { class: 'mini' }, [
      el('div', { class: 'mini-h' }, ['Rules — "Any" matches every value; for material and for qty separately, the most specific matching rule wins (tie → upper row); no match → default']),
      el('div', { style: 'overflow:auto' }, [el('table', { class: 'ltable rules' }, [el('thead', null, [hr]), tb])]),
    ]));

    const tv = st.tableView[line.id];
    const tools = el('div', { class: 'gridtools' }, [
      el('button', { type: 'button', class: 'btn sm', onclick: () => { line.rules.push({ when: {} }); afterRecipeEdit(); } }, ['+ Add rule']),
      el('button', { type: 'button', class: 'btn sm', onclick: () => {
        if (tv) delete st.tableView[line.id]; else {
          // open on the groups the quantity rules use most (Body fabric → Size × Fit), not simply the first two
          const use = id => line.rules.filter(r => has(r.qty) && has(r.when[id])).length;
          st.tableView[line.id] = { axes: line.dependsOn.slice().sort((x, y) => use(y) - use(x)).slice(0, 2), forv: {} };
        }
        renderLines(); } }, [tv ? 'Hide qty table' : 'Qty as a table…']),
      el('span', { class: 'hint', text: 'The table writes the same rules — rows naming exactly those two groups.' }),
    ]);
    wrap.appendChild(tools);
    if (tv) wrap.appendChild(qtyTable(line, tv));
    return wrap;
  }

  /* 2 groups as rows × columns; every OTHER group the line depends on is a "For:" picker (Any or a value).
     A cell writes the rule naming the two axes + every "For" group set to a value — so with Sleeve = Full
     the M × Slim cell is the 3-group rule M · Slim · Full, and with Any it is the 2-group rule M · Slim. */
  function qtyTable(line, tv) {
    const [a, b] = tv.axes;
    const sa = groupSelect(a, { only: line.dependsOn }), sb = groupSelect(b, { only: line.dependsOn });
    const set = () => {
      if (sa.value === sb.value) { toast('Pick two different groups.', true); renderLines(); return; }
      tv.axes = [sa.value, sb.value]; delete tv.forv[sa.value]; delete tv.forv[sb.value]; renderLines();
    };
    sa.addEventListener('change', set); sb.addEventListener('change', set);

    const others = line.dependsOn.filter(x => x !== a && x !== b);
    const forBar = el('div', { class: 'forbar' });
    if (others.length) {
      forBar.appendChild(el('span', { class: 'lbl', text: 'For:' }));
      others.forEach(id => {
        const s = valueSelect(id, tv.forv[id]);
        s.addEventListener('change', () => { if (s.value) tv.forv[id] = s.value; else delete tv.forv[id]; renderLines(); });
        forBar.appendChild(el('label', { class: 'bsel' }, [gname(id), s]));
      });
      // which "For" slices already hold quantity rules — one click jumps there
      const slices = {};
      line.rules.forEach(r => {
        if (!has(r.qty) || !has(r.when[a]) || !has(r.when[b])) return;
        const key = others.map(id => r.when[id] || '').join('|');
        slices[key] = (slices[key] || 0) + 1;
      });
      const jump = el('span', { class: 'slices' });
      Object.keys(slices).forEach(key => {
        const vals = key.split('|'), txt = others.map((id, i) => gname(id) + ' ' + (vals[i] || 'Any')).join(' · ');
        const cur = others.every((id, i) => (tv.forv[id] || '') === vals[i]);
        jump.appendChild(el('button', { type: 'button', class: 'slice' + (cur ? ' on' : ''), title: 'Show the ' + slices[key] + ' rule(s) for ' + txt,
          onclick: () => { others.forEach((id, i) => { if (vals[i]) tv.forv[id] = vals[i]; else delete tv.forv[id]; }); renderLines(); } }, [txt + ' (' + slices[key] + ')']));
      });
      if (jump.children.length) forBar.appendChild(el('span', { class: 'hint', text: 'Has rules:' })), forBar.appendChild(jump);
    }

    const ga = grp(a), gb = grp(b);
    const hr = el('tr', null, [el('th', { scope: 'col', text: ga.name + ' ↓ / ' + gb.name + ' →' })]);
    gb.values.forEach(c => hr.appendChild(el('th', { scope: 'col', class: 'num', text: c })));
    const tb = el('tbody');
    const base = {}; others.forEach(id => { if (tv.forv[id]) base[id] = tv.forv[id]; });
    ga.values.forEach(rv => {
      const tr = el('tr', null, [el('td', { class: 'vcell', text: rv })]);
      gb.values.forEach(cv => {
        const when = { ...base, [a]: rv, [b]: cv }, r = ruleFor(line, when);
        // placeholder = what would apply WITHOUT this cell's own rule: a less specific rule or the default
        const fallback = pick({ rules: line.rules.filter(x => x !== r || !has(x.qty)) }, 'qty', when);
        const ph = fallback ? String(fallback.qty) : String(line.qty);
        const i = el('input', { class: 'cell-in num' + (r && has(r.qty) ? ' filled' : ''), type: 'number', step: 'any', placeholder: ph, value: r && has(r.qty) ? r.qty : '',
          title: (r && has(r.qty) ? 'Rule ' : 'Blank — falls back to ') + (r && has(r.qty) ? ruleText(r) : (fallback ? 'rule ' + ruleText(fallback) + ' = ' + fallback.qty : 'default ' + line.qty)) });
        i.addEventListener('change', () => { setField(line, when, 'qty', i.value === '' ? '' : Number(i.value)); afterRecipeEdit(); });
        tr.appendChild(el('td', null, [i]));
      });
      tb.appendChild(tr);
    });
    const named3 = Object.keys(base).length + 2;
    return el('div', { class: 'mini qtytable' }, [
      el('div', { class: 'mini-h tvhead' }, ['Qty table: ', sa, ' × ', sb,
        el('span', { class: 'hint', text: ' each cell = a rule naming ' + named3 + ' group' + (named3 === 1 ? '' : 's') + '; blank = falls back to a less specific rule' })]),
      others.length ? forBar : null,
      el('table', { class: 'ltable' }, [el('thead', null, [hr]), tb])]);
  }

  function renderPreview() {
    const host = $('#preview'); host.innerHTML = '';
    const p = st.variation.pick;
    host.appendChild(pickerRows(p, R.groups, () => { renderPreview(); renderOrder(); }));
    const tb = el('tbody');
    R.lines.forEach(line => {
      const r = resolve(line, p);
      tb.appendChild(r
        ? el('tr', null, [el('td', { text: line.label }), el('td', { text: matName(r.mat) }), el('td', { class: 'num', text: num(r.qty, 3) }), el('td', { class: 'hint', text: r.why })])
        : el('tr', { class: 'skipped' }, [el('td', { text: line.label }), el('td', { text: 'not used' }), el('td'), el('td', { class: 'hint', text: 'no rule gives a material for this choice' })]));
    });
    host.appendChild(el('table', { class: 'ltable compact' }, [
      el('thead', null, [el('tr', null, ['Line', 'Material', 'Qty / pc', 'Which rule won'].map(h => el('th', { scope: 'col', text: h })))]), tb]));
    host.appendChild(el('div', { class: 'hint', style: 'margin-top:6px' }, ['Standard material per piece: ', el('b', { text: money(stdPerPiece(p)) })]));
  }

  function afterRecipeEdit() {
    const valid = (id, v) => grp(id) && grp(id).values.includes(v);
    // a removed value or group must not stay in a rule, a pick or a block
    R.lines.forEach(l => {
      l.dependsOn = l.dependsOn.filter(id => grp(id));
      l.rules.forEach(r => Object.keys(r.when).forEach(k => { if (!l.dependsOn.includes(k) || !valid(k, r.when[k])) delete r.when[k]; }));
    });
    Object.keys(st.tableView).forEach(id => { const tv = st.tableView[id]; Object.keys(tv.forv).forEach(k => { if (!valid(k, tv.forv[k])) delete tv.forv[k]; }); });
    [st.variation.pick, st.grid.fixed].forEach(o => Object.keys(o).forEach(k => { if (!valid(k, o[k])) delete o[k]; }));
    st.grid.split = st.grid.split.filter(id => grp(id));
    st.grid.blocks.forEach(b => Object.keys(b.values).forEach(k => { if (!valid(k, b.values[k])) delete b.values[k]; }));
    if (!grp(st.grid.rows)) st.grid.rows = R.groups[0] && R.groups[0].id;
    if (!grp(st.grid.cols)) st.grid.cols = R.groups[1] && R.groups[1].id;
    renderRecipe(); renderOrder();
  }

  $('#btnAddGroup').addEventListener('click', () => {
    R.groups.push({ id: uid('g'), name: 'New group', required: false, values: [] });
    afterRecipeEdit();
    toast('Group added — name it, add values, then tick it under "Depends on" on a line.');
  });
  $('#btnAddLine').addEventListener('click', () => {
    R.lines.push({ id: uid('l'), label: 'New line', material: '', qty: 1, wastage: 0, dependsOn: [], rules: [] });
    afterRecipeEdit();
  });

  /* ======================================================================
     TAB 2 — PRODUCTION ORDER
     ====================================================================== */
  const MODE_TEXT = {
    single: ['Single product', 'Today\'s order. Groups are not asked; every line uses its default.'],
    variation: ['One variation', 'Pick one value per group. One order = one colour/size.'],
    grid: ['Grid', 'Rows × columns, split into blocks by any other groups. One order, many outputs.'],
  };

  function renderModeBar() {
    const host = $('#modebar'); host.innerHTML = '';
    Object.keys(MODE_TEXT).forEach(m => {
      const off = !V.settings.modes[m];
      host.appendChild(el('button', { type: 'button', class: 'modebtn' + (st.mode === m ? ' on' : ''), disabled: off ? '' : null,
        title: off ? 'Switched off in Production Settings → Order modes. Ask your administrator to turn it on.' : MODE_TEXT[m][1],
        onclick: () => { st.mode = m; st.saved = false; renderOrder(); } },
        [el('b', { text: MODE_TEXT[m][0] }), el('span', { text: MODE_TEXT[m][1] })]));
    });
  }

  function renderOrder() {
    renderModeBar();
    const host = $('#orderBody'); host.innerHTML = '';
    if (st.mode === 'single') host.appendChild(singleCard());
    if (st.mode === 'variation') host.appendChild(variationCard());
    if (st.mode === 'grid') host.appendChild(gridCard());
    if (st.mode !== 'single') host.appendChild(outputsCard());
    host.appendChild(materialsCard());
    if (st.mode === 'grid') host.appendChild(floorCard());
    renderRail();
  }

  function qtyField(obj) {
    const i = el('input', { type: 'number', min: '0', value: obj.qty, class: 'qty-big' });
    i.addEventListener('change', () => { obj.qty = Number(i.value) || 0; st.saved = false; renderOrder(); });
    return el('div', { class: 'field', style: 'max-width:180px' }, [el('label', { class: 'req', text: 'Quantity to produce' }), i]);
  }

  function singleCard() {
    return card('Order', 'As today', [
      el('div', { class: 'grid3' }, [
        el('div', { class: 'field' }, [el('label', { text: 'Output product' }), el('input', { value: R.product, disabled: '' })]),
        qtyField(st.single),
        el('div', { class: 'field' }, [el('label', { text: 'Recipe' }), el('input', { value: R.code + ' · ' + R.version, disabled: '' })]),
      ]),
      el('div', { class: 'callout' }, [el('b', { text: 'No groups asked. ' }), 'Every recipe line uses its default material and quantity (lines with no default, like Contrast thread or Cuff rib, are skipped). Existing orders and recipes without groups always open in this mode.']),
    ]);
  }

  function pickerRows(pickObj, groups, onPick) {
    const box = el('div');
    groups.forEach(g => {
      const row = el('div', { class: 'pickrow' }, [el('span', { class: 'lbl' + (g.required ? ' req' : ''), text: g.name + (g.required ? '' : ' (optional)') })]);
      const p = el('div', { class: 'pills' });
      (g.required ? g.values : ['None'].concat(g.values)).forEach(v => {
        const on = v === 'None' ? !pickObj[g.id] : pickObj[g.id] === v;
        p.appendChild(el('button', { type: 'button', class: 'pill' + (on ? ' on' : ''), onclick: () => {
          if (v === 'None') delete pickObj[g.id]; else pickObj[g.id] = v; onPick(); } }, [v]));
      });
      if (g.required && !pickObj[g.id]) row.classList.add('missing');
      row.appendChild(p); box.appendChild(row);
    });
    return box;
  }

  function variationCard() {
    return card('Order — one variation', 'Single select per group', [
      el('div', { class: 'grid3' }, [qtyField(st.variation),
        el('div', { class: 'field' }, [el('label', { text: 'Recipe' }), el('input', { value: R.code + ' · ' + R.version, disabled: '' })])]),
      el('div', { class: 'sub', text: 'Variation' }),
      pickerRows(st.variation.pick, R.groups, () => { st.saved = false; renderOrder(); renderPreview(); }),
    ]);
  }

  /* ---------- grid: rows × columns + split-by blocks ----------------------- */
  const changed = () => { st.saved = false; renderOrder(); };

  function gridCard() {
    const g = st.grid;
    const rs = groupSelect(g.rows), cs = groupSelect(g.cols);
    const reshape = () => {
      g.split = g.split.filter(id => id !== g.rows && id !== g.cols);
      delete g.fixed[g.rows]; delete g.fixed[g.cols];
      g.blocks = [{ id: uid('b'), values: {}, cells: {} }]; st.done = {};
      toast('Grid layout changed — the grid was cleared.'); changed();
    };
    rs.addEventListener('change', () => { g.rows = rs.value; reshape(); });
    cs.addEventListener('change', () => { g.cols = cs.value; reshape(); });

    const splittable = R.groups.filter(x => x.id !== g.rows && x.id !== g.cols);
    const splitPills = el('div', { class: 'deps' });
    splittable.forEach(x => {
      const on = g.split.includes(x.id);
      splitPills.appendChild(el('button', { type: 'button', class: 'dep' + (on ? ' on' : ''), onclick: () => toggleSplit(x.id) }, [x.name]));
    });

    const viewBtns = el('div', { class: 'seg' }, ['blocks', 'list'].map(v =>
      el('button', { type: 'button', class: st.gridView === v ? 'on' : '', onclick: () => { st.gridView = v; renderOrder(); } }, [v === 'blocks' ? 'Grid blocks' : 'List view'])));

    const kids = [
      el('div', { class: 'gridpick' }, [
        el('div', { class: 'field' }, [el('label', { text: 'Rows' }), rs]),
        el('span', { class: 'hint', text: '×' }),
        el('div', { class: 'field' }, [el('label', { text: 'Columns' }), cs]),
        el('div', { class: 'field', style: 'flex:1;width:auto' }, [el('label', { html: 'Split into blocks by <span class="tag-new">any number of groups</span>' }), splitPills]),
        viewBtns,
      ]),
    ];
    if (g.rows === g.cols) { kids.push(el('div', { class: 'callout warn', text: 'Pick two different groups.' })); return card('Order — grid', 'One order, many outputs', kids); }

    if (st.gridView === 'list') kids.push(listView());
    else {
      g.blocks.forEach((b, i) => kids.push(blockCard(b, i)));
      if (g.split.length) kids.push(addBlockBar());
    }

    const fixedGroups = splittable.filter(x => !g.split.includes(x.id));
    if (fixedGroups.length) {
      kids.push(el('div', { class: 'sub', text: 'Same for the whole order' }));
      kids.push(pickerRows(g.fixed, fixedGroups, changed));
    }
    const total = cells().reduce((s, c) => s + c.qty, 0);
    kids.push(el('div', { class: 'ordertotal' }, ['Order total: ', el('b', { text: num(total, 0) + ' ' + R.unit }), ' · ' + cells().length + ' output lines in ' + g.blocks.length + ' block' + (g.blocks.length === 1 ? '' : 's')]));
    return card('Order — grid', 'One order, many outputs', kids);
  }

  function toggleSplit(id) {
    const g = st.grid;
    if (g.split.includes(id)) {
      // merging: blocks that differ only by this group would collide — refuse while two blocks would merge
      const keyOf = b => g.split.filter(x => x !== id).map(x => b.values[x] || '').join('|');
      const keys = g.blocks.map(keyOf);
      if (new Set(keys).size !== keys.length) { toast('Two blocks differ only by ' + gname(id) + ' — remove or merge one of them first.', true); return; }
      g.split = g.split.filter(x => x !== id);
      g.blocks.forEach(b => delete b.values[id]);
    } else {
      g.split = R.groups.map(x => x.id).filter(x => x === id || g.split.includes(x));
      delete g.fixed[id];
      g.blocks.forEach(b => { if (!grp(id).required) return; b.values[id] = grp(id).values[0]; });
      toast('Every block now asks for a ' + gname(id) + '.');
    }
    changed();
  }

  function blockTitle(b) {
    const g = st.grid;
    if (!g.split.length) return 'All cells';
    return g.split.map(id => gname(id) + ' ' + (b.values[id] || (grp(id).required ? '?' : 'None'))).join(' · ');
  }

  function blockCard(b, i) {
    const g = st.grid, gr = grp(g.rows), gc = grp(g.cols);
    const head = el('div', { class: 'blockhead' }, [el('span', { class: 'bno', text: 'Block ' + (i + 1) })]);
    g.split.forEach(id => {
      const s = valueSelect(id, b.values[id], grp(id).required ? '— pick —' : 'None');
      s.addEventListener('change', () => {
        const next = { ...b.values, [id]: s.value }; if (!s.value) delete next[id];
        const clash = g.blocks.find(x => x !== b && g.split.every(k => (x.values[k] || '') === (next[k] || '')));
        if (clash) { toast('Block ' + (g.blocks.indexOf(clash) + 1) + ' already is ' + blockTitle({ values: next }) + ' — type the quantities there.', true); s.value = b.values[id] || ''; return; }
        b.values = next; changed();
      });
      if (grp(id).required && !b.values[id]) s.classList.add('missing');
      head.appendChild(el('label', { class: 'bsel' }, [gname(id), s]));
    });
    head.appendChild(el('span', { style: 'flex:1' }));
    const others = g.blocks.filter(x => x !== b);
    if (others.length) {
      const cp = el('select', { class: 'cell-in', style: 'width:auto' }, [el('option', { value: '', text: 'Copy quantities from…' })]
        .concat(others.map(x => el('option', { value: x.id, text: 'Block ' + (g.blocks.indexOf(x) + 1) + ' · ' + blockTitle(x) }))));
      cp.addEventListener('change', () => { const src = g.blocks.find(x => x.id === cp.value); if (src) { b.cells = { ...src.cells }; changed(); } });
      head.appendChild(cp);
    }
    head.appendChild(el('button', { type: 'button', class: 'btn sm', onclick: () => fillRatio(b) }, ['Fill by ratio…']));
    head.appendChild(el('button', { type: 'button', class: 'btn sm', onclick: () => { b.cells = {}; changed(); } }, ['Clear']));
    if (g.blocks.length > 1) head.appendChild(el('button', { type: 'button', class: 'btn sm danger', onclick: () => { g.blocks.splice(i, 1); changed(); } }, ['Remove block']));

    const hr = el('tr', null, [el('th', { scope: 'col', text: gr.name + ' ↓ / ' + gc.name + ' →' })]);
    gc.values.forEach(c => hr.appendChild(el('th', { scope: 'col', class: 'num', text: c })));
    hr.appendChild(el('th', { scope: 'col', class: 'num', text: 'Total' }));
    const tb = el('tbody'); const colTot = {}; let grand = 0;
    gr.values.forEach(r => {
      const tr = el('tr', null, [el('td', { class: 'vcell', text: r })]); let rt = 0;
      gc.values.forEach(c => {
        const k = r + '|' + c, v = Number(b.cells[k]) || 0;
        rt += v; colTot[c] = (colTot[c] || 0) + v;
        const inp = el('input', { class: 'cell-in num gridin' + (v ? ' filled' : ''), type: 'number', min: '0', value: v || '', placeholder: '0' });
        inp.addEventListener('change', () => { const n = Number(inp.value) || 0; if (n) b.cells[k] = n; else delete b.cells[k]; changed(); });
        tr.appendChild(el('td', null, [inp]));
      });
      grand += rt;
      tr.appendChild(el('td', { class: 'num tot', text: num(rt, 0) }));
      tb.appendChild(tr);
    });
    const ft = el('tr', null, [el('td', { text: 'Total' })]);
    gc.values.forEach(c => ft.appendChild(el('td', { class: 'num', text: num(colTot[c] || 0, 0) })));
    ft.appendChild(el('td', { class: 'num', text: num(grand, 0) }));
    return el('div', { class: 'blockcard' }, [head, el('div', { class: 'ltable-wrap' }, [el('table', { class: 'ltable gridtable' }, [el('thead', null, [hr]), tb, el('tfoot', null, [ft])])])]);
  }

  function fillRatio(b) {
    const g = st.grid, gr = grp(g.rows), gc = grp(g.cols);
    const v = prompt('Ratio across ' + gc.name + ' (' + gc.values.join(':') + ') and pieces per ' + gr.name + ', e.g. "1:2:1:0 200":', gc.values.map(() => 1).join(':') + ' 100');
    if (!v) return;
    const [ratio, per] = v.trim().split(/\s+/); const parts = (ratio || '').split(':').map(Number); const total = Number(per);
    if (parts.length !== gc.values.length || !(total > 0)) { toast('Give one ratio part per ' + gc.name + ' and a total.', true); return; }
    const sum = parts.reduce((a, x) => a + x, 0) || 1;
    gr.values.forEach(r => gc.values.forEach((c, ci) => { const n = Math.round(total * parts[ci] / sum); const k = r + '|' + c; if (n) b.cells[k] = n; else delete b.cells[k]; }));
    changed();
  }

  function addBlockBar() {
    const g = st.grid, draft = {};
    const bar = el('div', { class: 'addblock' }, [el('span', { class: 'lbl', text: '+ Add block' })]);
    g.split.forEach(id => {
      const s = valueSelect(id, '', grp(id).required ? '— pick —' : 'None');
      s.addEventListener('change', () => { if (s.value) draft[id] = s.value; else delete draft[id]; });
      bar.appendChild(el('label', { class: 'bsel' }, [gname(id), s]));
    });
    bar.appendChild(el('button', { type: 'button', class: 'btn sm primary', onclick: () => {
      const miss = g.split.filter(id => grp(id).required && !draft[id]);
      if (miss.length) { toast('Pick a ' + gname(miss[0]) + ' for the new block.', true); return; }
      const clash = g.blocks.find(x => g.split.every(k => (x.values[k] || '') === (draft[k] || '')));
      if (clash) { toast('Block ' + (g.blocks.indexOf(clash) + 1) + ' already is ' + blockTitle({ values: draft }) + '.', true); return; }
      g.blocks.push({ id: uid('b'), values: { ...draft }, cells: {} }); changed();
      toast('Block ' + g.blocks.length + ' added — ' + blockTitle({ values: draft }) + '. Only the blocks you need, never every combination.');
    } }, ['Add']));
    bar.appendChild(el('span', { class: 'hint', text: 'Blocks are added on demand — 2 fits × 2 sleeves never means 4 empty grids.' }));
    return bar;
  }

  function listView() {
    const g = st.grid, gr = grp(g.rows), gc = grp(g.cols);
    const cols = [...g.split, g.rows, g.cols];
    const tb = el('tbody');
    g.blocks.forEach(b => gr.values.forEach(r => gc.values.forEach(c => {
      const k = r + '|' + c, v = Number(b.cells[k]) || 0;
      if (!v) return;
      const vals = { ...b.values, [g.rows]: r, [g.cols]: c };
      const inp = el('input', { class: 'cell-in num', type: 'number', min: '0', value: v });
      inp.addEventListener('change', () => { const n = Number(inp.value) || 0; if (n) b.cells[k] = n; else delete b.cells[k]; changed(); });
      tb.appendChild(el('tr', null, cols.map(id => el('td', { text: vals[id] || 'None' })).concat([el('td', { style: 'width:110px' }, [inp])])));
    })));
    if (!tb.children.length) tb.appendChild(el('tr', null, [el('td', { colspan: String(cols.length + 1), class: 'hint', text: 'Nothing typed yet — switch to Grid blocks to enter quantities.' })]));
    return el('div', { class: 'ltable-wrap' }, [el('table', { class: 'ltable compact' }, [
      el('thead', null, [el('tr', null, cols.map(id => el('th', { scope: 'col', text: gname(id) })).concat([el('th', { scope: 'col', class: 'num', text: 'Qty' })]))]), tb])]);
  }

  function outputsCard() {
    const list = cells();
    const toggle = el('div', { class: 'radios' }, [
      radio('outTo', 'own', st.outputTo === 'own', 'Each variation into its own product (stock split by colour/size/…)'),
      radio('outTo', 'base', st.outputTo === 'base', 'All into "' + R.product + '" — values go to the description and lot only'),
    ]);
    toggle.addEventListener('change', e => { st.outputTo = e.target.value; changed(); });
    const tb = el('tbody'); let missing = 0;
    list.forEach((c, i) => {
      const o = outputOf(c); if (!o.exists) missing++;
      tb.appendChild(el('tr', null, [
        el('td', { class: 'hint', text: String(i + 1) }),
        el('td', null, [el('b', { text: o.product })]),
        el('td', { text: o.desc || '—' }),
        el('td', { class: 'num', text: num(c.qty, 0) }),
        el('td', { class: 'mono', text: V.demo.orderNo + (o.desc ? ' ' + o.desc.replace(/ \/ /g, '/') : '') }),
        el('td', null, [o.exists ? el('span', { class: 'st approved', text: 'Found' })
          : el('button', { type: 'button', class: 'btn sm blue', title: 'Copies category, unit and accounts from ' + R.product, onclick: () => { st.products.push(o.product); toast('Created "' + o.product + '" — category, unit, accounts copied from ' + R.product + '.'); renderOrder(); } }, ['+ Create'])]),
      ]));
    });
    const bulk = missing > 1 ? el('button', { type: 'button', class: 'btn sm blue', onclick: () => {
      list.map(outputOf).filter(o => !o.exists).forEach(o => { if (!st.products.includes(o.product)) st.products.push(o.product); });
      toast('Created ' + missing + ' products in one go.'); renderOrder(); } }, ['+ Create all ' + missing + ' missing']) : null;
    return card('Output products', list.length + ' line' + (list.length === 1 ? '' : 's'), [
      toggle,
      el('div', { class: 'ltable-wrap', style: 'margin-top:8px' }, [el('table', { class: 'ltable' }, [
        el('thead', null, [el('tr', null, ['#', 'Product', 'Description', 'Planned', 'Lot label', ''].map(h => el('th', { scope: 'col', class: h === 'Planned' ? 'num' : '', text: h })))]), tb])]),
      el('div', { class: 'gridtools' }, [bulk, el('span', { class: 'hint', text: 'Find first: a product with the exact name is reused, never duplicated. Users without product-create permission see only "Found" lines.' })]),
    ], 'outputs');
  }

  function materialsCard() {
    const list = cells(); const { agg, per } = explode(list);
    let total = 0;
    const tb = el('tbody');
    agg.forEach(a => {
      const m = mat(a.mat), amt = a.qty * m.rate; total += amt;
      tb.appendChild(el('tr', null, [
        el('td', null, [el('b', { text: m.name }), el('div', { class: 'hint', text: [...a.lines].join(', ') })]),
        el('td', { class: 'num', text: num(a.qty, 2) + ' ' + m.unit }),
        el('td', { class: 'num', text: num(m.rate, 2) }),
        el('td', { class: 'num', text: money(amt) }),
        el('td', { class: 'hint', text: [...a.why].slice(0, 3).join(' | ') + (a.why.size > 3 ? ' | …' : '') }),
      ]));
    });
    const kids = [el('div', { class: 'ltable-wrap' }, [el('table', { class: 'ltable' }, [
      el('thead', null, [el('tr', null, ['Material', 'Need', 'Rate', 'Amount', 'Which rule won'].map(h => el('th', { scope: 'col', class: ['Need', 'Rate', 'Amount'].includes(h) ? 'num' : '', text: h })))]),
      tb, el('tfoot', null, [el('tr', null, [el('td', { text: 'Standard material' }), el('td'), el('td'), el('td', { class: 'num', text: money(total) }), el('td')])])])])];
    if (st.mode === 'grid' && list.length) {
      const btn = el('button', { type: 'button', class: 'btn sm', onclick: () => { st.perCell = !st.perCell; renderOrder(); } }, [st.perCell ? 'Hide per cell' : 'Show per cell']);
      kids.push(el('div', { class: 'gridtools' }, [btn, el('span', { class: 'hint', text: 'The order issues the summed figures above; per cell is for checking.' })]));
      if (st.perCell) {
        const pt = el('tbody');
        per.forEach(p => pt.appendChild(el('tr', { class: p.skipped ? 'skipped' : '' }, [
          el('td', { text: p.cell }), el('td', { text: p.line }),
          el('td', { text: p.skipped ? 'not used' : matName(p.mat) }),
          el('td', { class: 'num', text: p.skipped ? '' : num(p.qty, 2) }), el('td', { class: 'hint', text: p.why || '' })])));
        kids.push(el('div', { class: 'ltable-wrap' }, [el('table', { class: 'ltable compact' }, [
          el('thead', null, [el('tr', null, ['Cell', 'Line', 'Material', 'Need', 'Which rule won'].map(h => el('th', { scope: 'col', text: h })))]), pt])]));
      }
    }
    return card('Materials worked out', 'Summed across ' + list.length + ' output line' + (list.length === 1 ? '' : 's'), kids);
  }

  function floorCard() {
    const g = st.grid, list = cells();
    const byRow = {};
    list.forEach(c => {
      const r = c.chosen[g.rows]; const b = byRow[r] || (byRow[r] = { pcs: 0, split: {}, mats: {} });
      b.pcs += c.qty;
      const sk = c.chosen[g.cols]; b.split[sk] = (b.split[sk] || 0) + c.qty;
      R.lines.forEach(line => { const x = resolve(line, c.chosen); if (x && line.dependsOn.includes(g.rows) && line.rules.some(rr => has(rr.material) && has(rr.when[g.rows]))) b.mats[x.mat] = (b.mats[x.mat] || 0) + c.qty * x.qty * (1 + x.wastage / 100); });
    });
    const tb = el('tbody');
    Object.keys(byRow).forEach(r => tb.appendChild(el('tr', null, [
      el('td', null, [el('b', { text: gname(g.rows) + ' ' + r })]),
      el('td', { class: 'num', text: num(byRow[r].pcs, 0) }),
      el('td', { text: Object.entries(byRow[r].split).map(([k, q]) => k + ' ' + q).join(' · ') }),
      el('td', { class: 'hint', text: Object.entries(byRow[r].mats).map(([m, q]) => matName(m) + ' ' + num(q, 1) + ' ' + mat(m).unit).join(', ') }),
    ])));
    return card('On the floor', 'Draft — for your decision', [
      el('div', { class: 'ltable-wrap' }, [el('table', { class: 'ltable' }, [
        el('thead', null, [el('tr', null, ['Cutting lay', 'Pieces', gname(g.cols) + ' split (all blocks)', 'Materials that follow ' + gname(g.rows)].map(h => el('th', { scope: 'col', class: h === 'Pieces' ? 'num' : '', text: h })))]), tb])]),
      el('div', { class: 'callout', style: 'margin-bottom:0' }, [el('b', { text: 'Stages stay as today, with one addition: ' }),
        'a stage card shows its figures per output line (Red/M/Regular/Half 100 in, 98 done…), and Record output / Send ask "which line". The first stage can be worked per ' + gname(g.rows) + ' (one lay = all its sizes, across blocks).']),
    ], null, true);
  }

  function radio(name, value, on, text) {
    const i = el('input', { type: 'radio', name, value }); if (on) i.checked = true;
    return el('label', { class: 'radio' }, [i, ' ' + text]);
  }

  function card(title, tag, kids, id, draft) {
    return el('section', { class: 'card', id: id || null }, [
      el('div', { class: 'ch' }, [el('h2', { text: title }), tag ? el('span', { class: 'tag' + (draft ? ' draft' : ''), text: tag }) : null]),
      el('div', { class: 'cb' }, kids)]);
  }

  function renderRail() {
    const list = cells(); const { agg } = explode(list);
    const pcs = list.reduce((s, c) => s + c.qty, 0);
    const std = agg.reduce((s, a) => s + a.qty * mat(a.mat).rate, 0);
    UI.kpis('#orderKpis', [
      { label: 'Pieces', value: num(pcs, 0), accent: true },
      { label: 'Output lines', value: String(list.length) },
      { label: 'Materials', value: String(agg.length) },
      { label: 'Std material / pc', value: pcs ? money(std / pcs) : '—' },
    ]);
    const iss = issues(); const host = $('#checks'); host.innerHTML = '';
    if (!iss.length) host.appendChild(el('div', { class: 'ok', text: '✓ Ready to save' }));
    iss.forEach(t => host.appendChild(el('div', { class: 'bad', text: '• ' + t })));
    const save = $('#btnSave');
    save.disabled = !!iss.length;
    save.title = iss.length ? 'Fix the items above first: ' + iss[0] : '';
    $('#saveState').textContent = st.saved ? 'Saved · Draft' : 'Not saved';
    $('#saveState').className = 'st ' + (st.saved ? 'approved' : 'draft');
  }

  $('#btnSave').addEventListener('click', () => {
    if (issues().length) return;
    st.saved = true; st.done = {};
    cells().forEach(c => { st.done[c.key] = Math.max(0, c.qty - (c.qty >= 100 ? 2 : c.qty >= 50 ? 1 : 0)); });
    renderRail(); renderComplete();
    toast(V.demo.orderNo + ' saved — ' + cells().length + ' output line(s). Open the Complete tab.');
  });

  /* ======================================================================
     TAB 3 — COMPLETE (one WIP pool, shared by standard material)
     ====================================================================== */
  function renderComplete() {
    const host = $('#completeBody'); host.innerHTML = '';
    if (!st.saved) { host.appendChild(el('div', { class: 'callout warn', text: 'Save the order on the Production order tab first — Complete works on the saved output lines.' })); return; }
    const list = cells();
    const { agg } = explode(list);
    const wip = agg.reduce((s, a) => s + a.qty * mat(a.mat).rate, 0);   // assume every planned material was issued
    const rows = list.map(c => {
      const done = Number(st.done[c.key]) || 0, std = stdPerPiece(c.chosen);
      return { c, o: outputOf(c), done, std, w: done * std };
    });
    const W = rows.reduce((s, r) => s + r.w, 0) || 1;
    let given = 0;
    rows.forEach((r, i) => { r.value = i === rows.length - 1 ? wip - given : Math.round(wip * r.w / W * 100) / 100; given += r.value; r.rate = r.done ? r.value / r.done : 0; });

    const tb = el('tbody');
    rows.forEach(r => {
      const i = el('input', { class: 'cell-in num', type: 'number', min: '0', value: r.done });
      i.addEventListener('change', () => { st.done[r.c.key] = Math.max(0, Number(i.value) || 0); renderComplete(); });
      tb.appendChild(el('tr', null, [
        el('td', null, [el('b', { text: r.o.product }), r.o.desc && st.outputTo === 'base' ? el('div', { class: 'hint', text: r.o.desc }) : null]),
        el('td', { class: 'num', text: num(r.c.qty, 0) }),
        el('td', { style: 'width:110px' }, [i]),
        el('td', { class: 'num', text: money(r.std) }),
        el('td', { class: 'num', text: num(r.w / W * 100, 1) + '%' }),
        el('td', { class: 'num', text: money(r.value) }),
        el('td', { class: 'num', text: r.done ? money(r.rate) : '—' }),
      ]));
    });
    host.appendChild(card('Complete ' + V.demo.orderNo, 'Final complete — absorbs all WIP', [
      el('div', { class: 'ltable-wrap' }, [el('table', { class: 'ltable' }, [
        el('thead', null, [el('tr', null, ['Output', 'Planned', 'Good pieces', 'Std material / pc', 'Share', 'Value', 'Cost / pc'].map((h, i) => el('th', { scope: 'col', class: i ? 'num' : '', text: h })))]),
        tb,
        el('tfoot', null, [el('tr', null, [el('td', { text: 'WIP material (issued)' }), el('td'), el('td', { class: 'num', text: num(rows.reduce((s, r) => s + r.done, 0), 0) }), el('td'), el('td', { class: 'num', text: '100%' }), el('td', { class: 'num', text: money(wip) }), el('td')])]),
      ])]),
      el('div', { class: 'callout' }, [el('b', { text: 'How the value is shared: ' }),
        'one WIP pool per order (as today). Each line\'s share = good pieces × its standard material per piece. An XL (more fabric) or a full sleeve (cuff rib) carries more cost; lost pieces spread their material over every good piece of the order. The last line absorbs the rounding, so the total equals WIP to the cent.' +
        (rows.length === 1 ? ' With one output line it is simply WIP ÷ good pieces — exactly today\'s rule.' : '')]),
    ]));
  }

  /* ---------- boot --------------------------------------------------------- */
  UI.shell({ active: 'PROD', company: DEMO.company, user: DEMO.user });
  UI.tabs('#tabs');
  document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => { if (b.dataset.pane === 'pComplete') renderComplete(); }));
  renderRecipe(); renderOrder(); renderComplete();
})();
