# Brother QL Web - GitHub Copilot Instructions

Brother QL Web is a TypeScript monorepo containing a WebUSB library for Brother QL-700 label printers and a React camera-to-printer web application.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Repository Structure
- **Root**: PNPM workspace with corepack configuration
- **packages/brother-ql-web**: WebUSB library for Brother QL-700 printers (`@proeftuin/brother-ql-web`)
- **apps/stickerbooth**: React+TypeScript+Vite camera-to-printer SPA

## Working Effectively

### Initial Setup (CRITICAL - Required for all operations)
```bash
# Enable pnpm via corepack (required first step)
corepack enable
corepack prepare pnpm@10.14.0 --activate
pnpm --version  # Should show 10.14.0

# Install dependencies - NEVER CANCEL: Takes ~25 seconds
pnpm install --frozen-lockfile
```

### Building and Testing
```bash
# Build library - NEVER CANCEL: Takes ~1 second. Set timeout to 60+ seconds
pnpm --filter @proeftuin/brother-ql-web build

# Test library - NEVER CANCEL: Takes ~3 seconds. Set timeout to 60+ seconds
pnpm --filter @proeftuin/brother-ql-web test

# Build stickerbooth app - NEVER CANCEL: Takes ~5 seconds. Set timeout to 120+ seconds  
pnpm --filter stickerbooth build

# Lint stickerbooth (currently fails with type issues - see Known Issues)
pnpm --filter stickerbooth lint
```

### Development Servers
```bash
# Run stickerbooth app dev server (React camera app)
pnpm --filter stickerbooth dev --host
# Accessible at http://localhost:5173

# Run library demo dev server
pnpm --filter @proeftuin/brother-ql-web dev --host  
# Accessible at http://localhost:5173 (different port when both running)
```

## Critical Technical Requirements

### WebUSB Context Requirements
- **MUST serve over HTTPS or localhost** - WebUSB requires secure context
- **Chrome/Edge browsers only** - WebUSB not supported in Firefox/Safari
- **User gesture required** - USB device selection requires user interaction
- **Linux considerations**: May need to detach `usblp` kernel driver for device access

### Hardware Dependencies
- Brother QL-700 label printer (primary target)
- USB connection to printer
- Camera for stickerbooth app functionality

## Validation Scenarios

### Always Test After Changes
1. **Build validation**:
   ```bash
   # Quick validation pipeline (takes ~8 seconds total)
   pnpm --filter @proeftuin/brother-ql-web build && pnpm --filter @proeftuin/brother-ql-web test && pnpm --filter stickerbooth build
   ```

2. **Library functionality** (requires printer hardware):
   - Connect flow: Call `connect()` and verify PrinterStatus response
   - Preview generation: Test `getPreviewImage()` with sample image  
   - Print flow: Test `printColorImage()` with cut settings

3. **Stickerbooth app** (requires camera + printer):
   - USB connection flow (big green "Connect printer" button)
   - Camera permission grant/deny scenarios
   - Video preview display with camera feed
   - Capture and print workflow (red shutter button)
   - Error handling for missing hardware

4. **Cross-browser testing**:
   - Chrome desktop (Linux/Windows/macOS)
   - Edge desktop
   - Chrome Android (WebUSB behavior varies)

## Known Issues and Workarounds

### Current Linting Failures
The stickerbooth app currently has linting issues:
- 8 TypeScript errors (mainly `@typescript-eslint/no-explicit-any`)
- 1 React hooks warning (`react-hooks/exhaustive-deps`)
- Empty block statements (`no-empty`)

**Do not fix these during unrelated changes** - they are existing technical debt.

### Linux USB Access
On Linux systems, the browser may fail to claim USB interface if `usblp` driver is active:
```bash
# Check if usblp is loaded
lsmod | grep usblp

# If needed, add udev rules or detach driver
# (Hardware-specific troubleshooting required)
```

## Package-Specific Details

### @proeftuin/brother-ql-web Library
- **Build time**: ~550ms (TypeScript + Vite)
- **Test suite**: 5 tests covering status parsing, commands, and image processing
- **Test time**: ~1.7 seconds (3 test files)
- **Key APIs**: `connect()`, `getPreviewImage()`, `printColorImage()`, `printDitheredImage()`, `printLines()`

### Stickerbooth App  
- **Build time**: ~5 seconds (TypeScript + React + Vite)
- **Dev dependencies**: React 19, TypeScript ~5.8.3, Vite 7.1.3
- **Key features**: Camera capture, USB printer connection, live preview
- **Workspace dependency**: Uses `@proeftuin/brother-ql-web` via workspace protocol

## GitHub Actions Pipeline

The deploy workflow (`deploy-stickerbooth.yml`):
1. Builds library first: `pnpm --filter @proeftuin/brother-ql-web build`
2. Builds app with dist library: `DEPLOY_USE_DIST=1 pnpm --filter stickerbooth build`
3. Deploys to GitHub Pages

**Always ensure both packages build successfully** before pushing to master.

## Common Commands Reference

```bash
# Quick validation pipeline (run before any PR) - Takes ~8 seconds total
pnpm install --frozen-lockfile
pnpm --filter @proeftuin/brother-ql-web build && pnpm --filter @proeftuin/brother-ql-web test && pnpm --filter stickerbooth build

# Development workflow
pnpm --filter stickerbooth dev --host  # React app with HMR
pnpm --filter @proeftuin/brother-ql-web dev --host  # Library demo

# Type checking (from VSCode tasks)
pnpm exec tsc -p packages/brother-ql-web/tsconfig.json --noEmit
```

## File Locations

### Frequently Modified Files
- `packages/brother-ql-web/src/index.ts` - Library main exports
- `packages/brother-ql-web/src/core/` - USB commands, status parsing, image processing
- `apps/stickerbooth/src/App.tsx` - Main app component
- `apps/stickerbooth/src/views/` - ConnectView, CameraView components
- `apps/stickerbooth/src/hooks/useCamera.ts` - Camera management hook

### Configuration Files
- `pnpm-workspace.yaml` - Workspace definition
- `packages/brother-ql-web/vite.config.ts` - Library build config
- `apps/stickerbooth/vite.config.ts` - App build + dev server config
- `.github/workflows/deploy-stickerbooth.yml` - CI/CD pipeline

## Error Handling Patterns

### USB Connection Errors
- Device not found: User must click "Connect" and select printer
- Permission denied: Check browser WebUSB support and secure context
- Interface claim failed: Linux `usblp` driver conflict

### Camera Errors
- Permission denied: Handle gracefully with error UI
- Device not found: Fallback messaging for devices without camera
- Constraints not satisfied: Reduce resolution/framerate requirements

Always wrap WebUSB and MediaDevices calls in try-catch blocks and provide user-friendly error messages.