// SPDX-License-Identifier: GPL-3.0-or-later
'use strict';
/* fork (wakare): how long each step of making a card takes, so "the card took minutes" can be traced to one step.
   One JSON line per card in logs/card-timing.log: steps in order as [name, ms since the previous step], the total,
   and later lines for work that finishes after the card is saved (vocal separation). */
const path = require('node:path'), logSink = require('../core/log-sink.cjs');
function write(root, entry) {
  try { logSink.append(path.join(root, 'logs', 'card-timing.log'), JSON.stringify(entry) + '\n'); } catch {}
}
function start(root, info = {}) {
  const t0 = Date.now(), at = new Date(t0).toISOString(), steps = [];
  let last = t0, finished = false;
  return {
    info,
    step(name) { const now = Date.now(); steps.push([name, now - last]); last = now; },
    done(extra = {}) {
      if (finished) return; finished = true;
      write(root, { at, type: 'card', ...info, ...extra, totalMs: Date.now() - t0, steps });
    },
    later(name, extra = {}) { write(root, { at, type: 'cardLater', ...info, step: name, ...extra, sinceStartMs: Date.now() - t0 }); }
  };
}
function once(root, type, ms, extra = {}) { write(root, { at: new Date().toISOString(), type, ms, ...extra }); }
module.exports = { start, once };
