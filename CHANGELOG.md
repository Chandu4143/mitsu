# Changelog

All notable changes to Mitsu are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.0] - 2026-10-27

### Added

- Versioned release archives: `pnpm package` (or `python scripts/package.py`) writes `dist/mitsu-<version>.zip` and a SHA-256 checksum.
- Tag-driven release workflow that publishes a multi-arch container image to GHCR and attaches the archive to the GitHub release.
- Virtualized continuous scrolling in the reader: only the pages around you are mounted, so very long galleries stay fast and memory-flat.
- Double-page spreads, zoom and pan (wheel, pinch, and keys), bookmarks with notes, and a keyboard-shortcut sheet in the reader.
- Reading history grouped by day, plus reading/completed/bookmark counts on the home screen and in settings.
- Light, dark, and system appearance with a no-flash boot script and a mobile-aware theme toggle.
- Installable PWA: web app manifest, icons, offline page, and a service worker that caches the shell and pages you have already read.
- Portable backup and restore from **Settings**, including managed library files and timestamped safety copies.
- Maintenance tools: cover rebuild jobs, duplicate detection, and “set cover from page” on gallery pages.
- Backup, bookmark, cover, history, stats, metadata, duplicate, and job tests.
- `pnpm typecheck` and `pnpm screenshots` scripts.
- Docker Compose, cross-platform install scripts, and `run.py --prod` with browser auto-open.
- Contribution, conduct, security, and changelog documentation.
- Basic backend smoke tests and CI workflow.
- First-run onboarding on an empty library, with import, reading, and backup guidance.

### Changed

- Reworked the interface as a mobile-first, iOS-style experience with a bottom tab bar, “More” bottom sheet, and desktop rail.
- Improved the library, gallery, collections, imports, settings, discover, and reader layouts for small and large screens.
- Replaced mobile dialogs with bottom sheets and added safe-area handling.
- Removed `any` from the typed API client.
- Added a screenshot capture script with cover blurring and path redaction.
- Settings now groups reader, appearance, backup, maintenance, and storage controls.

### Fixed

- Desktop gallery layout and library toolbar behavior.
- Reader footer clipping in continuous mode.
- Duplicate mobile/desktop action buttons.
- Backup export no longer leaves the SQLite snapshot open on Windows.
- Reader navigation no longer resets zoom through a render-triggering effect.
