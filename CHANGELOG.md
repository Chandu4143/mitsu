# Changelog

All notable changes to Mitsu are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.2.0] - 2026-10-30

### Added

- Tauri v2 desktop shell for Windows (`src-tauri/`) with a per-user NSIS installer.
- PyInstaller backend sidecar that the Rust shell starts on a free loopback port and stops with the app.
- Signed auto-updates through the Tauri updater and GitHub Releases.
- `pnpm desktop:dev`, `pnpm desktop:build`, `pnpm sidecar`, and `pnpm screenshots:desktop` scripts.
- Desktop screenshots in the README, captured from the packaged app.
- Discover now pages through nhentai results with total counts, load-more and infinite scroll, sort options (recent, popular, this week, this month), a language filter, and favorite counts.
- Discover marks results already in the library and links straight to them instead of offering a duplicate import.
- nhentai imports now keep their tags, artists, language, and alternate title, so imported galleries are searchable locally by tag or artist.

### Changed

- Gallery, reader, and collection detail views now read their id from the query string (`/gallery?id=…`, `/reader?id=…`, `/collection?id=…`) so the same UI can ship as a static desktop bundle. Web routes changed accordingly.
- `pnpm build:desktop` produces the static export used by Tauri; `pnpm build` keeps the server build used by Docker.
- The API accepts the Tauri webview origins (`http://tauri.localhost`, `tauri://localhost`).
- Desktop links to other sites open in the default browser; the shell no longer navigates away from the app.
- Opening the desktop app a second time focuses the existing window instead of starting another backend.
- An update found by the launch check now also appears in Settings → Desktop app.
- Library search filters as you type, and nhentai requests are debounced, cached for 90 seconds, and reused through one Cloudflare-aware session.
- Remote browse shows recently uploaded galleries even without a query.

### Fixed

- Remote gallery covers load inside the desktop app (the CSP now permits `https:` images).
- Collection rename and delete use in-app dialogs; the shell's asynchronous `confirm()` override no longer skips the confirmation or ignores renames.
- `/gallery`, `/collection`, and `/reader` without an id show a useful empty state instead of a blank page.
- The library and collections navigation entries stay highlighted on detail pages.
- A backend that fails to start is reported in the window instead of leaving every page broken.
- nhentai rate limits (HTTP 429) and provider failures now show an actionable message with a retry instead of an empty result grid.
- A single unreadable page no longer replaces the reader; that page shows a retry control while the rest of the gallery stays readable.
- The README release steps list every file whose version must match.

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
