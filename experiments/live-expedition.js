import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';

import {
  applyExpeditionChatAction,
  createLiveExpedition,
  liveExpeditionView,
  revealCompletedExpedition,
} from '../src/live-expedition.js';
import { replayExpedition } from '../src/expedition-rpg.js';

const [command, filePath, argument] = process.argv.slice(2);

if (!command || !filePath) {
  printUsage();
  process.exitCode = 1;
} else if (command === 'new') {
  const seed = argument === undefined ? randomInt(0, 1_000_000) : Number(argument);
  if (!Number.isInteger(seed)) throw new Error('seed must be an integer');
  const live = createLiveExpedition({
    sessionId: `floorborn-expedition-${Date.now()}`,
    seed,
  });
  save(filePath, live);
  printView(live);
} else if (command === 'act') {
  if (!argument) throw new Error('act requires one legal action id');
  const live = applyExpeditionChatAction(load(filePath), argument);
  save(filePath, live);
  printView(live);
} else if (command === 'show') {
  printView(load(filePath));
} else if (command === 'reveal') {
  console.log(JSON.stringify(revealCompletedExpedition(load(filePath)), null, 2));
} else if (command === 'verify') {
  const completed = revealCompletedExpedition(load(filePath));
  const replayed = replayExpedition({
    sessionId: completed.sessionId,
    seed: completed.seed,
    playerIds: ['floorborn-001', 'chat-001'],
    receipts: completed.receipts,
  });
  assert.deepEqual(replayed, completed.publicState);
  console.log('LIVE EXPEDITION REPLAY PASS');
} else {
  printUsage();
  process.exitCode = 1;
}

function load(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function save(path, value) {
  fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function printView(live) {
  const view = liveExpeditionView(live);
  console.log(JSON.stringify(view, null, 2));
}

function printUsage() {
  console.error('Usage:');
  console.error('  npm run live-expedition -- new FILE [SEED]');
  console.error('  npm run live-expedition -- show FILE');
  console.error('  npm run live-expedition -- act FILE ACTION_ID');
  console.error('  npm run live-expedition -- reveal FILE');
  console.error('  npm run live-expedition -- verify FILE');
}
