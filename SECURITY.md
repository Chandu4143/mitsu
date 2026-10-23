# Security Policy

## Supported versions

Security fixes are applied to the latest release on the default branch.

## Reporting a vulnerability

Please do not open a public issue for a suspected security vulnerability.

Report it privately to the maintainer through GitHub's private vulnerability reporting feature, or by email if a contact address is listed on the maintainer's GitHub profile.

Include:

- A description of the issue
- Steps to reproduce
- The affected version or commit
- Any suggested mitigation

You can expect an initial response within 7 days. Please allow reasonable time for a fix before public disclosure.

## Scope

Mitsu is a local-first application. Library data, thumbnails, and the SQLite database are stored on the user's machine. Online discovery features send requests only to the configured external source.
