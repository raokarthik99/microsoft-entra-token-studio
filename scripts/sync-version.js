#!/usr/bin/env node
/**
 * Synchronizes the version number across package.json, tauri.conf.json, and Cargo.toml
 * 
 * Usage:
 *   node scripts/sync-version.js           # Syncs from package.json version
 *   node scripts/sync-version.js 1.2.3     # Sets all files to specified version
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function syncVersion(newVersion) {
  const pkgPath = path.join(ROOT, 'package.json');
  const tauriPath = path.join(ROOT, 'src-tauri/tauri.conf.json');
  const cargoPath = path.join(ROOT, 'src-tauri/Cargo.toml');

  // Read current package.json
  const pkg = readJSON(pkgPath);
  const version = newVersion || pkg.version;

  // Validate version format
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
    console.error(`❌ Invalid version format: ${version}`);
    console.error('   Expected format: X.Y.Z or X.Y.Z-prerelease');
    process.exit(1);
  }

  console.log(`📦 Syncing version to ${version}\n`);

  // Update package.json
  pkg.version = version;
  writeJSON(pkgPath, pkg);
  console.log(`   ✅ package.json`);

  // Update tauri.conf.json
  const tauri = readJSON(tauriPath);
  tauri.version = version;
  writeJSON(tauriPath, tauri);
  console.log(`   ✅ src-tauri/tauri.conf.json`);

  // Update Cargo.toml
  let cargo = fs.readFileSync(cargoPath, 'utf8');
  cargo = cargo.replace(/^version = ".*"$/m, `version = "${version}"`);
  fs.writeFileSync(cargoPath, cargo);
  console.log(`   ✅ src-tauri/Cargo.toml`);

  console.log(`\n✨ All files synced to version ${version}`);
}

// Run
const newVersion = process.argv[2];
syncVersion(newVersion);
