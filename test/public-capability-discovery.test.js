import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildArtifacts,
  checkArtifacts,
  writeArtifacts,
} from '../tools/generate-public-capabilities.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'floorborn-discovery-'));
  fs.mkdirSync(path.join(root, '.axm'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(root, 'package.json'));
  fs.copyFileSync(path.join(ROOT, 'LICENSE'), path.join(root, 'LICENSE'));
  fs.copyFileSync(path.join(ROOT, '.axm', 'discovery-public.json'), path.join(root, '.axm', 'discovery-public.json'));
  fs.cpSync(path.join(ROOT, 'src'), path.join(root, 'src'), { recursive: true });
  return root;
}

test('committed public capability registry exactly matches executable source', async () => {
  const result = await checkArtifacts(ROOT);
  assert.equal(result.ok, true, result.mismatches.join(', '));
});

test('package offline/status drift fails closed', async (t) => {
  for (const mutate of [
    (document) => { document.capability.offline = false; },
    (document) => { document.capability.status = 'WORKING'; },
  ]) {
    const root = fixture();
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const packagePath = path.join(root, 'package.json');
    const document = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    mutate(document);
    fs.writeFileSync(packagePath, `${JSON.stringify(document, null, 2)}\n`);
    await assert.rejects(() => buildArtifacts(root));
  }
});

test('source symlink substitution fails closed', async (t) => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const packagePath = path.join(root, 'package.json');
  fs.unlinkSync(packagePath);
  fs.symlinkSync(path.join(ROOT, 'package.json'), packagePath);
  await assert.rejects(() => buildArtifacts(root), /regular non-symlink/);
});

test('executable authority drift fails closed', async (t) => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const capabilityPath = path.join(root, 'src', 'capability.js');
  const original = fs.readFileSync(capabilityPath, 'utf8');
  assert.match(original, /gameMutation: false/);
  fs.writeFileSync(capabilityPath, original.replace('gameMutation: false', 'gameMutation: true'));
  await assert.rejects(() => buildArtifacts(root), /authority drift: gameMutation/);
});

test('public marker repository drift fails closed', async (t) => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const markerPath = path.join(root, '.axm', 'discovery-public.json');
  const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  marker.repo = 'mike-axiom-mir/not-floorborn';
  fs.writeFileSync(markerPath, `${JSON.stringify(marker, null, 2)}\n`);
  await assert.rejects(() => buildArtifacts(root), /marker repository drift/);
});

test('generated output drift is detected without rewriting it', async (t) => {
  const root = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  await writeArtifacts(root);
  const registryPath = path.join(root, 'registry', 'capabilities.jsonl');
  fs.appendFileSync(registryPath, '\n');
  const result = await checkArtifacts(root);
  assert.equal(result.ok, false);
  assert.deepEqual(result.mismatches, ['registry/capabilities.jsonl']);
});
