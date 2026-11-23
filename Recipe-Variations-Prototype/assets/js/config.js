/* ==========================================================================
   config.js — SINGLE SOURCE OF TRUTH for the redesigned production workflow.
   Routes, per-step rules, settings and vocabulary live here; nothing in the
   HTML or the simulator knows a step name. At implementation time this file
   becomes: ProductionRoute / ProductionRouteStep rows (with the new rule
   columns), the PROD settings, and the enum values.
   ========================================================================== */
window.CFG = (function () {

  /* ---- Settings (each becomes a PROD SettingEnum key) ------------------- */
  const settings = {
    // Strict: a step may only take in what the previous step SENT it.
    // Relaxed: steps may overlap; the chain still reconciles at Complete.
    stepSequence: 'strict',            // 'strict' | 'relaxed'
    // A rejected quantity must say why.
    rejectReasonRequired: true,
    // Start/Stop must bracket work: output cannot be recorded while a step has no open run.
    requireRunForOutput: true,
    // Complete may book finished goods before every piece has reached the last step.
    allowPartialComplete: true,
    // Over-production tolerance on the FIRST step's output vs the order's planned qty (%).
    overProductionTolerancePct: 5,
  };

  /* ---- Vocabulary (labels only — the engine keys off the keys) ----------- */
  const qtyChangeRules = [
    { v: 'none',     t: 'Fixed',      d: 'Pieces out must equal pieces in. No loss, no gain.' },
    { v: 'reduce',   t: 'May reduce', d: 'Pieces can be rejected here (damage, QC fail).' },
    { v: 'increase', t: 'May increase', d: 'Pieces can be gained here (one panel cut into two, a re-count).' },
    { v: 'both',     t: 'May reduce or increase', d: 'Both rejects and gains are allowed.' },
  ];

  const stepStatuses = [
    { v: 'pending',  t: 'Pending',  cls: 'pending'  },   // nothing received yet
    { v: 'idle',     t: 'Idle',     cls: 'info'     },   // has pieces, no run open
    { v: 'running',  t: 'Running',  cls: 'approved' },   // a run is open (Start pressed)
    { v: 'done',     t: 'Done',     cls: 'posted'   },   // everything received has left the step
    { v: 'skipped',  t: 'Skipped',  cls: 'draft'    },
  ];

  const rejectReasons = [
    'Cutting damage', 'Fabric fault', 'Print smudge', 'Embroidery misaligned',
    'Stitch fault', 'Measurement out of spec', 'Stain / iron mark', 'Other',
  ];

  /* ---- Routes ------------------------------------------------------------
     One route per product family. Every step carries the SAME rule columns:
       qtyChange      what may happen to the count at this step (see above)
       partialSend    may pieces leave for the next step before all are done
       optional       may an order skip this step (plain jersey: no embroidery)
       inspection     rejects are expected here; reason required
       workCentre     default machine / line for the run
       yieldPct       planned share that passes (reporting)
     Step codes are the stable handles material / cost lines point at.       */
  const routes = [
    {
      id: 'rt-sub', code: 'GAR-SUB', name: 'Garments — sublimation jersey',
      steps: [
        { code: 'CUT',    name: 'Cutting',         workCentre: 'Cutting table 1', qtyChange: 'both',    partialSend: true,  optional: false, inspection: false, yieldPct: 100,
          help: 'Fabric rolls in, panels out. "May increase" because the count is established here — one roll may yield more panels than planned.' },
        { code: 'SUB',    name: 'Sublimation',     workCentre: 'Sublimation press', qtyChange: 'reduce', partialSend: true,  optional: false, inspection: false, yieldPct: 98 },
        { code: 'PRINT',  name: 'Printing',        workCentre: 'Print line A',    qtyChange: 'reduce',   partialSend: true,  optional: true,  inspection: false, yieldPct: 99 },
        { code: 'RECUT',  name: 'Re-cutting',      workCentre: 'Cutting table 2', qtyChange: 'reduce',   partialSend: true,  optional: false, inspection: false, yieldPct: 100,
          help: 'Trimming the printed panels to final shape.' },
        { code: 'BUNDLE', name: 'Bundling',        workCentre: 'Bundling bench',  qtyChange: 'none',     partialSend: true,  optional: false, inspection: false, yieldPct: 100,
          help: '"Fixed": bundling neither loses nor gains pieces — a count mismatch here is a mistake to catch, not a loss to record.' },
        { code: 'STITCH', name: 'Stitching',       workCentre: 'Stitching line 1', qtyChange: 'reduce',  partialSend: true,  optional: false, inspection: false, yieldPct: 98 },
        { code: 'QC',     name: 'Quality check',   workCentre: 'QC bench',        qtyChange: 'reduce',   partialSend: true,  optional: false, inspection: true,  yieldPct: 97 },
        { code: 'IRON',   name: 'Pressing / iron', workCentre: 'Iron station',    qtyChange: 'reduce',   partialSend: true,  optional: false, inspection: false, yieldPct: 100 },
        { code: 'PACK',   name: 'Packing',         workCentre: 'Packing bench',   qtyChange: 'none',     partialSend: true,  optional: false, inspection: false, yieldPct: 100, packSize: 12 },
      ],
    },
    {
      id: 'rt-emb', code: 'GAR-EMB', name: 'Garments — embroidered polo',
      steps: [
        { code: 'CUT',    name: 'Cutting',         workCentre: 'Cutting table 1', qtyChange: 'both',   partialSend: true, optional: false, inspection: false, yieldPct: 100 },
        { code: 'EMB',    name: 'Embroidery',      workCentre: 'Embroidery M2',   qtyChange: 'reduce', partialSend: true, optional: false, inspection: false, yieldPct: 98 },
        { code: 'BUNDLE', name: 'Bundling',        workCentre: 'Bundling bench',  qtyChange: 'none',   partialSend: true, optional: false, inspection: false, yieldPct: 100 },
        { code: 'STITCH', name: 'Stitching',       workCentre: 'Stitching line 2', qtyChange: 'reduce', partialSend: true, optional: false, inspection: false, yieldPct: 98 },
        { code: 'QC',     name: 'Quality check',   workCentre: 'QC bench',        qtyChange: 'reduce', partialSend: true, optional: false, inspection: true,  yieldPct: 97 },
        { code: 'PACK',   name: 'Packing',         workCentre: 'Packing bench',   qtyChange: 'none',   partialSend: true, optional: false, inspection: false, yieldPct: 100, packSize: 6 },
      ],
    },
  ];

  /* ---- Order lifecycle (unchanged by this round — shown for context) ----- */
  const orderStatuses = ['Draft', 'Released', 'Stock requested', 'At machine', 'In progress', 'Partially completed', 'Completed', 'Closed'];

  /* ---- Module rail (the kit's default set has no PROD entry) ------------- */
  const modules = [
    ['\u{1F3E0}', '', 'home'], ['\u2B50', '', 'fav'], ['\u{1F4E6}', 'IMS'], ['\u{1F6D2}', 'PMS'],
    ['\u{1F4CA}', 'SMS'], ['\u{1F3ED}', 'PROD'], ['\u{1F9FE}', 'FAS'], ['\u{1F465}', 'HRM'],
  ];

  return { settings, qtyChangeRules, stepStatuses, rejectReasons, routes, orderStatuses, modules };
})();
