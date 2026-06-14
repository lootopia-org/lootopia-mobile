#!/usr/bin/env node
/**
 * Reads the running Expo manifest and writes the tunnel/LAN host into:
 * - lootopia-mobile/.env (EXPO_PUBLIC_MOBILE_CAPTURE_LINK)
 * - lootopia-frontend/.env.local (NEXT_PUBLIC_MOBILE_CAPTURE_LINK)
 *
 * Usage: node scripts/sync-tunnel-env.mjs [port]
 * Default port: EXPO_PORT from .env, then 8081.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(root, '..');
const frontendEnv = join(mobileRoot, '..', 'lootopia-frontend', '.env.local');
const mobileEnv = join(mobileRoot, '.env');

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const vars = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return vars;
}

function upsertEnvFile(path, updates) {
  const lines = existsSync(path) ? readFileSync(path, 'utf8').split('\n') : [];
  const keys = Object.keys(updates);
  const remaining = lines.filter((line) => {
    const key = line.split('=')[0]?.trim();
    return !keys.includes(key);
  });
  const next = [...remaining.filter((line, i, arr) => !(line === '' && i === arr.length - 1))];
  for (const [key, value] of Object.entries(updates)) {
    next.push(`${key}=${value}`);
  }
  writeFileSync(path, `${next.join('\n')}\n`);
}

async function fetchHost(port) {
  const response = await fetch(`http://127.0.0.1:${port}`, {
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) {
    throw new Error(`Manifest HTTP ${response.status}`);
  }
  const manifest = await response.json();
  const host =
    manifest?.extra?.expoGo?.debuggerHost ||
    manifest?.extra?.expoClient?.hostUri;
  if (!host) {
    throw new Error('No debuggerHost in manifest');
  }
  return host.replace(/^https?:\/\//, '');
}

async function main() {
  const mobileVars = readEnvFile(mobileEnv);
  const ports = [
    Number(process.argv[2]) || Number(mobileVars.EXPO_PORT) || 8081,
    8081,
    8090,
    8082,
  ].filter((value, index, arr) => Number.isFinite(value) && arr.indexOf(value) === index);

  let host;
  let usedPort;
  for (const port of ports) {
    try {
      host = await fetchHost(port);
      usedPort = port;
      break;
    } catch {
      // try next port
    }
  }

  if (!host) {
    console.error(`Could not read Expo manifest on ports: ${ports.join(', ')}`);
    console.error('Start Expo first: npx expo start --tunnel');
    process.exit(1);
  }

  const captureTemplate = `exp://${host}/--/capture/{sessionId}`;
  upsertEnvFile(mobileEnv, {
    EXPO_PUBLIC_MOBILE_CAPTURE_LINK: captureTemplate,
  });
  upsertEnvFile(frontendEnv, {
    NEXT_PUBLIC_MOBILE_CAPTURE_LINK: captureTemplate,
  });

  console.log(`Synced Expo host from port ${usedPort}:`);
  console.log(`  ${captureTemplate}`);
  console.log('Updated lootopia-mobile/.env and lootopia-frontend/.env.local');
  console.log('Restart the Next.js dev server to pick up the frontend env change.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
