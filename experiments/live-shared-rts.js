import fs from 'node:fs';
import assert from 'node:assert/strict';

import {
  applySharedRtsChatAction,
  createLiveSharedRts,
  liveSharedRtsView,
  revealCompletedSharedRts,
} from '../src/live-shared-rts.js';
import { replaySharedRts } from '../src/shared-rts.js';

const [command, filePath, argument] = process.argv.slice(2);

if (!command || !filePath) {
  printUsage();
  process.exitCode = 1;
} else if (command === 'new') {
  const live = createLiveSharedRts({
    sessionId: `floorborn-shared-rts-${Date.now()}`,
  });
  save(filePath, live);
  printView(live);
} else if (command === 'act') {
  if (!argument) throw new Error('act requires one legal RTS action id');
  const live = applySharedRtsChatAction(load(filePath), argument);
  save(filePath, live);
  printView(live);
} else if (command === 'show') {
  printView(load(filePath));
} else if (command === 'reveal') {
  console.log(JSON.stringify(revealCompletedSharedRts(load(filePath)), null, 2));
} else if (command === 'verify') {
  const completed = revealCompletedSharedRts(load(filePath));
  const replayed = replaySharedRts({
    sessionId: completed.sessionId,
    receipts: completed.receipts,
  });
  assert.deepEqual(replayed, completed.publicState);
  console.log('LIVE SHARED RTS REPLAY PASS');
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
  console.log(JSON.stringify(liveSharedRtsView(live), null, 2));
}

function printUsage() {
  console.error('Usage:');
  console.error('  npm run live-shared-rts -- new FILE');
  console.error('  npm run live-shared-rts -- show FILE');
  console.error('  npm run live-shared-rts -- act FILE ACTION_ID');
  console.error('  npm run live-shared-rts -- reveal FILE');
  console.error('  npm run live-shared-rts -- verify FILE');
}
