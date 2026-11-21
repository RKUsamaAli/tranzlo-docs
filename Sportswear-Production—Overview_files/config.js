/* ==========================================================================
   config.js — the ONE source of truth for the sportswear prototype.
   Recipes (groups, rules, outputs), materials, existing products, stages and
   the demo orders live here; the screens only read it. At implementation
   time this file becomes the recipe seed / form schema — that is the hand-over.
   Every name, rate and person below is invented demonstration data.
   ========================================================================== */
window.CFG = (function () {
  const modules = [
    ['\u{1F3E0}', '', 'home'], ['⭐', '', 'fav'], ['\u{1F4E6}', 'IMS'], ['\u{1F6D2}', 'PMS'],
    ['\u{1F4CA}', 'SMS'], ['\u{1F3ED}', 'PROD'], ['\u{1F9FE}', 'FAS'], ['\u{1F465}', 'HRM'],
  ];

  const settings = {
    modes: { single: true, variation: true, grid: true },   // Production Settings → Order modes
    defaultMode: 'grid',
    maxOutputLines: 300,                                     // per order
    rosterOnGrid: true,                                      // "Fill from team list" on grid orders
  };

  /* ---- Sizes shared by jerseys and kits ------------------------------------ */
  const SIZES = ['YS', 'YM', 'YL', 'S', 'M', 'L', 'XL', '2XL'];
  const by = (values, list) => values.map((v, i) => ({ when: { size: v }, qty: list[i] }));

  /* ---- Raw materials (the product picker) ---------------------------------- */
  const materials = [
    { id: 'fab-int',  name: 'Polyester Interlock 160gsm - White', unit: 'm', rate: 420 },
    { id: 'fab-mesh', name: 'Polyester Mesh 140gsm - White',      unit: 'm', rate: 380 },
    { id: 'fab-short',name: 'Polyester Micro-mesh - White',       unit: 'm', rate: 360 },
    { id: 'pap',      name: 'Sublimation Paper 100gsm',           unit: 'm', rate: 45 },
    { id: 'ink',      name: 'Sublimation Ink (CMYK)',             unit: 'ml', rate: 1.2 },
    { id: 'rib-blue', name: 'Collar Rib - Blue',  unit: 'pcs', rate: 35 },
    { id: 'rib-white',name: 'Collar Rib - White', unit: 'pcs', rate: 35 },
    { id: 'rib-green',name: 'Collar Rib - Green', unit: 'pcs', rate: 35 },
    { id: 'tape',     name: 'Neck Tape - White',  unit: 'm',   rate: 8 },
    { id: 'th-blue',  name: 'Overlock Thread - Blue',  unit: 'm', rate: 0.06 },
    { id: 'th-white', name: 'Overlock Thread - White', unit: 'm', rate: 0.06 },
    { id: 'th-green', name: 'Overlock Thread - Green', unit: 'm', rate: 0.06 },
    { id: 'care',     name: 'Care Label',  unit: 'pcs', rate: 2 },
    { id: 'hang',     name: 'Hang Tag',    unit: 'pcs', rate: 3 },
    { id: 'poly',     name: 'Poly Bag',    unit: 'pcs', rate: 4 },
    { id: 'elastic',  name: 'Waistband Elastic 30mm', unit: 'm', rate: 18 },
    { id: 'cord',     name: 'Drawcord - White',       unit: 'm', rate: 6 },
    { id: 'sock-y',   name: 'Knitted Sock Blank - Youth',       unit: 'pair', rate: 90 },
    { id: 'sock-a1',  name: 'Knitted Sock Blank - Adult 39-42', unit: 'pair', rate: 95 },
    { id: 'sock-a2',  name: 'Knitted Sock Blank - Adult 43-46', unit: 'pair', rate: 100 },
    { id: 'kitpack',  name: 'Kit Pack Bag (zip)', unit: 'pcs', rate: 12 },
    { id: 'p600-black', name: '600D Polyester - Black', unit: 'm', rate: 520 },
    { id: 'p600-navy',  name: '600D Polyester - Navy',  unit: 'm', rate: 520 },
    { id: 'p600-red',   name: '600D Polyester - Red',   unit: 'm', rate: 540 },
    { id: 'lining',   name: 'Lining 210D - Grey', unit: 'm', rate: 180 },
    { id: 'pu-s',     name: 'PU Base Panel - S', unit: 'pcs', rate: 120 },
    { id: 'pu-m',     name: 'PU Base Panel - M', unit: 'pcs', rate: 150 },
    { id: 'pu-l',     name: 'PU Base Panel - L', unit: 'pcs', rate: 180 },
    { id: 'zip-60',   name: '#8 Zip 60cm', unit: 'pcs', rate: 55 },
    { id: 'zip-70',   name: '#8 Zip 70cm', unit: 'pcs', rate: 62 },
    { id: 'zip-80',   name: '#8 Zip 80cm', unit: 'pcs', rate: 70 },
    { id: 'web-black',name: 'Webbing 38mm - Black', unit: 'm', rate: 30 },
    { id: 'web-navy', name: 'Webbing 38mm - Navy',  unit: 'm', rate: 30 },
    { id: 'web-red',  name: 'Webbing 38mm - Red',   unit: 'm', rate: 32 },
    { id: 'buckle',   name: 'Buckle & D-ring Set', unit: 'set', rate: 25 },
    { id: 'foam',     name: 'Foam Padding 5mm', unit: 'm', rate: 140 },
    { id: 'emb',      name: 'Embroidery Thread', unit: 'm', rate: 0.1 },
    { id: 'scr',      name: 'Screen Print Ink', unit: 'ml', rate: 0.8 },
  ].concat(SIZES.map(s => ({ id: 'lbl-' + s, name: 'Size Label - ' + s, unit: 'pcs', rate: 1.5 })));

  /* ---- Recipes --------------------------------------------------------------
     groups    open: any name, typed values, required or optional
     outputs   what the order books into stock; a kit has three. `follows` = the groups in the
               product name; `map` renames a value for that output (socks: M → 39-42)
     lines     default material/qty + dependsOn (any number of groups) + rules
               (a rule names some groups — the rest are Any; most specific wins);
               `output` ties a line to one output of a kit (for cost sharing)        */
  const fabricShort = [0.55, 0.6, 0.68, 0.75, 0.8, 0.88, 0.95, 1.05];
  const fabricLong  = [0.7, 0.76, 0.85, 0.95, 1.02, 1.1, 1.2, 1.32];
  const recipes = [
    {
      id: 'jersey', code: 'RCP-101', version: 'v2', name: 'Team Jersey (sublimation)', product: 'Team Jersey', outputQty: 1, unit: 'pcs',
      route: ['Printing (paper)', 'Heat transfer', 'Cutting', 'Stitching', 'QC', 'Packing'],
      groups: [
        { id: 'design', name: 'Design',        required: true,  values: ['Home Blue', 'Away White', 'GK Green'] },
        { id: 'size',   name: 'Size',          required: true,  values: SIZES.slice() },
        { id: 'sleeve', name: 'Sleeve',        required: true,  values: ['Short', 'Long'] },
        { id: 'collar', name: 'Collar',        required: true,  values: ['Round', 'V-neck', 'Polo'] },
        { id: 'pers',   name: 'Name & number', required: false, values: ['Name + Number', 'Number only'] },
      ],
      outputs: [{ id: 'main', label: 'Jersey', product: 'Team Jersey', follows: ['design', 'size', 'sleeve', 'collar'] }],
      lines: [
        { id: 'fab', label: 'Body fabric', material: 'fab-int', qty: 0.8, wastage: 4, dependsOn: ['size', 'sleeve'],
          rules: by(SIZES, fabricShort).concat(SIZES.map((s, i) => ({ when: { size: s, sleeve: 'Long' }, qty: fabricLong[i] }))) },
        { id: 'mesh', label: 'Side mesh panels', material: 'fab-mesh', qty: 0.12, wastage: 4, dependsOn: ['size'],
          rules: by(['YS', 'YM', 'YL', 'XL', '2XL'], [0.08, 0.08, 0.1, 0.15, 0.16]) },
        { id: 'pap', label: 'Sublimation paper', material: 'pap', qty: 0.9, wastage: 5, dependsOn: ['size', 'sleeve'],
          rules: by(SIZES, fabricShort.map(x => +(x * 1.1).toFixed(2))).concat(SIZES.map((s, i) => ({ when: { size: s, sleeve: 'Long' }, qty: +(fabricLong[i] * 1.1).toFixed(2) }))) },
        { id: 'ink', label: 'Sublimation ink', material: 'ink', qty: 18, wastage: 0, dependsOn: ['size'],
          rules: by(['YS', 'YM', 'YL', 'XL', '2XL'], [12, 13, 15, 21, 24]) },
        { id: 'persp', label: 'Name & number print', material: '', qty: 0.12, wastage: 5, dependsOn: ['pers'],
          rules: [{ when: { pers: 'Name + Number' }, material: 'pap', qty: 0.12 }, { when: { pers: 'Number only' }, material: 'pap', qty: 0.06 }] },
        { id: 'rib', label: 'Polo collar rib', material: '', qty: 1, wastage: 0, dependsOn: ['collar', 'design'],
          rules: [{ when: { collar: 'Polo', design: 'Home Blue' }, material: 'rib-blue' },
                  { when: { collar: 'Polo', design: 'Away White' }, material: 'rib-white' },
                  { when: { collar: 'Polo', design: 'GK Green' }, material: 'rib-green' }] },
        { id: 'tape', label: 'Neck tape', material: '', qty: 0.45, wastage: 0, dependsOn: ['collar'],
          rules: [{ when: { collar: 'Round' }, material: 'tape', qty: 0.45 }, { when: { collar: 'V-neck' }, material: 'tape', qty: 0.5 }] },
        { id: 'thread', label: 'Overlock thread', material: 'th-white', qty: 160, wastage: 0, dependsOn: ['design', 'sleeve'],
          rules: [{ when: { design: 'Home Blue' }, material: 'th-blue' }, { when: { design: 'Away White' }, material: 'th-white' },
                  { when: { design: 'GK Green' }, material: 'th-green' }, { when: { sleeve: 'Long' }, qty: 190 }] },
        { id: 'lbl', label: 'Size label', material: 'lbl-M', qty: 1, wastage: 0, dependsOn: ['size'],
          rules: SIZES.map(s => ({ when: { size: s }, material: 'lbl-' + s })) },
        { id: 'care', label: 'Care label', material: 'care', qty: 1, wastage: 0, dependsOn: [], rules: [] },
        { id: 'poly', label: 'Poly bag', material: 'poly', qty: 1, wastage: 0, dependsOn: [], rules: [] },
      ],
    },
    {
      id: 'kit', code: 'RCP-102', version: 'v1', name: 'Team Kit (jersey + shorts + socks)', product: 'Team Kit', outputQty: 1, unit: 'kits',
      route: ['Printing (paper)', 'Heat transfer', 'Cutting', 'Stitching', 'QC', 'Kit packing'],
      groups: [
        { id: 'design', name: 'Design', required: true, values: ['Home Blue', 'Away White', 'GK Green'] },
        { id: 'size',   name: 'Size',   required: true, values: SIZES.slice() },
      ],
      outputs: [
        { id: 'jersey', label: 'Jersey', product: 'Kit Jersey', follows: ['design', 'size'] },
        { id: 'shorts', label: 'Shorts', product: 'Kit Shorts', follows: ['design', 'size'] },
        { id: 'socks',  label: 'Socks',  product: 'Kit Socks',  follows: ['design', 'size'],
          map: { size: { YS: 'Youth', YM: 'Youth', YL: 'Youth', S: '39-42', M: '39-42', L: '43-46', XL: '43-46', '2XL': '43-46' } } },
      ],
      lines: [
        { id: 'jfab', output: 'jersey', label: 'Jersey fabric', material: 'fab-int', qty: 0.8, wastage: 4, dependsOn: ['size'], rules: by(SIZES, fabricShort) },
        { id: 'jpap', output: 'jersey', label: 'Jersey paper', material: 'pap', qty: 0.9, wastage: 5, dependsOn: ['size'], rules: by(SIZES, fabricShort.map(x => +(x * 1.1).toFixed(2))) },
        { id: 'jth', output: 'jersey', label: 'Jersey thread', material: 'th-white', qty: 160, wastage: 0, dependsOn: ['design'],
          rules: [{ when: { design: 'Home Blue' }, material: 'th-blue' }, { when: { design: 'Away White' }, material: 'th-white' }, { when: { design: 'GK Green' }, material: 'th-green' }] },
        { id: 'jlbl', output: 'jersey', label: 'Jersey size label', material: 'lbl-M', qty: 1, wastage: 0, dependsOn: ['size'], rules: SIZES.map(s => ({ when: { size: s }, material: 'lbl-' + s })) },
        { id: 'sfab', output: 'shorts', label: 'Shorts fabric', material: 'fab-short', qty: 0.45, wastage: 4, dependsOn: ['size'], rules: by(SIZES, [0.32, 0.35, 0.38, 0.45, 0.45, 0.52, 0.52, 0.58]) },
        { id: 'spap', output: 'shorts', label: 'Shorts paper', material: 'pap', qty: 0.5, wastage: 5, dependsOn: ['size'], rules: by(SIZES, [0.36, 0.39, 0.42, 0.5, 0.5, 0.57, 0.57, 0.64]) },
        { id: 'sel', output: 'shorts', label: 'Waistband elastic', material: 'elastic', qty: 0.75, wastage: 2, dependsOn: ['size'], rules: by(SIZES, [0.55, 0.6, 0.65, 0.72, 0.78, 0.84, 0.9, 0.96]) },
        { id: 'scord', output: 'shorts', label: 'Drawcord', material: 'cord', qty: 1.1, wastage: 0, dependsOn: [], rules: [] },
        { id: 'sock', output: 'socks', label: 'Sock blank', material: 'sock-a1', qty: 1, wastage: 0, dependsOn: ['size'],
          rules: [{ when: { size: 'YS' }, material: 'sock-y' }, { when: { size: 'YM' }, material: 'sock-y' }, { when: { size: 'YL' }, material: 'sock-y' },
                  { when: { size: 'L' }, material: 'sock-a2' }, { when: { size: 'XL' }, material: 'sock-a2' }, { when: { size: '2XL' }, material: 'sock-a2' }] },
        { id: 'sink', output: 'socks', label: 'Sock cuff print ink', material: 'ink', qty: 3, wastage: 0, dependsOn: [], rules: [] },
        { id: 'pack', label: 'Kit pack bag (whole kit)', material: 'kitpack', qty: 1, wastage: 0, dependsOn: [], rules: [] },
      ],
    },
    {
      id: 'bag', code: 'RCP-201', version: 'v1', name: 'Duffel Bag', product: 'Duffel Bag', outputQty: 1, unit: 'pcs',
      route: ['Cutting', 'Logo (print / embroidery)', 'Stitching', 'QC', 'Packing'],
      groups: [
        { id: 'colour', name: 'Colour', required: true,  values: ['Black', 'Navy', 'Red'] },
        { id: 'size',   name: 'Size',   required: true,  values: ['S 40L', 'M 55L', 'L 70L'] },
        { id: 'logo',   name: 'Logo',   required: false, values: ['Screen print', 'Embroidery'] },
      ],
      outputs: [{ id: 'main', label: 'Bag', product: 'Duffel Bag', follows: ['colour', 'size', 'logo'] }],
      lines: [
        { id: 'body', label: 'Body fabric', material: 'p600-black', qty: 1.4, wastage: 5, dependsOn: ['colour', 'size'],
          rules: [{ when: { colour: 'Black' }, material: 'p600-black' }, { when: { colour: 'Navy' }, material: 'p600-navy' }, { when: { colour: 'Red' }, material: 'p600-red' },
                  { when: { size: 'S 40L' }, qty: 1.1 }, { when: { size: 'L 70L' }, qty: 1.8 }] },
        { id: 'lin', label: 'Lining', material: 'lining', qty: 1.3, wastage: 5, dependsOn: ['size'], rules: [{ when: { size: 'S 40L' }, qty: 1.0 }, { when: { size: 'L 70L' }, qty: 1.6 }] },
        { id: 'pu', label: 'Base panel', material: 'pu-m', qty: 1, wastage: 0, dependsOn: ['size'],
          rules: [{ when: { size: 'S 40L' }, material: 'pu-s' }, { when: { size: 'M 55L' }, material: 'pu-m' }, { when: { size: 'L 70L' }, material: 'pu-l' }] },
        { id: 'zip', label: 'Main zip', material: 'zip-70', qty: 1, wastage: 0, dependsOn: ['size'],
          rules: [{ when: { size: 'S 40L' }, material: 'zip-60' }, { when: { size: 'M 55L' }, material: 'zip-70' }, { when: { size: 'L 70L' }, material: 'zip-80' }] },
        { id: 'web', label: 'Straps (webbing)', material: 'web-black', qty: 2.5, wastage: 2, dependsOn: ['colour', 'size'],
          rules: [{ when: { colour: 'Black' }, material: 'web-black' }, { when: { colour: 'Navy' }, material: 'web-navy' }, { when: { colour: 'Red' }, material: 'web-red' },
                  { when: { size: 'S 40L' }, qty: 2.2 }, { when: { size: 'L 70L' }, qty: 2.8 }] },
        { id: 'buckle', label: 'Buckles & D-rings', material: 'buckle', qty: 1, wastage: 0, dependsOn: [], rules: [] },
        { id: 'foam', label: 'Base foam', material: 'foam', qty: 0.3, wastage: 3, dependsOn: ['size'], rules: [{ when: { size: 'S 40L' }, qty: 0.2 }, { when: { size: 'L 70L' }, qty: 0.4 }] },
        { id: 'logo', label: 'Logo', material: '', qty: 0, wastage: 0, dependsOn: ['logo'],
          rules: [{ when: { logo: 'Screen print' }, material: 'scr', qty: 6 }, { when: { logo: 'Embroidery' }, material: 'emb', qty: 60 }] },
        { id: 'care', label: 'Care label', material: 'care', qty: 1, wastage: 0, dependsOn: [], rules: [] },
        { id: 'poly', label: 'Poly bag', material: 'poly', qty: 1, wastage: 0, dependsOn: [], rules: [] },
      ],
    },
  ];

  /* Products that already exist — "find" reuses these, the rest offer Create. */
  const products = ['Team Jersey', 'Team Kit', 'Duffel Bag', 'Kit Jersey', 'Kit Shorts', 'Kit Socks',
    'Team Jersey - Home Blue / M / Short / Round', 'Team Jersey - Home Blue / L / Short / Round',
    'Kit Jersey - Home Blue / M', 'Kit Shorts - Home Blue / M', 'Kit Socks - Home Blue / 39-42',
    'Duffel Bag - Black / M 55L / Embroidery'];

  /* ---- Team list for "Fill from team list" (invented players) -------------- */
  const roster = [
    'Ali Raza, 1, L', 'Hamza Tariq, 2, M', 'Bilal Ahmed, 3, M', 'Usman Ghani, 4, L', 'Saad Iqbal, 5, XL',
    'Danish Malik, 6, M', 'Zain Abbas, 7, S', 'Faizan Khan, 8, M', 'Talha Noor, 9, L', 'Arham Shah, 10, S',
    'Huzaifa Ali, 11, M', 'Ayaan Qureshi, 12, YL', 'Rayyan Butt, 13, YL', 'Shayan Mirza, 14, YM', 'Hassan Javed, 15, L',
    'Ibrahim Saeed, 16, 2XL', 'Moiz Haider, 17, M', 'Ahad Rehman, 18, S',
  ].join('\n');

  const demo = {
    company: 'Demo Sportswear (Pvt) Ltd', user: 'Sana K. (Planner)',
    orderNo: 'MO-2041', saleOrder: 'SO-1187 · Riverside FC', dueDate: '2026-12-15',
    orders: {
      jersey: {
        single: { qty: 50 },
        variation: { qty: 40, pick: { design: 'Home Blue', size: 'M', sleeve: 'Short', collar: 'Round', pers: 'Name + Number' } },
        grid: { rows: 'design', cols: 'size', split: ['sleeve', 'collar'], fixed: { pers: 'Name + Number' },
          blocks: [
            { id: 'b1', values: { sleeve: 'Short', collar: 'Round' },
              cells: { 'Home Blue|YM': 6, 'Home Blue|YL': 8, 'Home Blue|S': 10, 'Home Blue|M': 14, 'Home Blue|L': 12, 'Home Blue|XL': 6, 'Home Blue|2XL': 2,
                       'Away White|S': 8, 'Away White|M': 12, 'Away White|L': 10, 'Away White|XL': 4 } },
            { id: 'b2', values: { sleeve: 'Long', collar: 'Round' },
              cells: { 'GK Green|S': 2, 'GK Green|M': 3, 'GK Green|L': 2, 'GK Green|XL': 1 } },
          ] },
      },
      kit: {
        single: { qty: 20 },
        variation: { qty: 20, pick: { design: 'Home Blue', size: 'M' } },
        grid: { rows: 'design', cols: 'size', split: [], fixed: {},
          blocks: [{ id: 'b1', values: {}, cells: {} }] },     // filled from the team list in the demo
      },
      bag: {
        single: { qty: 100 },
        variation: { qty: 60, pick: { colour: 'Black', size: 'M 55L', logo: 'Embroidery' } },
        grid: { rows: 'colour', cols: 'size', split: [], fixed: { logo: 'Embroidery' },
          blocks: [{ id: 'b1', values: {}, cells: { 'Black|S 40L': 20, 'Black|M 55L': 40, 'Black|L 70L': 20, 'Navy|M 55L': 30, 'Navy|L 70L': 15, 'Red|M 55L': 15 } }] },
      },
    },
  };

  return { modules, settings, materials, recipes, products, roster, demo, company: demo.company, user: demo.user, brand: 'Tranzlo' };
})();
