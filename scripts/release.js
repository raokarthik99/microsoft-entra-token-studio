import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to run commands
function run(command) {
  console.log(`> ${command}`);
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (e) {
    console.error(`Command failed: ${command}`);
    process.exit(1);
  }
}

// Read Current Version
const pkgPath = path.resolve(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;
const tagName = `v${version}`;

const action = process.argv[2];

if (!action) {
  console.error("Usage: node release.js <recreate|patch|minor|major>");
  process.exit(1);
}

if (action === 'recreate') {
  console.log(`\n🔄 Recreating tag ${tagName}...\n`);

  try {
    // Delete local tag
    run(`git tag -d ${tagName}`);
  } catch (e) {
    // Ignore if not exists
  }

  try {
    // Delete remote tag
    run(`git push origin :${tagName}`);
  } catch (e) {
     console.log("Remote tag might not exist, continuing...");
  }

  // Create & Push
  run(`git tag ${tagName}`);
  run(`git push origin ${tagName}`);

  console.log(`\n✅ Tag ${tagName} recreated on current HEAD!\n`);
}
else if (['patch', 'minor', 'major'].includes(action)) {
  console.log(`\n🚀 Starting ${action} release...\n`);

  // 1. Bump package.json (no git tag yet)
  run(`npm version ${action} --no-git-tag-version`);

  // 2. Read new version
  const newPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const newVersion = newPkg.version;
  const newTagName = `v${newVersion}`;

  // 3. Sync other files (using existing sync-version.js logic)
  run(`node scripts/sync-version.js ${newVersion}`);

  // 4. Commit
  run(`git add .`);
  run(`git commit -m "chore: release ${newTagName}"`);

  // 5. Tag
  run(`git tag ${newTagName}`);

  // 6. Push
  run(`git push origin ${newTagName}`);

  console.log(`\n✨ Released ${newTagName} successfully!\n`);
} else {
  console.error(`Unknown action: ${action}`);
  process.exit(1);
}
