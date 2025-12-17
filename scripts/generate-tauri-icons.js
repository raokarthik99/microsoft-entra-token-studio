#!/usr/bin/env node
/**
 * Generates a trimmed, desktop-focused icon set for Tauri.
 *
 * Why: `tauri icon` generates mobile + store assets we don't commit. This script
 * generates everything into a temp dir, then syncs only the desktop assets into
 * `src-tauri/icons/` to keep the repo clean.
 */

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { mkdir, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const sourceIcon = path.join(ROOT, 'src-tauri', 'app-icon.png');
const outputDir = path.join(ROOT, 'src-tauri', 'icons');

const keepFiles = [
  '32x32.png',
  '64x64.png',
  '128x128.png',
  '128x128@2x.png',
  'icon.png',
  'icon.icns',
  'icon.ico',
];

function getTauriCliPath() {
  const binary = process.platform === 'win32' ? 'tauri.cmd' : 'tauri';
  return path.join(ROOT, 'node_modules', '.bin', binary);
}

function ensureExists(filePath, label) {
  if (!existsSync(filePath)) {
    console.error(`❌ Missing ${label}: ${filePath}`);
    process.exit(1);
  }
}

async function main() {
  ensureExists(sourceIcon, 'source icon');

  const tauriCli = getTauriCliPath();
  ensureExists(tauriCli, 'Tauri CLI (did you run pnpm install?)');

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'tauri-icons-'));

  try {
    const result = spawnSync(tauriCli, ['icon', sourceIcon, '-o', tempDir], {
      cwd: ROOT,
      stdio: 'inherit',
    });

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }

    await mkdir(outputDir, { recursive: true });

    for (const fileName of keepFiles) {
      const from = path.join(tempDir, fileName);
      ensureExists(from, `generated icon (${fileName})`);
      copyFileSync(from, path.join(outputDir, fileName));
    }

    // Remove any files/dirs we don't keep (e.g. ios/android/store icons).
    const existing = readdirSync(outputDir, { withFileTypes: true });
    for (const entry of existing) {
      if (keepFiles.includes(entry.name)) continue;
      rmSync(path.join(outputDir, entry.name), { recursive: true, force: true });
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(`❌ Failed to generate icons: ${err?.message ?? String(err)}`);
  process.exit(1);
});

