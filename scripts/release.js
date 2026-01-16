import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgPath = path.resolve(__dirname, '../package.json');
const packageLockPath = path.resolve(__dirname, '../package-lock.json');
const shrinkwrapPath = path.resolve(__dirname, '../npm-shrinkwrap.json');
const VERSION_PATTERN = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
const PREID_PATTERN = /^[0-9A-Za-z-]+$/;

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

function isYes(answer) {
  return answer === 'y' || answer === 'yes';
}

function normalizeVersion(value) {
  if (!value) {
    return value;
  }
  return value.startsWith('v') ? value.slice(1) : value;
}

function parseArgs(argv) {
  const options = { allowDirty: false, help: false, preid: null };
  const positional = [];
  const unknownFlags = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--allow-dirty') {
      options.allowDirty = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--preid') {
      const value = argv[i + 1];
      if (!value) {
        unknownFlags.push('--preid');
        continue;
      }
      options.preid = value;
      i += 1;
      continue;
    }
    if (arg.startsWith('--preid=')) {
      const value = arg.split('=')[1];
      if (!value) {
        unknownFlags.push(arg);
        continue;
      }
      options.preid = value;
      continue;
    }
    if (arg.startsWith('--')) {
      unknownFlags.push(arg);
      continue;
    }
    positional.push(arg);
  }

  return { options, positional, unknownFlags };
}

function printUsage() {
  console.error('Usage: node scripts/release.js <recreate|patch|minor|major|prerelease|premajor|preminor|prepatch|x.y.z> [recreateVersion] [--allow-dirty] [--preid <id>]');
}

function ensureGitRepo() {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
  } catch {
    console.error('❌ Not inside a git repository.');
    process.exit(1);
  }
}

function resolveRemoteName() {
  const output = run('git remote', 'pipe');
  const remotes = output
    .split('\n')
    .map(remote => remote.trim())
    .filter(Boolean);

  if (remotes.includes('origin')) {
    return 'origin';
  }
  if (remotes.length === 1) {
    return remotes[0];
  }

  console.error('❌ Could not determine git remote. Configure "origin" or add a single remote.');
  process.exit(1);
}

function ensureCleanWorkingTree(allowDirty) {
  if (allowDirty) {
    return;
  }
  const status = run('git status --porcelain', 'pipe');
  if (status.trim()) {
    console.error('❌ Working tree is not clean. Commit or stash changes, or pass --allow-dirty.');
    process.exit(1);
  }
}

function backupFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf8');
}

function restoreFile(filePath, contents) {
  if (contents === null) {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
    return;
  }
  fs.writeFileSync(filePath, contents);
}

function calculateNextVersion(bumpType, preid) {
  const filesToBackup = [
    pkgPath,
    packageLockPath,
    shrinkwrapPath
  ];
  const backups = new Map();
  for (const file of filesToBackup) {
    backups.set(file, backupFile(file));
  }

  try {
    const preidArg = preid ? ` --preid ${preid}` : '';
    run(`npm version ${bumpType}${preidArg} --no-git-tag-version`, 'ignore');
    const tempPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return tempPkg.version;
  } catch (e) {
    throw new Error(`Failed to calculate next version: ${e.message}`);
  } finally {
    for (const [file, contents] of backups) {
      restoreFile(file, contents);
    }
  }
}

function hasLocalTag(tag) {
  const output = run(`git tag -l "${tag}"`, 'pipe');
  return output.split('\n').some(line => line.trim() === tag);
}

function hasRemoteTag(tag, remote) {
  const output = run(`git ls-remote --tags --refs ${remote} "${tag}"`, 'pipe');
  return output.trim().length > 0;
}

async function main() {
  const { options, positional, unknownFlags } = parseArgs(process.argv.slice(2));
  if (unknownFlags.length > 0) {
    console.error(`❌ Unknown flags: ${unknownFlags.join(', ')}`);
    printUsage();
    process.exit(1);
  }
  if (options.help) {
    printUsage();
    process.exit(0);
  }

  ensureGitRepo();
  const remote = resolveRemoteName();

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const currentVersion = pkg.version;
  const action = positional[0];
  const actionTarget = positional[1];

  if (positional.length > 2) {
    console.error('❌ Too many arguments.');
    printUsage();
    process.exit(1);
  }

  if (!VERSION_PATTERN.test(currentVersion)) {
    console.error(`❌ Invalid package.json version: ${currentVersion}`);
    console.error('   Expected format: X.Y.Z or X.Y.Z-prerelease');
    process.exit(1);
  }

  if (!action) {
    printUsage();
    process.exit(1);
  }

  // --- RECREATE ---
  if (action === 'recreate') {
    if (options.preid) {
      console.error('❌ --preid is not supported with recreate.');
      process.exit(1);
    }
    const recreateVersion = actionTarget ? normalizeVersion(actionTarget) : currentVersion;
    if (!VERSION_PATTERN.test(recreateVersion)) {
      console.error(`❌ Invalid version format: ${recreateVersion}`);
      console.error('   Expected format: X.Y.Z or X.Y.Z-prerelease');
      process.exit(1);
    }

    const tagName = `v${recreateVersion}`;
    console.log(`\n⚠️  You are about to recreate tag ${tagName}.`);
    console.log(`   This will DELETE the tag locally and remotely, then recreate it at the current HEAD.`);
    console.log(`   This is destructive and may affect running CI/CD pipelines.\n`);
    
    const ans = await ask(`Are you sure you want to proceed? (y/N): `);
    if (!isYes(ans)) {
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
      run(`git push ${remote} :${tagName}`, 'ignore'); 
    } catch {
       console.log("   (Remote tag might not exist or already deleted, continuing...)");
    }

    // 3. Ensure current HEAD is on the remote branch before tagging
    run(`git push ${remote} HEAD`);

    // 4. Create & Push tag
    run(`git tag ${tagName}`);
    run(`git push ${remote} ${tagName}`);

    console.log(`\n✅ Tag ${tagName} recreated on current HEAD!\n`);
    process.exit(0);
  }

  // --- NEW RELEASE ---
  
  // 1. Determine Next Version
  let nextVersion;
  const normalizedAction = normalizeVersion(action);
  const isExplicitVersion = VERSION_PATTERN.test(normalizedAction);
  const isBumpType = ['patch', 'minor', 'major', 'prerelease', 'premajor', 'preminor', 'prepatch'].includes(action);

  if (actionTarget) {
    console.error('❌ Unexpected extra argument.');
    printUsage();
    process.exit(1);
  }

  if (options.preid) {
    if (!PREID_PATTERN.test(options.preid)) {
      console.error(`❌ Invalid preid: ${options.preid}`);
      console.error('   Expected format: letters, numbers, and dashes only.');
      process.exit(1);
    }
    if (!isBumpType || (!action.startsWith('pre') && action !== 'prerelease')) {
      console.error('❌ --preid can only be used with prerelease, premajor, preminor, or prepatch.');
      process.exit(1);
    }
  }

  if (isExplicitVersion) {
    nextVersion = normalizedAction;
  } else if (isBumpType) {
    try {
      nextVersion = calculateNextVersion(action, options.preid);
    } catch (e) {
      console.error(`❌ ${e.message}`);
      process.exit(1);
    }
  } else {
    console.error(`❌ Invalid version or action: ${action}`);
    process.exit(1);
  }

  if (nextVersion === currentVersion) {
    console.error(`❌ Next version matches current version (${currentVersion}).`);
    console.error('   Use "node scripts/release.js recreate" to move the tag.');
    process.exit(1);
  }

  if (!VERSION_PATTERN.test(nextVersion)) {
    console.error(`❌ Invalid version format: ${nextVersion}`);
    console.error('   Expected format: X.Y.Z or X.Y.Z-prerelease');
    process.exit(1);
  }

  const newTagName = `v${nextVersion}`;
  const hasLocal = hasLocalTag(newTagName);
  const hasRemote = hasRemoteTag(newTagName, remote);
  if (hasRemote) {
    console.error(`❌ Tag ${newTagName} already exists on ${remote}.`);
    console.error(`   Use "node scripts/release.js recreate" to move the tag, or pick a different version.`);
    process.exit(1);
  }

  ensureCleanWorkingTree(options.allowDirty);

  console.log(`\n🚀 Preparing Release`);
  console.log(`   Current Version: ${currentVersion}`);
  console.log(`   Next Version:    ${nextVersion}\n`);

  const ans = await ask(`Proceed with bumping version to ${nextVersion}? (y/N): `);
  if (!isYes(ans)) {
      console.log('Aborted.');
      process.exit(0);
  }

  if (hasLocal) {
    console.log(`\nℹ️  Local tag ${newTagName} exists; deleting it before re-tagging.`);
    run(`git tag -d ${newTagName}`);
  }

  // 2. Apply version bump across files (and update npm lockfiles if present)
  const shouldUpdateNpmLock = fs.existsSync(packageLockPath) || fs.existsSync(shrinkwrapPath);
  if (shouldUpdateNpmLock) {
    run(`npm version ${nextVersion} --no-git-tag-version`);
  }
  run(`node scripts/sync-version.js ${nextVersion}`);

  // 3. Commit
  run(`git add .`);
  run(`git commit -m "chore: release ${newTagName}"`);

  // 4. Push commit before tagging so the branch is updated first
  run(`git push ${remote} HEAD`);

  // 5. Tag
  run(`git tag ${newTagName}`);

  // 6. Push tag
  run(`git push ${remote} ${newTagName}`);

  console.log(`\n✨ Released ${newTagName} successfully!\n`);
  process.exit(0);
}

main();
