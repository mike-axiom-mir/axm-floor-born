import fs from 'node:fs';
import path from 'node:path';

import { applyChatAction, createLiveCoop, liveView } from '../src/live-coop.js';

const [command = 'help', statePathArg, actionId] = process.argv.slice(2);
const statePath = statePathArg ? path.resolve(statePathArg) : path.resolve('.floorborn-live-coop.json');

if (command === 'new') {
  const live = createLiveCoop({ sessionId: `floorborn-chat-${Date.now()}` });
  save(statePath, live);
  printView(statePath, liveView(live));
} else if (command === 'act') {
  if (!actionId) fail('usage: npm run live -- act <state-file> <legal-action-id>');
  const current = load(statePath);
  const live = applyChatAction(current, actionId);
  save(statePath, live);
  printView(statePath, liveView(live));
} else if (command === 'show') {
  printView(statePath, liveView(load(statePath)));
} else {
  console.log('Floorborn live co-op bridge');
  console.log('  npm run live -- new <state-file>');
  console.log('  npm run live -- show <state-file>');
  console.log('  npm run live -- act <state-file> <legal-action-id>');
}

function printView(file, view) {
  console.log(`STATE ${file}`);
  for (const entry of view.transcript.slice(-2)) {
    console.log(`${entry.actor.toUpperCase()} turn ${entry.turn}: ${entry.actionId} -> ${entry.description}`);
  }

  if (view.complete) {
    console.log('MISSION COMPLETE: Twinseal Gate is open.');
    console.log(JSON.stringify(view.publicState, null, 2));
    return;
  }

  const observation = view.chatObservation;
  console.log(`\nCHAT TURN ${observation.turn}`);
  console.log(`Location: ${observation.place.label} (${observation.place.id})`);
  console.log(`Inventory: ${observation.self.inventory.join(', ') || '(empty)'}`);
  console.log(`Floorborn: ${observation.party.peer.placeId}; inventory ${observation.party.peer.inventory.join(', ') || '(empty)'}`);
  console.log(`Objective: ${observation.party.objective}`);
  console.log(`Shard status: sun=${observation.party.shardStatus.sun}, moon=${observation.party.shardStatus.moon}`);
  console.log('Legal actions:');
  for (const action of observation.legalActions) {
    const target = action.target ? ` -> ${action.target}` : '';
    console.log(`  ${action.id} [${action.kind}]${target}`);
  }
}

function load(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function save(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
  throw new Error(message);
}
