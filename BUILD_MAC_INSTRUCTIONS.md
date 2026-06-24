# Building Jarvis for macOS

## Overview
To build Jarvis for macOS, you need to run the build on an actual macOS machine. electron-builder requires the target platform for compilation.

## Option 1: Build Locally on Mac (Recommended for Testing)

### Prerequisites
- macOS 10.13 or later
- Node.js 16+
- npm

### Steps

1. **Clone the repository**
```bash
git clone https://github.com/threeminutesai/agentic-jarvis.git
cd agentic-jarvis
```

2. **Install dependencies**
```bash
npm install
```

3. **Build for macOS**
```bash
npm run dist:mac
```

4. **Output files**
Built files will be in `release/`:
- `Jarvis-0.4.0.dmg` - Installer (drag-and-drop)
- `Jarvis-0.4.0.zip` - Portable archive
- `Jarvis-0.4.0-arm64.dmg` - ARM64 (Apple Silicon) installer
- `Jarvis-0.4.0-arm64.zip` - ARM64 portable archive

5. **Test the build**
```bash
# Extract and run the DMG
open release/Jarvis-0.4.0.dmg

# Or run the app directly
open release/mac/Jarvis.app
```

## Option 2: Automated Build with GitHub Actions

A GitHub Actions workflow can automatically build for macOS when you push commits.

### Setup

1. **Create workflow file**
Create `.github/workflows/build-mac.yml`:

```yaml
name: Build macOS

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  build:
    runs-on: macos-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build for macOS
        run: npm run dist:mac
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: macos-builds
          path: release/Jarvis-*.dmg
          path: release/Jarvis-*.zip
```

2. **Commit and push**
```bash
git add .github/workflows/build-mac.yml
git commit -m "ci: add macOS build workflow"
git push origin main
```

3. **Monitor builds**
- Go to GitHub repo → Actions tab
- View build progress
- Download built DMG/ZIP files

## Building the Release Bundle

After building on Mac, create a bundle similar to Windows:

```bash
# Create bundle directory
mkdir -p release-bundle/data
cp release/Jarvis-0.4.0.dmg release-bundle/
cp -r data/music release-bundle/data/
cp data/music-library.json release-bundle/data/

# Create ZIP bundle
cd release-bundle
zip -r ../Jarvis-0.4.0-Mac-Bundle.zip .
```

## macOS App Structure

After building, the app structure is:
```
Jarvis.app
├── Contents
│   ├── MacOS/
│   │   └── Jarvis (executable)
│   ├── Resources/
│   │   └── app.asar (packaged app code)
│   ├── Frameworks/
│   │   └── Electron Framework
│   └── Info.plist
```

Data folder location on macOS:
```
~/Library/Application Support/Jarvis/data/
├── music/
├── music-library.json
├── jarvis-status.json
└── settings.json
```

## Supported macOS Versions

- macOS 10.13+
- Intel and Apple Silicon (M1/M2/M3) support

## Troubleshooting

### "npm: command not found"
Install Node.js from https://nodejs.org/

### "electron-builder: command not found"
Run `npm install` first to install dependencies

### Build fails with code signing
```bash
# Disable code signing for testing
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run dist:mac
```

### App won't run
Check System Preferences → Security & Privacy → allow Jarvis to run

## Files Needed in Release

For macOS v0.4.0 release, include:
- `Jarvis-0.4.0.dmg` (installer, ~100 MB)
- `Jarvis-0.4.0.zip` (portable, ~100 MB)
- `Jarvis-0.4.0-Mac-Bundle.zip` (with music, ~128 MB)

## Creating macOS Release on GitHub

```bash
# After building on Mac
gh release create v0.4.0-mac \
  release/Jarvis-0.4.0.dmg \
  release/Jarvis-0.4.0.zip \
  Jarvis-0.4.0-Mac-Bundle.zip \
  --title "v0.4.0 for macOS" \
  --notes "macOS version with bundled music library"
```

## Next Steps

1. Set up a Mac machine or GitHub Actions
2. Build using `npm run dist:mac`
3. Test the built app
4. Create GitHub release with DMG/ZIP files
5. Update README with macOS download link

## Support

For issues building on macOS:
- Check electron-builder docs: https://www.electron.build/
- File GitHub issue with build error output
- Include: macOS version, Node version, npm version

---

**Note:** Currently on Windows, so macOS build must be done on macOS or via CI/CD.
