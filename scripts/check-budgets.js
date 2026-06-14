#!/usr/bin/env node
/**
 * Budgets de performance (phase optimisation) — à brancher en CI :
 *   node scripts/check-budgets.js
 *
 * Vérifie :
 *  - aucun asset embarqué (assets/, src/assets/) ne dépasse 5 Mo
 *    (modèles 3D : préférer GLB + Draco servis par CDN, pas dans le bundle)
 *  - poids total des assets embarqués < 20 Mo
 * Sort avec un code d'erreur si un budget est dépassé.
 */
const fs = require('fs');
const path = require('path');

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const ASSET_DIRS = ['assets', 'src/assets'];

const root = path.resolve(__dirname, '..');
let total = 0;
const violations = [];

function walk(dir) {
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else {
      const { size } = fs.statSync(fullPath);
      total += size;
      if (size > MAX_FILE_BYTES) {
        violations.push(`${path.relative(root, fullPath)} : ${(size / 1024 / 1024).toFixed(1)} Mo > 5 Mo`);
      }
    }
  }
}

ASSET_DIRS.forEach((dir) => walk(path.join(root, dir)));

if (total > MAX_TOTAL_BYTES) {
  violations.push(`Total assets : ${(total / 1024 / 1024).toFixed(1)} Mo > 20 Mo`);
}

if (violations.length > 0) {
  console.error('❌ Budgets de performance dépassés :');
  violations.forEach((violation) => console.error('  - ' + violation));
  process.exit(1);
}

console.log(`✅ Budgets OK — assets embarqués : ${(total / 1024 / 1024).toFixed(2)} Mo (max 20 Mo, 5 Mo/fichier)`);
