import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgPath = path.resolve(__dirname, '../package.json');

// Helper to run commands
function run(command, stdio = 'inherit') {
  console.log(`> ${command}`);
  try {
    const output = execSync(command, { stdio, encoding: 'utf8' });
    if (typeof output === 'string') {
      return output.trim();
    }
    if (Buffer.isBuffer(output)) {
      return output.toString('utf8').trim();
    }
    return '';
  } catch (e) {
    if (stdio === 'ignore') {
      throw e;
    }
    console.error(`Command failed: ${command}`);
    process.exit(1);
  }
}

// Prompt helper
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const currentVersion = pkg.version;
  const tagName = `v${currentVersion}`;
  const action = process.argv[2];

  if (!action) {
    console.error("Usage: node release.js <recreate|patch|minor|major|prerelease|x.y.z>");
    process.exit(1);
  }

  // --- RECREATE ---
  if (action === 'recreate') {
    console.log(`\n⚠️  You are about to recreate tag ${tagName}.`);
    console.log(`   This will DELETE the tag locally and remotely, then recreate it at the current HEAD.`);
    console.log(`   This is destructive and may affect running CI/CD pipelines.\n`);
    
    const ans = await ask(`Are you sure you want to proceed? (y/N): `);
    if (ans !== 'y') {
      console.log('Aborted.');
      process.exit(0);
    }

    // 1. Delete local tag if exists
    try {
      const tagCheck = run(`git tag -l "${tagName}"`, 'pipe');
      if (tagCheck.trim() === tagName) {
        run(`git tag -d ${tagName}`);
      }
    } catch (e) {
      console.warn('   ⚠️ Could not check or delete local tag:', e.message);
    }
    
    // 2. Delete remote tag
    try {
      run(`git push origin :${tagName}`, 'ignore'); 
    } catch {
       console.log("   (Remote tag might not exist or already deleted, continuing...)");
    }

    // 3. Create & Push
    run(`git tag ${tagName}`);
    run(`git push origin ${tagName}`);

    console.log(`\n✅ Tag ${tagName} recreated on current HEAD!\n`);
    process.exit(0);
  }

  // --- NEW RELEASE ---
  
  // 1. Determine Next Version
  let nextVersion;
  const isExplicitVersion = /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(action);
  const isBumpType = ['patch', 'minor', 'major', 'prerelease', 'premajor', 'preminor', 'prepatch'].includes(action);

  if (isExplicitVersion) {
    nextVersion = action;
  } else if (isBumpType) {
    // Calculate next version safely by creating a temp package.json or using dry-run trick if feasible. 
    // Simplest robust way: backup package.json -> npm version -> read -> restore.
    const pkgBackup = fs.readFileSync(pkgPath, 'utf8');
    try {
      // We use --no-git-tag-version to modify just the file
      run(`npm version ${action} --no-git-tag-version`, 'ignore'); 
      const tempPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      nextVersion = tempPkg.version;
    } finally {
      // Restore immediately
      fs.writeFileSync(pkgPath, pkgBackup);
    }
  } else {
    console.error(`❌ Invalid version or action: ${action}`);
    process.exit(1);
  }

  console.log(`\n🚀 Preparing Release`);
  console.log(`   Current Version: ${currentVersion}`);
  console.log(`   Next Version:    ${nextVersion}\n`);

  const ans = await ask(`Proceed with bumping version to ${nextVersion}? (y/N): `);
  if (ans !== 'y') {
      console.log('Aborted.');
      process.exit(0);
  }

  // 2. Apply Version Bump
  // If explicitly provided, we use it. If bump type, we use npm version again to apply it for real.
  // Actually, standardizing on just writing the version or using npm version with explicit argument is cleaner.
  // npm version <new-version> works.
  run(`npm version ${nextVersion} --no-git-tag-version`);

  // 3. Sync other files
  run(`node scripts/sync-version.js ${nextVersion}`);

  // 4. Commit
  const newTagName = `v${nextVersion}`;
  run(`git add .`);
  run(`git commit -m "chore: release ${newTagName}"`);

  // 5. Tag
  run(`git tag ${newTagName}`);

  // 6. Push
  run(`git push origin ${newTagName}`);

  console.log(`\n✨ Released ${newTagName} successfully!\n`);
  process.exit(0);
}

main();
