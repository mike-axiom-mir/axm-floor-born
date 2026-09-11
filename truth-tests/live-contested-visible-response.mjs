import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'playwright';
import { startConsoleServer } from '../observer/server.js';

const artifactDir = path.resolve('artifacts/live-contested-visible-response');
await mkdir(artifactDir, { recursive: true });

const server = await startConsoleServer({ port: 0, sessionId: 'visible-response-proof-001' });
const address = server.address();
const url = `http://127.0.0.1:${address.port}/`;
const browser = await chromium.launch({ headless: true });
const pageErrors = [];
const consoleErrors = [];
const failedRequests = [];

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('sessionStatus')?.textContent !== 'CONNECTING');
  await page.waitForFunction(() => document.getElementById('responseSummary')?.dataset.mode === 'ready');

  const initial = await page.evaluate(() => ({
    budget: document.getElementById('budgetState').textContent.trim(),
    control: document.getElementById('controlState').textContent.trim(),
    transcriptCount: document.querySelectorAll('#transcript li').length,
    bodyWidth: document.body.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  assert.equal(initial.bodyWidth, initial.viewportWidth, 'desktop console must not overflow horizontally');

  const scout = page.locator('button[data-action-id="command:scout:center"]');
  assert.equal(await scout.count(), 1, 'opening player door must expose command:scout:center');
  await scout.click();

  await page.waitForFunction(() => document.getElementById('responseSummary')?.dataset.mode === 'changed');
  const after = await page.evaluate(() => ({
    budget: document.getElementById('budgetState').textContent.trim(),
    control: document.getElementById('controlState').textContent.trim(),
    transcriptCount: document.querySelectorAll('#transcript li').length,
    markedConsequences: document.querySelectorAll('#transcript li[data-observed-change="consequence"]').length,
    markedOwnUnits: document.querySelectorAll('#ownGroups .unit[data-observed-change="unit"]').length,
    markedStatuses: document.querySelectorAll('.status-rail strong[data-observed-change="status"]').length,
    summary: document.getElementById('responseSummary').textContent.trim(),
    feedback: document.getElementById('feedback').textContent.trim(),
  }));

  assert.notEqual(after.budget, initial.budget, 'real command must visibly change the player action budget');
  assert.ok(after.transcriptCount > initial.transcriptCount, 'real command must append public consequence entries');
  assert.equal(after.markedConsequences, after.transcriptCount - initial.transcriptCount, 'every newly appended public consequence must be marked');
  assert.ok(after.markedOwnUnits >= 1, 'the moved scout must be visibly marked as an updated own group');
  assert.ok(after.markedStatuses >= 1, 'changed player-visible status must be marked');
  assert.match(after.summary, /^VISIBLE RESPONSE · /, 'summary must announce a visible response');
  assert.match(after.summary, /new public consequence/, 'summary must name new public consequence evidence');
  assert.match(after.summary, /Presentation only; game truth is unchanged by these markers\.$/, 'summary must state its non-authority boundary');
  assert.equal(after.feedback, 'Committed Scout Center → Center. Floorborn response and world consequence are now reflected below.', 'existing command feedback must remain intact');

  await page.screenshot({ path: path.join(artifactDir, 'visible-response-desktop.png'), fullPage: true });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reducedAnimation = await page.locator('#transcript li[data-observed-change="consequence"]').first().evaluate((element) => getComputedStyle(element).animationName);
  assert.equal(reducedAnimation, 'none', 'reduced-motion must remove the response animation while retaining static markers');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(50);
  const mobile = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    summary: document.getElementById('responseSummary').textContent.trim(),
    markedConsequences: document.querySelectorAll('#transcript li[data-observed-change="consequence"]').length,
  }));
  assert.equal(mobile.bodyWidth, mobile.viewportWidth, '390px console must not overflow horizontally');
  assert.match(mobile.summary, /^VISIBLE RESPONSE · /, 'visible response summary must remain present at mobile width');
  assert.ok(mobile.markedConsequences >= 1, 'mobile realization must retain consequence markers');
  await page.screenshot({ path: path.join(artifactDir, 'visible-response-mobile.png'), fullPage: true });

  assert.deepEqual(pageErrors, [], 'real page must have no page errors');
  assert.deepEqual(consoleErrors, [], 'real page must have no console errors');
  assert.deepEqual(failedRequests, [], 'real page must have no failed requests');

  const evidence = {
    schema: 'axm.floorborn.visible-response-browser-evidence/v0.1',
    authority: 'PRESENTATION_ONLY',
    canonicalStateChangedByMarkers: false,
    actualLoopbackServer: true,
    actualContestedRuntime: true,
    command: 'command:scout:center',
    initial,
    after,
    mobile,
    reducedMotionAnimationName: reducedAnimation,
    pageErrors,
    consoleErrors,
    failedRequests,
  };
  await writeFile(path.join(artifactDir, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));

  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
