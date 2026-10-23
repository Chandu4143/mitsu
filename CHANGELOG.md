# Changelog

All notable changes to Mitsu are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- Reworked the interface as a mobile-first, iOS-style experience with a bottom tab bar, “More” bottom sheet, and desktop rail.
- Improved the library, gallery, collections, imports, settings, discover, and reader layouts for small and large screens.
- Replaced mobile dialogs with bottom sheets and added safe-area handling.
- Removed `any` from the typed API client.
- Added a screenshot capture script with cover blurring and path redaction.

### Added

- `pnpm typecheck` and `pnpm screenshots` scripts.
- Contribution, conduct, security, and changelog documentation.
- Basic backend smoke tests and CI workflow.

### Fixed

- Desktop gallery layout and library toolbar behavior.
- Reader footer clipping in continuous mode.
- Duplicate mobile/desktop action buttons.
