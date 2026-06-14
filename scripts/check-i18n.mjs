#!/usr/bin/env node
/**
 * Validates i18next keys against lootopia-mobile/locales JSON.
 * Run: node scripts/check-i18n.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(__dirname, '..');
const LOCALES = path.join(APP, 'locales');
const LOCALES_LIST = ['en', 'fr'];

function loadMessages(locale) {
  const namespaces = ['common', 'auth', 'hunts', 'partner', 'validation'];
  const messages = {};
  for (const ns of namespaces) {
    messages[ns] = JSON.parse(fs.readFileSync(path.join(LOCALES, locale, `${ns}.json`), 'utf8'));
  }
  return messages;
}

function resolveKey(messages, fullKey) {
  const [ns, ...rest] = fullKey.split(':');
  if (!ns || rest.length === 0) return { ok: false, reason: 'missing namespace prefix' };

  let node = messages[ns];
  if (!node) return { ok: false, reason: 'missing namespace' };

  for (const part of rest.join(':').split('.')) {
    if (node == null || typeof node !== 'object') {
      return { ok: false, reason: 'path ends at non-object' };
    }
    node = node[part];
  }

  if (node === undefined) return { ok: false, reason: 'missing key' };
  if (typeof node === 'object') return { ok: false, reason: 'key is object, not string' };
  return { ok: true };
}

function walkDir(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') walkDir(full, files);
    else if (/\.(tsx|ts)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function extractKeys(file) {
  const content = fs.readFileSync(file, 'utf8');
  const keys = [];

  const nsMatches = [...content.matchAll(/useTranslation\(\s*(?:\[([^\]]+)\]|['"`]([^'"`]+)['"`])/g)];
  const namespaces = nsMatches.flatMap((match) => {
    const raw = match[1] ?? match[2] ?? '';
    return raw
      .split(',')
      .map((part) => part.trim().replace(/^['"`]|['"`]$/g, ''))
      .filter(Boolean);
  });

  const staticKey = /(?<![\w.])t\(\s*['"`]([^'"`$]+)['"`]/g;
  let m;
  while ((m = staticKey.exec(content)) !== null) {
    const key = m[1];
    if (key.includes('://')) continue;
    if (key.includes(':')) {
      keys.push({ file, key, namespaces: [key.split(':')[0]] });
      continue;
    }
    keys.push({ file, key, namespaces: namespaces.length > 0 ? namespaces : ['common'] });
  }

  return keys;
}

const files = [
  ...walkDir(path.join(APP, 'app')),
  ...walkDir(path.join(APP, 'src')),
];

const usages = files.flatMap(extractKeys);
const unique = new Map();
for (const u of usages) {
  const id = u.key.includes(':') ? u.key : `${u.namespaces.join('|')}:${u.key}`;
  unique.set(`${id}|${u.file}`, u);
}

let errors = 0;
for (const locale of LOCALES_LIST) {
  const messages = loadMessages(locale);
  console.log(`\n=== ${locale.toUpperCase()} ===`);
  const missing = new Map();

  for (const usage of unique.values()) {
    const candidates = usage.key.includes(':')
      ? [usage.key]
      : usage.namespaces.map((ns) => `${ns}:${usage.key}`);

    const resolved = candidates.some((fullKey) => resolveKey(messages, fullKey).ok);
    if (resolved) continue;

    const id = candidates[0];
    if (!missing.has(id)) {
      missing.set(id, { reason: 'missing in all candidate namespaces', files: new Set() });
    }
    missing.get(id).files.add(path.relative(APP, usage.file));
    errors++;
  }

  for (const [key, info] of [...missing.entries()].sort()) {
    console.log(`  MISSING (${info.reason}): ${key}`);
    for (const f of info.files) console.log(`    - ${f}`);
  }
}

if (errors > 0) {
  console.log(`\n${errors} missing translation reference(s) found.`);
  process.exit(1);
}

console.log('\nAll mobile translation keys resolve correctly.');
