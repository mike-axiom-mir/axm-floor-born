import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

import { chromium } from 'playwright';

import { startConsoleServer } from '../observer/server.js';

const HIDDEN_FIELDS = [
  'floorborn',
  'snapshot',
  'floorbornDecisionReceipts',
  'hiddenDoctrineByPlayer',
];

function assertPlayerBoundary(view) {
  assert.deepEqual(view.boundary, {
    authority: 'PLAYER_ACTION_ONLY',
    hostSnapshotExposed: false,
    floorbornDecisionTraceExposed: false,
    hiddenDoctrineExposed: false,
  });
  for (const field of HIDDEN_FIELDS) {
    assert.equal(Object.hasOwn(view, field), false, `${field} must not cross the player-facing boundary`);
  }
}

async function readView(page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/view', { cache: 'no-store' });
    if (!response.ok) throw new Error(`view failed (${response.status})`);
    return response.json();
  });
}

async function main() {
  await mkdir('artifacts', { recursive: true });

  const server = await startConsoleServer({
    port: 0,
    host: '127.0.0.1',
    sessionId: 'browser-truth-001',
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  try {
    const response = await page.goto(origin, { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200);
    await page.waitForFunction(() => {
      const status = document.getElementById('sessionStatus')?.textContent;
      const actions = document.querySelectorAll('#actions button.action').length;
      return status === 'YOUR TURN' && actions > 0;
    });

    const initial = await readView(page);
    assert.equal(initial.schema, 'axm.floorborn.live-contested-console-view/v0.1');
    assert.equal(initial.complete, false);
    assert.equal(initial.observation?.self?.playerId, 'chat-001');
    assert.ok(Array.isArray(initial.legalActions) && initial.legalActions.length > 0);
    assertPlayerBoundary(initial);

    const selectedIndex = Math.max(
      0,
      initial.legalActions.findIndex((action) => Number(action.effectiveCost) > 0),
    );
    const selected = initial.legalActions[selectedIndex];
    const actionButtons = page.locator('#actions button.action');
    assert.equal(await actionButtons.count(), initial.legalActions.length);
    await actionButtons.nth(selectedIndex).click();
    await page.waitForFunction(() => document.getElementById('feedback')?.textContent?.startsWith('Committed '));

    const afterAction = await readView(page);
    assert.ok(afterAction.transcript.length > initial.transcript.length);
    assertPlayerBoundary(afterAction);

    const beforeRejected = structuredClone(afterAction);
    const rejectedStatus = await page.evaluate(async () => {
      const response = await fetch('/api/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ actionId: 'hidden-admin-action' }),
      });
      await response.text();
      return response.status;
    });
    assert.equal(rejectedStatus, 400);
    const afterRejected = await readView(page);
    assert.deepEqual(afterRejected, beforeRejected, 'rejected hidden action must not mutate player-visible state');

    await page.screenshot({ path: 'artifacts/live-contested-console-desktop.png', fullPage: true });

    await page.locator('#resetButton').click();
    await page.waitForFunction(() => document.getElementById('feedback')?.textContent?.includes('deterministic opening state'));
    const reset = await readView(page);
    assert.deepEqual(reset, initial, 'reset must restore the exact opening player-facing view');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.querySelectorAll('#actions button.action').length > 0);
    const mobileGeometry = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      actionCount: document.querySelectorAll('#actions button.action').length,
      status: document.getElementById('sessionStatus')?.textContent,
    }));
    assert.ok(mobileGeometry.scrollWidth <= mobileGeometry.innerWidth, JSON.stringify(mobileGeometry));
    assert.ok(mobileGeometry.actionCount > 0);
    assert.equal(mobileGeometry.status, 'YOUR TURN');
    await page.screenshot({ path: 'artifacts/live-contested-console-mobile.png', fullPage: true });

    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, []);

    console.log(JSON.stringify({
      schema: 'axm.floorborn.live-contested-console-browser-evidence/v0.1',
      browser: browser.version(),
      origin: 'loopback-ephemeral',
      realServer: true,
      realContestedRuntime: true,
      initialLegalActions: initial.legalActions.length,
      exercisedActionId: selected.id,
      transcriptBefore: initial.transcript.length,
      transcriptAfter: afterAction.transcript.length,
      hiddenActionStatus: rejectedStatus,
      rejectedActionStateHeld: true,
      resetExact: true,
      mobileNoHorizontalOverflow: true,
      pageErrors,
      consoleErrors,
      boundary: initial.boundary,
      authority: 'EVIDENCE_ONLY_NO_MERGE_NO_CANON',
    }, null, 2));
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
