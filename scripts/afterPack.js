const fs = require('fs');
const path = require('path');

/**
 * Remove unnecessary files from packaged app to reduce size
 * Runs after electron-builder packages the app
 */
async function removeUnnecessaryFiles(context) {
  const resourcesPath = path.join(context.appOutDir, 'resources', 'app', 'node_modules');

  if (!fs.existsSync(resourcesPath)) {
    console.log('[afterPack] No node_modules found, skipping cleanup');
    return;
  }

  const pathsToRemove = [
    // Development files
    '**/.git',
    '**/.github',
    '**/.gitignore',
    '**/CHANGELOG.md',
    '**/HISTORY.md',
    '**/README.md',
    '**/readme.md',
    '**/LICENSE',
    '**/license',
    '**/.eslintrc*',
    '**/tsconfig.json',
    '**/jest.config.js',
    '**/webpack.config.js',
    '**/gulpfile.js',
    '**/Gruntfile.js',

    // Docs and examples
    '**/docs',
    '**/doc',
    '**/examples',
    '**/example',
    '**/samples',
    '**/sample',
    '**/.nyc_output',
    '**/coverage',

    // Source files (keep only compiled)
    '**/src',
    '**/test',
    '**/tests',
    '**/spec',
    '**/specs',
    '**/__tests__',

    // Build artifacts
    '**/build',
    '**/dist',
    '**/out',

    // Large files that aren't needed
    '**/*.map',
    '**/*.tgz',
    '**/*.tar.gz'
  ];

  const removeRecursive = (dir, pattern) => {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    files.forEach((file) => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        removeRecursive(fullPath, pattern);
        // Remove empty directories
        if (fs.readdirSync(fullPath).length === 0) {
          fs.rmdirSync(fullPath);
        }
      }
    });
  };

  let removedCount = 0;
  pathsToRemove.forEach((pattern) => {
    if (pattern.includes('*')) {
      // Simple pattern matching - just look for directory names
      const dirname = pattern.replace(/[\*\/]/g, '');
      const dirs = fs.readdirSync(resourcesPath);
      dirs.forEach((dir) => {
        if (dir === dirname || dir.includes(dirname)) {
          const fullPath = path.join(resourcesPath, dir);
          if (fs.existsSync(fullPath)) {
            console.log(`[afterPack] Removing ${dir}`);
            fs.rmSync(fullPath, { recursive: true, force: true });
            removedCount++;
          }
        }
      });
    }
  });

  console.log(`[afterPack] Removed ${removedCount} unnecessary directories`);
}

module.exports = removeUnnecessaryFiles;
