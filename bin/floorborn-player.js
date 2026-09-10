#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import {
  describeCapability,
  processFloorbornRequest,
} from '../src/capability.js';
import { stableStringify } from '../src/stable.js';
import { parseStrictJson } from '../src/strict-json.js';

const MAX_INPUT_BYTES = 1024 * 1024;
const command = process.argv[2] ?? 'help';

try {
  if (command === 'describe') {
    write(describeCapability());
  } else if (command === 'process') {
    const bytes = readFileSync(0);
    if (bytes.length > MAX_INPUT_BYTES) throw new Error('stdin exceeds 1048576 byte limit');
    const text = bytes.toString('utf8').trim();
    if (!text) throw new Error('process requires one JSON request on stdin');
    const request = parseStrictJson(text);
    write(processFloorbornRequest(request));
  } else if (command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write('Usage: axm-floorborn-player <describe|process>\n');
  } else {
    throw new Error(`unsupported command: ${command}`);
  }
} catch (error) {
  process.stderr.write(`${stableStringify({
    schema: 'axm.floorborn.process-error/v0.1',
    ok: false,
    error: {
      code: 'INVALID_REQUEST',
      message: error instanceof Error ? error.message : String(error),
    },
    authority: 'NO_EXECUTION_NO_MERGE_NO_CANON',
  })}\n`);
  process.exitCode = 2;
}

function write(value) {
  process.stdout.write(`${stableStringify(value)}\n`);
}
