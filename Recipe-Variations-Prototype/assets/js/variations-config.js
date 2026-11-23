/* ==========================================================================
   variations-config.js — recipe variation groups + the three order modes.
   Everything domain-specific for variations.html lives HERE. At build time:
     groups / lines        → ProductionRecipeGroup / ProductionRecipeLine + ProductionRecipeLineRule
     settings.modes        → company setting "Production order modes"
     products              → existing ChartOfAccounts products (find-or-create)
   All names and rates are invented demonstration data.
   ========================================================================== */
window.CFG = window.CFG || {};
CFG.var = {
  settings: {
    // Which order modes the company allows. A mode switched off shows a disabled button that says why.
    modes: { single: true, variation: true, grid: true },
    defaultMode: 'grid',
    maxOutputLines: 300,          // company setting: an order never explodes into thousands of lines
  },

  // Raw-material catalogue (would be the product LOV). Rate = current average cost.
  materials: [
    { id: 'pq-red',   name: 'Pique Fabric - Red',   unit: 'm',   rate: 520 },
    { id: 'pq-navy',  name: 'Pique Fabric - Navy',  unit: 'm',   rate: 540 },
    { id: 'pq-white', name: 'Pique Fabric - White', unit: 'm',   rate: 500 },
    { id: 'th-red',   name: 'Sewing Thread - Red',  unit: 'm',   rate: 0.08 },
    { id: 'th-navy',  name: 'Sewing Thread - Navy', unit: 'm',   rate: 0.08 },
    { id: 'th-white', name: 'Sewing Thread - White',unit: 'm',   rate: 0.07 },
    { id: 'th-black', name: 'Contrast Thread - Black', unit: 'm', rate: 0.12 },
    { id: 'th-gold',  name: 'Contrast Thread - Gold',  unit: 'm', rate: 0.25 },
    { id: 'btn-15',   name: 'Button 15 mm',         unit: 'pcs', rate: 2.5 },
    { id: 'lbl-s',    name: 'Size Label - S',       unit: 'pcs', rate: 1.2 },
    { id: 'lbl-m',    name: 'Size Label - M',       unit: 'pcs', rate: 1.2 },
    { id: 'lbl-l',    name: 'Size Label - L',       unit: 'pcs', rate: 1.2 },
    { id: 'lbl-xl',   name: 'Size Label - XL',      unit: 'pcs', rate: 1.2 },
    { id: 'bag-s',    name: 'Poly Bag - Small',     unit: 'pcs', rate: 3 },
    { id: 'bag-l',    name: 'Poly Bag - Large',     unit: 'pcs', rate: 4 },
    { id: 'care',     name: 'Care Label',           unit: 'pcs', rate: 1 },
    { id: 'rib-red',   name: 'Cuff Rib - Red',      unit: 'pcs', rate: 6 },
    { id: 'rib-navy',  name: 'Cuff Rib - Navy',     unit: 'pcs', rate: 6 },
    { id: 'rib-white', name: 'Cuff Rib - White',    unit: 'pcs', rate: 5.5 },
  ],

  recipe: {
    code: 'RCP-031', version: 'v1', product: 'Polo Shirt', outputQty: 1, unit: 'pcs',
    // Open groups: any name, any values, required or optional. Values are typed — no product needed.
    groups: [
      { id: 'colour',   name: 'Colour',          required: true,  values: ['Red', 'Navy', 'White'] },
      { id: 'size',     name: 'Size',            required: true,  values: ['S', 'M', 'L', 'XL'] },
      { id: 'fit',      name: 'Fit',             required: false, values: ['Slim', 'Regular'] },
      { id: 'sleeve',   name: 'Sleeve',          required: false, values: ['Half', 'Full'] },
      { id: 'contrast', name: 'Contrast thread', required: false, values: ['Black', 'Gold'] },
    ],
    // Each line: a default material + qty, the groups it DEPENDS ON (any number), and RULES.
    // A rule names values for some of those groups (missing = "Any") and sets a material and/or a qty.
    // For each field the most specific matching rule wins (most named groups); a tie → the upper row.
    lines: [
      { id: 'fabric', label: 'Body fabric', material: 'pq-red', qty: 1.4, wastage: 3,
        dependsOn: ['colour', 'size', 'fit', 'sleeve'],
        rules: [
          { when: { colour: 'Red' },   material: 'pq-red' },
          { when: { colour: 'Navy' },  material: 'pq-navy' },
          { when: { colour: 'White' }, material: 'pq-white' },
          { when: { size: 'S' },  qty: 1.2 }, { when: { size: 'M' },  qty: 1.4 },
          { when: { size: 'L' },  qty: 1.6 }, { when: { size: 'XL' }, qty: 1.8 },
          { when: { size: 'S', fit: 'Slim' }, qty: 1.15 }, { when: { size: 'M', fit: 'Slim' }, qty: 1.3 },
          { when: { size: 'L', fit: 'Slim' }, qty: 1.45 }, { when: { size: 'XL', fit: 'Slim' }, qty: 1.6 },
          { when: { size: 'M', sleeve: 'Full' }, qty: 1.55 },
          { when: { size: 'M', fit: 'Slim', sleeve: 'Full' }, qty: 1.45 },
        ] },
      { id: 'cuff', label: 'Cuff rib (full sleeve only)', material: '', qty: 2, wastage: 0,
        dependsOn: ['colour', 'sleeve'],
        rules: [
          { when: { colour: 'Red', sleeve: 'Full' },   material: 'rib-red' },
          { when: { colour: 'Navy', sleeve: 'Full' },  material: 'rib-navy' },
          { when: { colour: 'White', sleeve: 'Full' }, material: 'rib-white' },
        ] },
      { id: 'thread', label: 'Sewing thread', material: 'th-white', qty: 120, wastage: 0,
        dependsOn: ['colour', 'size'],
        rules: [
          { when: { colour: 'Red' }, material: 'th-red' }, { when: { colour: 'Navy' }, material: 'th-navy' },
          { when: { colour: 'White' }, material: 'th-white' },
          { when: { size: 'S' }, qty: 110 }, { when: { size: 'L' }, qty: 130 }, { when: { size: 'XL' }, qty: 140 },
        ] },
      { id: 'button', label: 'Buttons', material: 'btn-15', qty: 3, wastage: 0, dependsOn: [], rules: [] },
      { id: 'sizelabel', label: 'Size label', material: 'lbl-m', qty: 1, wastage: 0, dependsOn: ['size'],
        rules: [{ when: { size: 'S' }, material: 'lbl-s' }, { when: { size: 'M' }, material: 'lbl-m' },
                { when: { size: 'L' }, material: 'lbl-l' }, { when: { size: 'XL' }, material: 'lbl-xl' }] },
      { id: 'contrast', label: 'Contrast thread', material: '', qty: 20, wastage: 0, dependsOn: ['contrast'],
        rules: [{ when: { contrast: 'Black' }, material: 'th-black' }, { when: { contrast: 'Gold' }, material: 'th-gold' }] },
      { id: 'polybag', label: 'Poly bag', material: 'bag-s', qty: 1, wastage: 0, dependsOn: ['size'],
        rules: [{ when: { size: 'L' }, material: 'bag-l' }, { when: { size: 'XL' }, material: 'bag-l' }] },
      { id: 'care', label: 'Care label', material: 'care', qty: 1, wastage: 0, dependsOn: [], rules: [] },
    ],
  },

  // Products that already exist — "find" hits these, everything else offers "Create".
  products: ['Polo Shirt', 'Polo Shirt - Red / M / Regular / Half', 'Polo Shirt - Navy / L / Regular / Half'],

  demo: {
    orderNo: 'MO-120', saleOrder: 'SO-050 · Buyer X',
    single:    { qty: 100 },
    variation: { qty: 100, pick: { colour: 'Red', size: 'M', fit: 'Regular', sleeve: 'Half' } },
    grid: {
      rows: 'colour', cols: 'size', split: ['fit', 'sleeve'], fixed: {},
      blocks: [
        { id: 'b1', values: { fit: 'Regular', sleeve: 'Half' },
          cells: { 'Red|S': 50, 'Red|M': 100, 'Red|L': 50, 'Navy|S': 75, 'Navy|M': 150, 'Navy|L': 75 } },
        { id: 'b2', values: { fit: 'Slim', sleeve: 'Full' },
          cells: { 'Red|S': 20, 'Red|M': 40, 'Red|L': 20, 'Navy|M': 30 } },
      ],
    },
  },
};
