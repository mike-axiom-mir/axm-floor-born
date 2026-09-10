import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const REPOSITORY = 'mike-axiom-mir/axm-floor-born';
export const DISCOVERY_BUDDY_REF = '565c38ecf93a9d563b02211258d8d36fcb1162b5';
export const REGISTRY_PATH = 'registry/capabilities.jsonl';
export const RECEIPT_PATH = 'registry/capabilities.receipt.json';
export const MARKER_PATH = '.axm/discovery-public.json';

const SOURCE_PATHS = ['package.json', 'src/capability.js', 'LICENSE'];
const EXPECTED_OPERATIONS = ['describe', 'decide', 'learn', 'complete'];
const EXPECTED_PLAYER_PROTOCOLS = ['axm.player.v0.1', 'axm.player.rts.v0.1'];
const PATTERN_PROVENANCE = Object.freeze({
  adapted_from_repository: 'mike-axiom-mir/axm-EchoWorld',
  adapted_from_ref: '6987cf842a0f17e03f2ef679d07ec5782b30664b',
  adapted_paths: [
    '.axm/discovery-public.json',
    'tools/generate-public-capabilities.mjs',
    '.github/workflows/public-capability-discovery.yml',
  ],
  copied_runtime_code: false,
});

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function gitBlobSha1(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return createHash('sha1').update(header).update(bytes).digest('hex');
}

function resolveRegularFile(root, relativePath) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  const prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;
  if (!resolved.startsWith(prefix)) throw new Error(`unsafe source path: ${relativePath}`);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`source must be a regular non-symlink file: ${relativePath}`);
  }
  return resolved;
}

function sourceRecord(root, relativePath) {
  const filePath = resolveRegularFile(root, relativePath);
  const bytes = fs.readFileSync(filePath);
  return { path: relativePath, git_blob_sha1: gitBlobSha1(bytes) };
}

function readMarker(root) {
  const marker = JSON.parse(fs.readFileSync(resolveRegularFile(root, MARKER_PATH), 'utf8'));
  if (marker.schema !== 'axm.discovery-public/v1') throw new Error('unexpected public discovery marker schema');
  if (marker.public !== true) throw new Error('public discovery marker must explicitly opt in');
  if (marker.repo !== REPOSITORY) throw new Error('public discovery marker repository drift');
  if (marker.display_name !== 'AXM Floorborn') throw new Error('public discovery display name drift');
  return marker;
}

function assertStringArray(actual, expected, label) {
  if (!Array.isArray(actual) || actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error(`${label} drift`);
  }
}

function assertPackageBoundary(packageDocument) {
  if (packageDocument.name !== 'axm-floor-born') throw new Error('unexpected package name');
  if (typeof packageDocument.version !== 'string' || packageDocument.version.length === 0) throw new Error('package version is required');
  if (packageDocument.private !== true) throw new Error('package must remain private to prevent accidental registry publication');
  if (packageDocument.type !== 'module') throw new Error('unexpected package module type');
  if (packageDocument.license !== 'Apache-2.0') throw new Error('unexpected package license declaration');
  if (packageDocument.engines?.node !== '>=24') throw new Error('unexpected Node runtime boundary');
  if (packageDocument.exports?.['.'] !== './src/capability.js') throw new Error('unexpected library export');
  if (packageDocument.bin?.['axm-floorborn-player'] !== './bin/floorborn-player.js') throw new Error('unexpected CLI export');

  const capability = packageDocument.capability;
  if (!capability || capability.schema !== 'axm.floorborn.capability/v0.1') throw new Error('package capability schema drift');
  if (capability.id !== 'axm.floorborn.bounded-player-process') throw new Error('package capability id drift');
  if (capability.status !== 'EXPERIMENTAL') throw new Error('public discovery must preserve EXPERIMENTAL status');
  if (capability.entry !== './src/capability.js') throw new Error('package capability entry drift');
  if (capability.bin !== 'axm-floorborn-player') throw new Error('package capability bin drift');
  if (capability.offline !== true) throw new Error('discovery cannot widen the local/offline contract');
  if (capability.authority !== 'NO_GAME_MUTATION_NO_MERGE_NO_CANON') throw new Error('package capability authority drift');
  return capability;
}

async function loadExecutableDescriptor(root, sourceIdentity) {
  const modulePath = resolveRegularFile(root, 'src/capability.js');
  const moduleUrl = `${pathToFileURL(modulePath).href}?source=${sourceIdentity.git_blob_sha1}`;
  const module = await import(moduleUrl);
  if (typeof module.describeCapability !== 'function') throw new Error('src/capability.js must export describeCapability()');
  return module.describeCapability();
}

function assertExecutableBoundary(descriptor, packageCapability) {
  if (!descriptor || descriptor.schema !== packageCapability.schema) throw new Error('executable capability schema drift');
  if (descriptor.id !== packageCapability.id) throw new Error('executable capability id drift');
  if (descriptor.status !== packageCapability.status) throw new Error('executable capability status drift');

  const runtime = descriptor.runtime;
  if (!runtime || runtime.node !== '>=24' || runtime.dependencies !== 0) throw new Error('unexpected executable runtime boundary');
  if (runtime.network !== false || runtime.account !== false || runtime.aiModel !== false) {
    throw new Error('executable capability widened local/offline dependencies');
  }

  const process = descriptor.process;
  if (!process) throw new Error('executable process contract missing');
  if (process.requestSchema !== 'axm.floorborn.process-request/v0.1') throw new Error('process request schema drift');
  if (process.responseSchema !== 'axm.floorborn.process-response/v0.1') throw new Error('process response schema drift');
  if (process.receiptSchema !== 'axm.floorborn.process-receipt/v0.1') throw new Error('process receipt schema drift');
  if (process.maxCliInputBytes !== 1048576) throw new Error('CLI input bound drift');
  assertStringArray(process.operations, EXPECTED_OPERATIONS, 'process operations');
  assertStringArray(descriptor.playerProtocols, EXPECTED_PLAYER_PROTOCOLS, 'player protocols');

  const authority = descriptor.authority;
  for (const key of ['automaticSelection', 'canon', 'execution', 'gameMutation', 'merge', 'publication']) {
    if (authority?.[key] !== false) throw new Error(`executable capability authority drift: ${key}`);
  }
  return descriptor;
}

export async function buildArtifacts(root = process.cwd()) {
  readMarker(root);
  const packageDocument = JSON.parse(fs.readFileSync(resolveRegularFile(root, 'package.json'), 'utf8'));
  const packageCapability = assertPackageBoundary(packageDocument);
  const sources = SOURCE_PATHS.map((relativePath) => sourceRecord(root, relativePath));
  const descriptorSource = sources.find((record) => record.path === 'src/capability.js');
  const descriptor = assertExecutableBoundary(
    await loadExecutableDescriptor(root, descriptorSource),
    packageCapability,
  );

  const registryRecord = {
    schema: 'axm.public-capability/v1',
    id: descriptor.id,
    version: packageDocument.version,
    status: descriptor.status,
    providers: [REPOSITORY],
    consumers: [],
    summary: packageDocument.description,
    license: packageDocument.license,
    runtime: descriptor.runtime,
    entrypoints: {
      library: '.',
      command: packageCapability.bin,
      discoveryCommand: `${packageCapability.bin} describe`,
    },
    contracts: {
      playerProtocols: descriptor.playerProtocols,
      processRequest: descriptor.process.requestSchema,
      processResponse: descriptor.process.responseSchema,
      processReceipt: descriptor.process.receiptSchema,
    },
    source: {
      metadata: 'package.json',
      descriptor: 'src/capability.js',
      license: 'LICENSE',
    },
    authority: {
      discoveryOnly: true,
      execution: false,
      automaticSelection: false,
      automaticInstall: false,
      gameMutation: false,
      merge: false,
      canon: false,
    },
  };
  const registryText = `${canonicalJson(registryRecord)}\n`;

  const receiptBody = {
    schema: 'axm.public-capability-registry-receipt/v1',
    repository: REPOSITORY,
    registry: {
      path: REGISTRY_PATH,
      sha256: sha256(Buffer.from(registryText, 'utf8')),
      capability_count: 1,
      capability_ids: [descriptor.id],
    },
    sources,
    compatibility: {
      consumer: 'mike-axiom-mir/axm-discovery-buddy',
      pinned_ref: DISCOVERY_BUDDY_REF,
      portable_boundary: 'discovery-buddy.pyz',
      marker_contract: 'axm.discovery-public/v1',
      registry_contract: 'registry/*capabilit*.jsonl',
    },
    pattern_provenance: PATTERN_PROVENANCE,
    truth_boundary: {
      source_backed: true,
      public_export_intent: true,
      runtime_proof: false,
      execution_authority: false,
      automatic_selection_authority: false,
      automatic_install_authority: false,
      game_mutation_authority: false,
      merge_authority: false,
      canon_authority: false,
    },
  };
  const receipt = {
    ...receiptBody,
    receipt_sha256: sha256(Buffer.from(canonicalJson(receiptBody), 'utf8')),
  };

  return {
    [REGISTRY_PATH]: registryText,
    [RECEIPT_PATH]: `${JSON.stringify(receipt, null, 2)}\n`,
  };
}

export async function checkArtifacts(root = process.cwd()) {
  const expected = await buildArtifacts(root);
  const mismatches = [];
  for (const [relativePath, text] of Object.entries(expected)) {
    const target = path.join(root, relativePath);
    let actual = null;
    try {
      actual = fs.readFileSync(target, 'utf8');
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    if (actual !== text) mismatches.push(relativePath);
  }
  return { ok: mismatches.length === 0, mismatches, expected };
}

export async function writeArtifacts(root = process.cwd()) {
  const artifacts = await buildArtifacts(root);
  for (const [relativePath, text] of Object.entries(artifacts)) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text, 'utf8');
  }
  return artifacts;
}

async function main(argv = process.argv.slice(2)) {
  let mode = 'write';
  let root = process.cwd();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') mode = 'check';
    else if (arg === '--write') mode = 'write';
    else if (arg === '--root') {
      root = path.resolve(argv[index + 1] ?? '');
      index += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (mode === 'check') {
    const result = await checkArtifacts(root);
    if (!result.ok) {
      console.error(`public capability registry is stale: ${result.mismatches.join(', ')}`);
      process.exitCode = 1;
      return;
    }
    console.log(`public capability registry: PASS (${Object.keys(result.expected).length} generated files)`);
    return;
  }
  const artifacts = await writeArtifacts(root);
  console.log(`public capability registry: wrote ${Object.keys(artifacts).join(', ')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(`public capability registry: ERROR: ${error.message}`);
    process.exitCode = 2;
  });
}
