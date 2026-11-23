/* ==========================================================================
   demo-data.js — the ONE synthetic order every page uses. All invented.
   ========================================================================== */
window.DEMO = {
  company: 'Demo Garments (Pvt) Ltd',
  user: 'Ali R. (Planner)',
  order: {
    no: 'PO-214',
    date: '2026-09-10',
    product: 'Sublimation sports jersey — Medium',
    recipe: 'Jersey M · v3',
    routeId: 'rt-sub',
    plannedQty: 100,
    saleOrder: 'SO-2031 · Ali Traders',
    machine: 'Sublimation press',
    status: 'In progress',
  },
  /* The story the user told, as a script the simulator can play (see order-app.js):
     cut 50 → send 50 → sublimate 50 → cut the other 50 → send → sublimate 50 → send all 100 → …
     with 2 lost at sublimation and 3 more at QC. */
  script: [
    // Printing is optional on this route and the jersey needs none — skipped BEFORE any piece
    // reaches it (a step that already holds pieces can no longer be skipped).
    ['skip',   'PRINT'],
    ['start',  'CUT'],
    ['output', 'CUT',    { done: 50 }],
    ['send',   'CUT',    50],
    ['stop',   'CUT'],
    ['start',  'SUB'],
    ['output', 'SUB',    { done: 48, rejected: 2, reason: 'Print smudge' }],
    ['start',  'CUT'],
    ['output', 'CUT',    { done: 50 }],
    ['send',   'CUT',    50],
    ['stop',   'CUT'],
    ['output', 'SUB',    { done: 50 }],
    ['send',   'SUB',    98],
    ['stop',   'SUB'],
    ['start',  'RECUT'], ['output', 'RECUT', { done: 98 }], ['send', 'RECUT', 98], ['stop', 'RECUT'],
    ['start',  'BUNDLE'], ['output', 'BUNDLE', { done: 98 }], ['send', 'BUNDLE', 98], ['stop', 'BUNDLE'],
    ['start',  'STITCH'], ['output', 'STITCH', { done: 60 }], ['send', 'STITCH', 60],
    ['start',  'QC'], ['output', 'QC', { done: 58, rejected: 2, reason: 'Stitch fault' }], ['send', 'QC', 58], ['stop', 'QC'],
    ['start',  'IRON'], ['output', 'IRON', { done: 58 }], ['send', 'IRON', 58], ['stop', 'IRON'],
    ['start',  'PACK'], ['output', 'PACK', { done: 58 }], ['stop', 'PACK'],
    ['complete', 58],
  ],
};
