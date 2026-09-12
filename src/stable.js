import { createHash } from 'node:crypto';

export function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableClone(value[key])]),
    );
  }
  return value;
}

export function stableStringify(value) {
  return JSON.stringify(stableClone(value));
}

export function digest(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}
