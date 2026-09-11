import { TextDecoder } from 'node:util';

export function decodeUtf8Strict(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new SyntaxError('stdin is not valid UTF-8');
  }
}

export function parseStrictJson(text) {
  const value = JSON.parse(text);
  scanJsonObjectMembers(text);
  return value;
}

function scanJsonObjectMembers(text) {
  let cursor = 0;

  function skipWhitespace() {
    while (cursor < text.length && (text[cursor] === ' ' || text[cursor] === '\t' || text[cursor] === '\n' || text[cursor] === '\r')) {
      cursor += 1;
    }
  }

  function scanString() {
    const start = cursor;
    cursor += 1;
    while (cursor < text.length) {
      const current = text[cursor];
      if (current === '\\') {
        cursor += 2;
        continue;
      }
      cursor += 1;
      if (current === '"') break;
    }
    return text.slice(start, cursor);
  }

  function scanPrimitive() {
    while (cursor < text.length) {
      const current = text[cursor];
      if (current === ',' || current === ']' || current === '}' || current === ' ' || current === '\t' || current === '\n' || current === '\r') break;
      cursor += 1;
    }
  }

  function scanArray() {
    cursor += 1;
    skipWhitespace();
    if (text[cursor] === ']') {
      cursor += 1;
      return;
    }
    while (cursor < text.length) {
      scanValue();
      skipWhitespace();
      if (text[cursor] === ']') {
        cursor += 1;
        return;
      }
      cursor += 1;
      skipWhitespace();
    }
  }

  function scanObject() {
    cursor += 1;
    skipWhitespace();
    if (text[cursor] === '}') {
      cursor += 1;
      return;
    }

    const seen = new Set();
    while (cursor < text.length) {
      const token = scanString();
      const member = JSON.parse(token);
      if (seen.has(member)) throw new SyntaxError(`duplicate JSON member: ${member}`);
      seen.add(member);

      skipWhitespace();
      cursor += 1;
      skipWhitespace();
      scanValue();
      skipWhitespace();
      if (text[cursor] === '}') {
        cursor += 1;
        return;
      }
      cursor += 1;
      skipWhitespace();
    }
  }

  function scanValue() {
    skipWhitespace();
    if (text[cursor] === '{') {
      scanObject();
    } else if (text[cursor] === '[') {
      scanArray();
    } else if (text[cursor] === '"') {
      scanString();
    } else {
      scanPrimitive();
    }
  }

  scanValue();
  skipWhitespace();
  if (cursor !== text.length) throw new SyntaxError('invalid JSON trailing content');
}
