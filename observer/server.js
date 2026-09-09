import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  applyLiveContestedChatAction,
  createLiveContestedRts,
  liveContestedRtsView,
  revealCompletedLiveContestedRts,
} from '../src/live-contested-rts.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHAT_ID = 'chat-001';
const FLOOR_ID = 'floorborn-001';

export function createConsoleRuntime({ sessionId = 'floorborn-console-001' } = {}) {
  let live = createLiveContestedRts({ sessionId });

  return {
    view() {
      return present(live);
    },
    act(actionId) {
      if (typeof actionId !== 'string' || !actionId) throw new Error('actionId must be a non-empty string');
      const current = liveContestedRtsView(live);
      const legal = current.chatObservation?.legalActions?.some((action) => action.id === actionId);
      if (!legal) throw new Error('actionId is not legal in the current player-facing observation');
      live = applyLiveContestedChatAction(live, actionId);
      return present(live);
    },
    reset() {
      live = createLiveContestedRts({ sessionId });
      return present(live);
    },
  };
}

export async function startConsoleServer({
  port = 4317,
  host = '127.0.0.1',
  sessionId = 'floorborn-console-001',
} = {}) {
  const runtime = createConsoleRuntime({ sessionId });
  const server = http.createServer((request, response) => route(request, response, runtime));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  return server;
}

async function route(request, response, runtime) {
  try {
    if (request.method === 'GET' && request.url === '/api/view') {
      return json(response, 200, runtime.view());
    }
    if (request.method === 'POST' && request.url === '/api/action') {
      const body = await readJson(request);
      return json(response, 200, runtime.act(body.actionId));
    }
    if (request.method === 'POST' && request.url === '/api/reset') {
      await readJson(request);
      return json(response, 200, runtime.reset());
    }
    if (request.method === 'GET' && (request.url === '/' || request.url === '/index.html')) {
      return asset(response, 'index.html', 'text/html; charset=utf-8');
    }
    if (request.method === 'GET' && request.url === '/app.js') {
      return asset(response, 'app.js', 'text/javascript; charset=utf-8');
    }
    if (request.method === 'GET' && request.url === '/style.css') {
      return asset(response, 'style.css', 'text/css; charset=utf-8');
    }
    return json(response, 404, { error: 'not found' });
  } catch (error) {
    return json(response, 400, { error: error.message });
  }
}

async function asset(response, file, contentType) {
  const body = await readFile(path.join(HERE, file));
  response.writeHead(200, securityHeaders({ 'content-type': contentType }));
  response.end(body);
}

function present(live) {
  const playerView = liveContestedRtsView(live);
  const base = {
    schema: 'axm.floorborn.live-contested-console-view/v0.1',
    sessionId: live.sessionId,
    complete: playerView.complete,
    observation: playerView.chatObservation,
    legalActions: playerView.chatObservation?.legalActions ?? [],
    transcript: playerView.transcript,
    result: null,
    boundary: {
      authority: 'PLAYER_ACTION_ONLY',
      hostSnapshotExposed: false,
      floorbornDecisionTraceExposed: false,
      hiddenDoctrineExposed: false,
    },
  };

  if (!playerView.complete) return base;

  const completed = revealCompletedLiveContestedRts(live);
  const players = completed.publicState.players;
  const chatReceipts = completed.receipts.filter((receipt) => receipt.playerId === CHAT_ID);
  const floorReceipts = completed.receipts.filter((receipt) => receipt.playerId === FLOOR_ID);
  return {
    ...base,
    result: {
      winnerPlayerId: completed.publicState.winnerPlayerId,
      chatControl: players[CHAT_ID].controlPoints,
      floorbornControl: players[FLOOR_ID].controlPoints,
      chatAgencySpent: chatReceipts.reduce((sum, receipt) => sum + receipt.effectiveCost, 0),
      floorbornAgencySpent: floorReceipts.reduce((sum, receipt) => sum + receipt.effectiveCost, 0),
      replayVerified: JSON.stringify(completed.publicState) === JSON.stringify(completed.replayedPublicState),
    },
  };
}

async function readJson(request) {
  let text = '';
  for await (const chunk of request) {
    text += chunk;
    if (text.length > 8192) throw new Error('request body too large');
  }
  if (!text) return {};
  const value = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON object required');
  return value;
}

function json(response, status, body) {
  response.writeHead(status, securityHeaders({ 'content-type': 'application/json; charset=utf-8' }));
  response.end(JSON.stringify(body));
}

function securityHeaders(extra = {}) {
  return {
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; font-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    ...extra,
  };
}

const direct = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (direct) {
  const sessionId = process.argv[2] || 'floorborn-console-001';
  const server = await startConsoleServer({ sessionId });
  const address = server.address();
  console.log(`Floorborn Live Contested Console: http://127.0.0.1:${address.port}/`);
  console.log(`Session: ${sessionId} · loopback only · no account · no network dependency`);
}
