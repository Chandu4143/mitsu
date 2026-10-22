# Mitsu — Final Product & Engineering Specification

# Mitsu

PRD + Technical Design + API Contract + QA Plan

Implementation-ready draft

v1.0

Mitsu is a Peach-inspired, local-first manga library and reader with optional online metadata discovery and a pluggable download-provider integration.

The following specification fixes the product decisions, defines MVP boundaries, and gives a development team a concrete contract for implementation.

## 1. Product decisions — locked for v1

| Decision             | Final specification                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------- |
| Deployment           | Local web app, accessed through a browser on the user's computer                         |
| Metadata             | Hybrid: local metadata plus optional remote lookup                                       |
| Reader               | Single-page mode and continuous-scroll mode                                              |
| Visual style         | Peach-inspired pastel UI with a modern, polished finish                                  |
| Provider integration | Optional adapter, implemented only after compatibility and permitted access are verified |
| Backend              | Python + FastAPI                                                                         |
| Frontend             | React + TypeScript                                                                       |
| Database             | SQLite                                                                                   |
| Storage              | Local filesystem                                                                         |
| Initial user model   | Single-user, local-first                                                                 |
| MVP priority         | Import, browse, search, read, organize, resume                                           |

### Product principle

Mitsu must remain fully useful without an internet connection or external provider.

Online discovery enriches the library; it does not own the library. A provider outage must never prevent users from browsing or reading already imported content.

## 2. Product scope

MVP — must ship

Local folder and archive imports, cover grid, gallery details, search and filtering, favorites, collections, reading progress, dual reader modes, metadata editing, and basic import-job status.

MVP if time permits / next release

Online metadata lookup, thumbnail regeneration, advanced duplicate detection, configurable import rules, and optional provider adapter.

Out of scope for v1

Public hosting, social features, multi-user accounts, cloud synchronization, AI image analysis, mobile-native apps, and any integration requiring bypassing access controls.

## 3. User experience specification

### 3.1 Visual design

The interface should feel warm, approachable, and curated — not like an administrative dashboard.

## mitsu.

your little reading corner

A LITTLE SPACE FOR YOUR COLLECTION

# Welcome back.

Pick up where you left off, or discover something new.

Open library

Import files

### Continue reading

VIEW ALL

[The Girl with the Sanpaku Eyes, Volume 4 - Sorato Shunsuke: 9781634428194 - AbeBooks](https://images.openai.com/static-rsc-4/NlYeOHgW3f4IASizPChBsIev6i1xTLhkYwV6kZKY0E3LMD28JIATQ_cMPnikXihVUD-f6WN0obG6lWhwUcXhDqZuxNfvfBA72pA6yWKZC_ETOmCJb2HlZCpCRNogO6WpIla9_aZuGsGXNtN6awuzS7kD9siV7pcqJddwEg06U9E?purpose=inline)

Recently opened

Resume reading

[Sayonara Letter - Manga - Manga news](https://images.openai.com/static-rsc-4/z4yhelr6qIIVTK3vs21wi4Yp-u6RZbiM5nJ4f9xhUGVPWo6ZmoE_oOeRtBDcBoN3a7ZPB790dj6M_TZVffIBnJIzf-6Ecq90d2pS2uyhaHo94B60hKG96xydIZps4BBthDRjdv8OiOFxvtmhmWy8OTF1-AWXJOPU3GvIr2J1M7M?purpose=inline)

Your favorites

Saved for later

[Peachy wave mobile wallpaper vector | Premium Vector  - rawpixel](https://images.openai.com/static-rsc-4/CGWh5Y6o1LPGcRqaKecZUwqUIiI9OYBxenZ5IYuG4M0ZblHSVxXlHVa-WSWiPfPqukH6O2TQ5DGP_1GxSJg5RyU9PiewwqixnfK1YV1P3_L9izNN87bxCh8L3eT1ve3doIBphqguIUe5nqr53osWEk2-l4ibMb_AIVi8ovMcBeU?purpose=inline)

Recently added

Explore your library

Illustrative design concept; gallery images and labels are placeholders.

Design tokens

| Token           | Proposed value                       |
| --------------- | ------------------------------------ |
| Main background | `#FFF7FA`                            |
| Surface         | `#FFFFFF`                            |
| Primary accent  | `#B9698D`                            |
| Soft accent     | `#F4E3EB`                            |
| Main text       | `#463440`                            |
| Secondary text  | `#956A7D`                            |
| Border          | `#EBDCE3`                            |
| Radius          | 12–18 px                             |
| Spacing scale   | 4 px base                            |
| Typography      | Inter or another readable sans-serif |

Use the colors as initial design tokens, then validate contrast and accessibility. Provide a darker reader background independently of the pastel library theme.

### 3.2 Main routes

| Route              | Purpose                                    |
| ------------------ | ------------------------------------------ |
| `/`                | Home dashboard                             |
| `/library`         | Searchable gallery library                 |
| `/gallery/:id`     | Gallery details                            |
| `/reader/:id`      | Reader                                     |
| `/collections`     | User-defined collections                   |
| `/collections/:id` | Collection contents                        |
| `/discover`        | Online and local metadata discovery        |
| `/imports`         | Import history and active jobs             |
| `/settings`        | Storage, metadata sources, and preferences |

### 3.3 Global interaction requirements

- The global search is available from the main navigation.
- Gallery cards expose Open, Favorite, and Add to Collection actions.
- Loading states use skeletons; empty states offer a relevant next action.
- Destructive actions require confirmation.
- The app never silently deletes original files when a user removes a gallery from the index.
- All primary operations are usable by keyboard.
- At narrower widths, the sidebar collapses into a navigation drawer.

## 4. Prioritized epics and user stories

Effort estimates below are planning estimates in developer-days, not guaranteed delivery dates. A developer-day means one day of focused engineering work.

| Epic                               | Priority | Estimate  |
| ---------------------------------- | -------- | --------- |
| E1 — Project foundation            | P0       | 3–5 days  |
| E2 — Local import and indexing     | P0       | 4–6 days  |
| E3 — Library and search            | P0       | 4–5 days  |
| E4 — Reader and progress           | P0       | 4–6 days  |
| E5 — Favorites and collections     | P0       | 2–3 days  |
| E6 — Metadata enrichment           | P1       | 3–5 days  |
| E7 — Import job management         | P1       | 2–4 days  |
| E8 — Optional provider integration | P2       | 3–6+ days |
| E9 — Security, packaging and QA    | P0       | 3–5 days  |

Estimated MVP total: approximately 22–34 developer-days for one experienced full-stack developer, excluding uncertain provider integration and significant design revisions. Some tasks can overlap.

### E1 — Project foundation

US-101: Start Mitsu locally

As a user, I want to start Mitsu on my computer and access it through a browser.

Acceptance criteria:

- A documented command starts the frontend and backend.
- The backend creates or migrates the SQLite database.
- The UI shows a helpful setup state when no library is configured.
- The backend binds to localhost by default.
- Configuration and database paths are configurable.
- A restart preserves settings and existing records.

US-102: Configure a library root

- The user can configure an existing library directory.
- The path is validated before indexing begins.
- Invalid or inaccessible directories produce actionable errors.
- The app does not scan arbitrary filesystem paths without explicit configuration.

### E2 — Local import and indexing

US-201: Import a folder or archive

As a collector, I want to import existing galleries without manually creating every record.

Acceptance criteria:

- Supported inputs include image folders and CBZ/ZIP archives.
- Supported image formats include JPEG, PNG, and WebP; GIF support is optional.
- Files are sorted deterministically using natural filename ordering, with a documented override for reading order.
- The system extracts available metadata and computes a stable internal gallery ID.
- Unsupported files are reported without aborting the entire import batch.
- A repeated import does not duplicate a gallery when a reliable identifier or fingerprint matches.
- Original files are not moved or deleted by default.

US-202: Generate covers and thumbnails

- The first suitable page can be used as the default cover.
- Thumbnail generation runs outside the request-response path.
- Corrupt images create a warning rather than crashing the indexer.
- Generated thumbnails are cached separately from original files.
- Thumbnails can be regenerated if missing or invalid.

US-203: Recover from interrupted imports

- Every import has a persistent job record.
- The UI can display queued, running, completed, partially completed, and failed states.
- Restarting the backend recovers interrupted work safely.
- Retrying an import is idempotent where possible.
- Progress is based on completed work units, not an arbitrary animation.

### E3 — Library and search

US-301: Browse the library

- Users can switch between grid and list views.
- Cards show cover, title, page count when known, and reading status.
- Sorting includes title, date added, last opened, and page count.
- Library results are paginated.
- Missing files are clearly marked.

US-302: Search and filter

- Search supports title, alternate title, tags, artists, language, and external ID where present.
- Search is case-insensitive.
- Filters can be combined.
- Sorting and filters survive navigation within the library.
- An empty result set provides a clear reset-filters action.
- Query inputs are parameterized; search must not execute arbitrary SQL.

US-303: Manage gallery metadata

- Users can edit title, alternate title, language, and tags.
- User edits are not silently overwritten by remote metadata refreshes.
- Imported metadata and user overrides remain distinguishable.
- Invalid metadata values are rejected with field-level errors.

### E4 — Reader and progress

US-401: Read a gallery

- The reader opens supported images in the correct order.
- Single-page and continuous-scroll modes are available.
- The user can navigate with keyboard shortcuts and visible controls.
- The reader supports fit-to-width and fit-to-screen.
- Full-screen mode is available where supported by the browser.
- Loading or corrupt pages show a recoverable error state.

US-402: Resume reading

- Progress is saved when the current page changes, with debouncing to avoid excessive writes.
- Progress is also saved on explicit navigation away when feasible.
- The app restores the most recent page after reopening the gallery.
- Progress records are valid for the current page count.
- Reordering or removing pages does not cause an out-of-range page index.

US-403: Configure reader preferences

- The user can select single-page or continuous-scroll mode.
- Reading direction and reader background can be configured.
- Preferences persist across sessions.
- Keyboard shortcuts do not interfere with typing into inputs.
- Touch navigation works on supported mobile browsers.

### E5 — Favorites and collections

US-501: Favorite a gallery

- Favorite state can be toggled from a card and detail page.
- The state persists after a restart.
- The library can be filtered to favorites.

US-502: Create and edit collections

- Users can create, rename, and delete collections.
- A gallery can belong to multiple collections.
- Items can be reordered within a collection.
- Deleting a collection does not delete its galleries or original files.
- Duplicate membership is prevented.

### E6 — Hybrid metadata and discovery

US-601: Enrich metadata

- The user can request a lookup for a gallery with a known source identifier.
- Provider responses are validated before being stored.
- The user can preview changes before applying them.
- Missing fields can be filled without overwriting user edits.
- Remote lookup failure does not affect existing metadata or local reading.
- Results include provenance and retrieval time.

US-602: Discover available items

- Local search works without a network connection.
- Remote discovery is displayed separately from local library items.
- Remote results are not treated as downloaded or available locally until imported.
- The UI identifies the source of each result.
- Unavailable sources show a retry or disable state, not a broken page.

### E7 — Import job management

US-701: Track background jobs

- Jobs have stable IDs, status, timestamps, progress, and structured error details.
- The UI polls or otherwise refreshes job status at a reasonable interval.
- Completed and failed jobs remain inspectable.
- Retry is available only for retryable failures.
- Cancelling a job stops future work safely; partially imported records remain consistent.

### E8 — Optional provider integration

US-801: Configure a provider

- The app can enable or disable each provider independently.
- A provider is not enabled by default unless configured and verified.
- The adapter declares its capabilities, such as metadata lookup or permitted archive retrieval.
- Unsupported operations return a structured error.
- Provider failure does not break core library features.

US-802: Retrieve and validate an archive

- The requested identifier or URL is validated.
- The operation follows the provider's permitted interface and applicable terms.
- Downloaded data is written to a temporary file first.
- Archive integrity and resource limits are checked before import.
- Incomplete files are not presented as completed galleries.
- The provider can be removed without schema changes to the core library.

### E9 — Security, packaging and QA

US-901: Protect local files

- File-serving endpoints resolve paths within configured library roots.
- Archive extraction rejects path traversal and unsafe entries.
- Resource limits apply to archive size, extracted size, entry count, and image dimensions.
- Network binding is localhost-only by default.
- External network exposure is documented as requiring appropriate authentication and access controls.

US-902: Back up and restore

- A documented backup includes the database, configuration, and generated metadata needed for restoration.
- Original gallery files are backed up separately or explicitly included.
- Restore is tested on a clean installation.
- Database migrations preserve existing records.

## 5. System architecture

Use a modular monolith for v1. This keeps deployment simple while separating the reader, importer, metadata sources, and provider integration at the code level.

\#chatgpt-mermaid-\_r_1at\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(13, 13, 13);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_1at\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_1at\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_1at\_ .error-icon{fill:rgb(243, 243, 243);}#chatgpt-mermaid-\_r_1at\_ .error-text{fill:rgb(13, 13, 13);stroke:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_1at\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_1at\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_1at\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_1at\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_1at\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_1at\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_1at\_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_1at\_ .marker.cross{stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_1at\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_1at\_ p{margin:0;}#chatgpt-mermaid-\_r_1at\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_1at\_ .cluster-label text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_1at\_ .cluster-label span{color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_1at\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_1at\_ .label text,#chatgpt-mermaid-\_r_1at\_ span{fill:rgb(13, 13, 13);color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_1at\_ .node rect,#chatgpt-mermaid-\_r_1at\_ .node circle,#chatgpt-mermaid-\_r_1at\_ .node ellipse,#chatgpt-mermaid-\_r_1at\_ .node polygon,#chatgpt-mermaid-\_r_1at\_ .node path{fill:rgb(222, 234, 251);stroke:rgb(83, 154, 248);stroke-width:1px;}#chatgpt-mermaid-\_r_1at\_ .rough-node .label text,#chatgpt-mermaid-\_r_1at\_ .node .label text,#chatgpt-mermaid-\_r_1at\_ .image-shape .label,#chatgpt-mermaid-\_r_1at\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_1at\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_1at\_ .rough-node .label,#chatgpt-mermaid-\_r_1at\_ .node .label,#chatgpt-mermaid-\_r_1at\_ .image-shape .label,#chatgpt-mermaid-\_r_1at\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_1at\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_1at\_ .root .anchor path{fill:rgb(143, 143, 143)!important;stroke-width:0;stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_1at\_ .arrowheadPath{fill:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_1at\_ .edgePath .path{stroke:rgb(143, 143, 143);stroke-width:1px;}#chatgpt-mermaid-\_r_1at\_ .flowchart-link{stroke:rgb(143, 143, 143);fill:none;}#chatgpt-mermaid-\_r_1at\_ .edgeLabel{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-\_r_1at\_ .edgeLabel p{background-color:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_1at\_ .edgeLabel rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_1at\_ .labelBkg{background-color:rgba(252, 252, 252, 0.5);}#chatgpt-mermaid-\_r_1at\_ .cluster rect{fill:rgb(243, 243, 243);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_1at\_ .cluster text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_1at\_ .cluster span{color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_1at\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(243, 243, 243);border:1px solid rgba(0, 0, 0, 0.1);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_1at\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_1at\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_1at\_ .icon-shape,#chatgpt-mermaid-\_r_1at\_ .image-shape{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-\_r_1at\_ .icon-shape p,#chatgpt-mermaid-\_r_1at\_ .image-shape p{background-color:rgb(252, 252, 252);padding:2px;}#chatgpt-mermaid-\_r_1at\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_1at\_ .image-shape .label rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_1at\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_1at\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_1at\_ .node .neo-node{stroke:rgb(83, 154, 248);}#chatgpt-mermaid-\_r_1at\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_1at\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_1at\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_1at\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1at\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_1at\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_1at\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_1at\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1at\_ [data-look="neo"].node .neo-line path{stroke:rgb(83, 154, 248);filter:none;}#chatgpt-mermaid-\_r_1at\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_1at\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1at\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_1at\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_1at\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1at\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_1at\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1at\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(0, 79, 153);}#chatgpt-mermaid-\_r_1at\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(0, 79, 153);}#chatgpt-mermaid-\_r_1at\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_1at\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_1at\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-width:1px;}#chatgpt-mermaid-\_r_1at\_ .node rect,#chatgpt-mermaid-\_r_1at\_ .node circle,#chatgpt-mermaid-\_r_1at\_ .node ellipse,#chatgpt-mermaid-\_r_1at\_ .node polygon,#chatgpt-mermaid-\_r_1at\_ .node path{fill:rgb(229, 243, 255);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_1at\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_1at\_ .node.mermaid-decision .label-container{fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_1at\_ .edgePaths .flowchart-link{stroke:rgb(143, 143, 143);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_1at\_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_1at\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}React + TypeScript UIFastAPI REST APISQLiteLibrary ServiceReader ServicePersistent Job ServiceConfigured Local FilesImport and Thumbnail WorkersMetadata Provider InterfaceLocal MetadataOptional Remote SourcesOptional Download Adapter

### 5.1 Repository layout

```
mitsu/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── dashboard/
│   │   │   ├── library/
│   │   │   ├── reader/
│   │   │   ├── collections/
│   │   │   ├── imports/
│   │   │   └── settings/
│   │   ├── api/
│   │   ├── hooks/
│   │   └── styles/
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── api/v1/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── imports/
│   │   ├── reader/
│   │   ├── metadata/
│   │   ├── providers/
│   │   └── jobs/
│   ├── migrations/
│   └── tests/
├── data/
│   ├── database/
│   ├── thumbnails/
│   └── cache/
├── docker-compose.yml
└── README.md
```

### 5.2 Technology requirements

| Component        | Decision                                                    |
| ---------------- | ----------------------------------------------------------- |
| Frontend         | React, TypeScript, Vite                                     |
| Routing          | React Router                                                |
| Styling          | Tailwind CSS with Mitsu design tokens                       |
| Server state     | TanStack Query or equivalent                                |
| Backend          | FastAPI with Pydantic validation                            |
| Persistence      | SQLAlchemy and SQLite                                       |
| Migrations       | Alembic                                                     |
| Background jobs  | SQLite-backed persistent job queue for the single-user MVP  |
| Image processing | Pillow with file and pixel-count limits                     |
| Archive handling | Python standard `zipfile` with explicit security validation |
| Backend tests    | Pytest                                                      |
| Frontend tests   | Vitest and React Testing Library                            |
| Browser tests    | Playwright                                                  |

Pin dependency versions and commit a lockfile. Avoid adding Redis or a separate job broker until actual concurrency requirements justify it.

### 5.3 Background job execution

The importer and thumbnail generator must not run synchronously inside API requests.

For v1:

1. An API request creates a job record and returns its ID.
2. A worker claims the job using a database transaction.
3. The worker performs bounded units of work.
4. It persists progress and status changes.
5. On restart, stale running jobs are reconciled and safely retried or marked failed.

Do not run two workers against the same job unless job claiming and locking are implemented correctly. Use temporary files and atomic renames for generated outputs.

## 6. Database schema

Use UUIDs or another stable internal identifier for galleries and jobs. The examples below use UUID strings for clarity.

### 6.1 Core entities

| Table              | Key columns and constraints                                                                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `library_roots`    | `id`, `path`, `created_at`, `is_enabled`; normalized path unique                                                                                                                              |
| `galleries`        | `id`, `root_id`, `relative_path`, `title`, `alternate_title`, `language`, `page_count`, `cover_path`, `source_id`, `external_id`, `file_size`, `content_hash`, `date_added`, `last_opened_at` |
| `gallery_pages`    | `id`, `gallery_id`, `page_index`, `relative_path`, `mime_type`, `width`, `height`; unique `(gallery_id, page_index)`                                                                          |
| `tags`             | `id`, `name`, `normalized_name`, `category`; unique `(normalized_name, category)`                                                                                                             |
| `gallery_tags`     | `gallery_id`, `tag_id`, `source`, `is_user_override`; unique `(gallery_id, tag_id, source)` as appropriate to provenance rules                                                                |
| `artists`          | `id`, `name`, `normalized_name`                                                                                                                                                               |
| `gallery_artists`  | `gallery_id`, `artist_id`, `source`                                                                                                                                                           |
| `reading_progress` | `gallery_id` unique, `current_page`, `status`, `updated_at`, `completed_at`                                                                                                                   |
| `favorites`        | `gallery_id` primary key, `created_at`                                                                                                                                                        |
| `collections`      | `id`, `name`, `description`, `created_at`, `updated_at`                                                                                                                                       |
| `collection_items` | `collection_id`, `gallery_id`, `sort_order`; composite primary key                                                                                                                            |
| `metadata_records` | `id`, `gallery_id`, `source_id`, `external_id`, `payload_json`, `fetched_at`, `content_hash`                                                                                                  |
| `jobs`             | `id`, `type`, `status`, `progress_current`, `progress_total`, `error_code`, `error_message`, `created_at`, `updated_at`, `started_at`, `finished_at`                                          |
| `app_settings`     | `key` primary key, `value_json`, `updated_at`                                                                                                                                                 |

### 6.2 Data integrity rules

- Enable SQLite foreign keys.
- Use transactions for related gallery, page, tag, and progress changes.
- Use cascading deletion for dependent database rows only when explicitly intended.
- Keep source files independent from database record deletion.
- Store paths relative to a configured root where possible.
- Validate page indices against `page_count`.
- Use UTC timestamps in storage and convert to local time in the UI.
- Use a migration for every schema change.
- Keep remote metadata provenance distinct from user-authored values.
- Index normalized titles, external IDs, tags, artist names, and reading status.

### 6.3 Search strategy

Start with indexed SQL queries and case-insensitive matching. Use SQLite FTS5 if available in the deployment environment for full-text title and tag search.

Do not require FTS5 for basic library operation; provide a tested fallback.

## 7. API contract

All API routes are prefixed with `/api/v1`.

Use JSON for request and response bodies, except for streamed image/page content. IDs are strings. Errors use a consistent schema:

```
{
  "error": {
    "code": "GALLERY_NOT_FOUND",
    "message": "The requested gallery was not found.",
    "details": {}
  }
}
```

### 7.1 Gallery endpoints

| Method and route                                 | Request                                                                                    | Success                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `GET /galleries`                                 | Query: `q`, `tag`, `artist`, `language`, `status`, `favorite`, `sort`, `page`, `page_size` | `200` paginated gallery list              |
| `GET /galleries/{id}`                            | Path ID                                                                                    | `200` gallery details; `404` if missing   |
| `PATCH /galleries/{id}`                          | Editable title, alternate title, language, user tags                                       | `200` updated gallery                     |
| `DELETE /galleries/{id}`                         | Path ID and explicit index-removal confirmation                                            | `204`; original files retained by default |
| `GET /galleries/{id}/pages`                      | Path ID                                                                                    | `200` ordered page list                   |
| `GET /galleries/{id}/pages/{page_index}/content` | Path ID and zero-based page index                                                          | `200` streamed image                      |
| `GET /galleries/{id}/cover`                      | Path ID                                                                                    | `200` thumbnail or cover image            |

Example list response:

```
{
  "items": [
    {
      "id": "gallery-uuid",
      "title": "Example title",
      "page_count": 24,
      "language": "unknown",
      "favorite": false,
      "reading_status": "unread"
    }
  ],
  "page": 1,
  "page_size": 40,
  "total": 1
}
```

The example uses placeholder data and is a schema illustration, not a real gallery record.

### 7.2 Import endpoints

| Method and route                | Purpose                                                  |
| ------------------------------- | -------------------------------------------------------- |
| `POST /imports`                 | Start an import from a configured root or permitted path |
| `GET /imports`                  | List import jobs                                         |
| `GET /imports/{job_id}`         | Get status and progress                                  |
| `POST /imports/{job_id}/retry`  | Retry a recoverable job                                  |
| `POST /imports/{job_id}/cancel` | Request cancellation                                     |

Example request:

```
{
  "root_id": "root-uuid",
  "relative_path": "manga/example.cbz",
  "mode": "index"
}
```

Do not accept arbitrary filesystem paths without validating them against configured roots. An import should return `202 Accepted` with a job identifier when queued.

### 7.3 Reading progress endpoints

| Method and route               | Purpose                      |
| ------------------------------ | ---------------------------- |
| `GET /galleries/{id}/progress` | Retrieve progress            |
| `PUT /galleries/{id}/progress` | Save current page and status |

Request:

```
{
  "current_page": 8,
  "status": "reading"
}
```

Requirements:

- Page indices are zero-based throughout the API.
- `current_page` must be within the valid page range.
- Status is one of `unread`, `reading`, `completed`.
- Repeated updates are idempotent.
- The UI converts page indices to human-friendly page numbers for display.

### 7.4 Favorites and collections

| Method and route                              | Purpose                     |
| --------------------------------------------- | --------------------------- |
| `PUT /galleries/{id}/favorite`                | Set favorite state          |
| `DELETE /galleries/{id}/favorite`             | Remove favorite state       |
| `GET /collections`                            | List collections            |
| `POST /collections`                           | Create a collection         |
| `PATCH /collections/{id}`                     | Rename or edit a collection |
| `DELETE /collections/{id}`                    | Delete a collection only    |
| `POST /collections/{id}/items`                | Add gallery IDs             |
| `DELETE /collections/{id}/items/{gallery_id}` | Remove membership           |
| `PATCH /collections/{id}/items/order`         | Update item ordering        |

Collection membership changes must not alter gallery files or reading progress.

### 7.5 Metadata endpoints

| Method and route                       | Purpose                                   |
| -------------------------------------- | ----------------------------------------- |
| `GET /metadata/sources`                | List configured sources and capabilities  |
| `POST /galleries/{id}/metadata/lookup` | Queue a lookup for a gallery              |
| `GET /metadata/jobs/{job_id}`          | Read lookup status and candidate metadata |
| `POST /metadata/jobs/{job_id}/apply`   | Apply approved metadata changes           |

Remote metadata must be validated and presented as a candidate before overriding user-edited fields.

### 7.6 Provider endpoints

Provider endpoints should only be registered when the optional provider subsystem is enabled.

| Method and route                       | Purpose                                 |
| -------------------------------------- | --------------------------------------- |
| `GET /providers`                       | List enabled providers and capabilities |
| `POST /providers/{provider_id}/jobs`   | Create a supported provider job         |
| `GET /providers/jobs/{job_id}`         | Read provider job status                |
| `POST /providers/jobs/{job_id}/retry`  | Retry an eligible failure               |
| `POST /providers/jobs/{job_id}/cancel` | Cancel a queued or cancellable job      |

The backend must not treat an arbitrary URL as safe to fetch. Provider implementations should validate hosts, redirects, content types, response size, and supported operations.

### 7.7 Standard status codes

- `200 OK` — successful read or update.
- `201 Created` — resource created.
- `202 Accepted` — asynchronous job queued.
- `204 No Content` — successful deletion.
- `400 Bad Request` — invalid operation or parameters.
- `404 Not Found` — missing resource.
- `409 Conflict` — conflicting state or duplicate operation.
- `413 Content Too Large` — request or archive exceeds limits.
- `422 Unprocessable Entity` — schema validation failure.
- `429 Too Many Requests` — throttled operation.
- `500 Internal Server Error` — unexpected error with no sensitive implementation details exposed.

## 8. Frontend and backend contracts

### 8.1 Frontend state management

Use server-state caching for API responses and local component state for transient UI state.

- TanStack Query manages galleries, collections, progress, and job status.
- URL query parameters hold library search, filter, sort, and pagination state.
- Reader preferences are loaded from persistent settings.
- Optimistic updates are allowed for favorites and collection membership, with rollback on API failure.
- The UI must never display a completed import or download before the backend confirms success.

### 8.2 Backend service boundaries

| Service             | Responsibilities                                            |
| ------------------- | ----------------------------------------------------------- |
| `LibraryService`    | Gallery CRUD, filters, sorting, indexing, file availability |
| `ImportService`     | Scanning, archive validation, page discovery, deduplication |
| `ThumbnailService`  | Cover selection, image resizing, cache invalidation         |
| `ReaderService`     | Ordered pages, safe image streaming, reading progress       |
| `CollectionService` | Collection membership and ordering                          |
| `MetadataService`   | Source registry, candidate metadata, provenance and merging |
| `JobService`        | Persistent job lifecycle, retries, cancellation, recovery   |
| `ProviderRegistry`  | Optional provider capabilities and configuration            |

Each service should have unit tests and should not depend directly on HTTP request objects.

### 8.3 Metadata merge policy

Metadata has three possible origins:

1. User edits.
2. Metadata embedded in imported files or folders.
3. Remote metadata providers.

Use field-level provenance, or an equivalent override model, so a remote lookup cannot silently overwrite a user's changes.

Default merge rules:

- User-authored fields always take precedence.
- Missing user fields can be filled from embedded or remote metadata.
- Conflicting remote values are shown as suggestions.
- Each lookup records its source and retrieval time.
- Users can reset an override explicitly.

## 9. Security and operational requirements

These are release blockers, not optional polish.

### Local file safety

- Canonicalize file paths and ensure they remain inside configured roots.
- Reject symbolic links or other filesystem entries that escape allowed roots.
- Validate ZIP entry paths before extraction.
- Block absolute paths, `..` traversal, unsafe symlinks, and suspicious archive structures.
- Apply configurable limits for compressed bytes, extracted bytes, entry count, image dimensions, and processing time.
- Never execute imported content or treat embedded metadata as instructions.
- Avoid loading entire archives or high-resolution images into memory unnecessarily.

### Network safety

- Default to `127.0.0.1`, not `0.0.0.0`.
- Restrict cross-origin requests to the local frontend origin.
- Do not enable unrestricted URL fetching from user-supplied URLs.
- For optional remote providers, defend against server-side request forgery by restricting allowed hosts and validating redirects and resolved IP addresses.
- If remote access is enabled, require appropriate authentication and document the security implications.
- Keep credentials and provider configuration out of logs and browser bundles.

### Data durability

- Use database transactions for state transitions.
- Use atomic file replacement for generated covers and imported downloads.
- Provide a backup and restore procedure.
- Test migrations against an existing database.
- Do not remove source files during routine index cleanup.

## 10. Test plan

The test suite must cover service logic, API behavior, reader functionality, data integrity, and real browser workflows.

Unit tests

Target: all critical service logic and error-handling branches.

Test natural sorting, metadata merging, deduplication, page-index validation, job transitions, archive validation, and path containment.

API integration tests

Target: every endpoint and meaningful failure condition.

Test pagination, invalid inputs, missing files, missing galleries, concurrent progress updates, database constraints, and consistent error responses.

End-to-end tests

Target: every P0 user journey.

Test first-run setup, import, search, open gallery, switch reader modes, save progress, resume, favorite, and create a collection.

Security and recovery tests

Target: no critical or high-severity known issues at release.

Test ZIP traversal, oversized archives, corrupt images, path escapes, unsafe URLs, interrupted imports, backend restarts, and database restore.

### Required test matrix

| Test case                                | Expected result                                  |
| ---------------------------------------- | ------------------------------------------------ |
| Import a valid CBZ                       | Gallery, pages, and cover are indexed            |
| Import same archive twice                | Existing record reused when identity is reliable |
| Import corrupt archive                   | Job fails safely with actionable error           |
| Archive contains `../` path              | Unsafe entry rejected                            |
| Image is corrupt                         | Gallery remains usable if other pages are valid  |
| Library directory is missing             | Clear warning; no crash                          |
| Backend restarts during import           | Job reconciles and resumes or fails safely       |
| Remote provider unavailable              | Local library still works                        |
| Remote metadata conflicts with user edit | User edit remains intact                         |
| Resume a completed gallery               | Reader shows completed status and valid page     |
| Delete collection                        | Gallery records and files remain                 |
| Search contains SQL-like input           | Input is treated as search text                  |
| Request page outside gallery             | `404` or defined validation error                |
| Request file outside library root        | Request rejected                                 |
| Restore backup on clean setup            | Records, settings, and progress restored         |

### CI pipeline

Every pull request should run:

1. Frontend lint and TypeScript checks.
2. Backend lint and type checks.
3. Backend unit and API integration tests.
4. Frontend unit tests.
5. Migration tests.
6. Playwright smoke tests for critical flows.
7. Dependency and secret scanning.

A release candidate should additionally run the security and restore test suites.

## 11. Definition of done

The MVP can be considered ready when all of the following are true:

- A user can start Mitsu locally and configure a library.
- Supported folders and archives import correctly.
- Gallery cards, details, search, filters, and sorting work.
- Single-page and continuous-scroll reading work.
- Reading progress survives a restart.
- Favorites and collections persist.
- Metadata edits are protected against remote overwrite.
- Import errors are visible and recoverable.
- The core application works with remote sources disabled.
- Source files are preserved during index removal.
- Archive and filesystem security tests pass.
- Database migrations and backup restoration are tested.
- All P0 acceptance criteria pass in CI.
- The README documents installation, configuration, backup, restore, and known limitations.

## 12. Implementation sequence

Build in this order to reduce rework:

1. Foundation: repository, configuration, SQLite, migrations, FastAPI, React shell, and pastel design system.
2. Library indexing: root configuration, archive scanning, page ordering, cover generation, and persistent import jobs.
3. Library UI: gallery grid, details, search, sorting, filtering, and metadata editing.
4. Reader: page streaming, single-page and continuous modes, progress persistence, and keyboard navigation.
5. Organization: favorites, collections, reading status, and dashboard sections.
6. Metadata discovery: source registry, lookup jobs, metadata provenance, and conflict review.
7. Provider adapter: implement only after verifying permitted access and a stable, supported integration path.
8. Release hardening: security review, CI, recovery testing, documentation, and packaging.

## 13. First implementation milestone

The first milestone should deliver a working vertical slice rather than disconnected scaffolding.

Milestone acceptance: a user can start the app, import a local CBZ archive, see it on the home page, open it in either reader mode, navigate pages, close the browser, and resume reading from the saved position.

That single workflow validates the frontend, backend, database, file storage, import pipeline, reader, and progress persistence together. Once it works reliably, the remaining epics can build on a stable foundation.

Final recommendation: keep Mitsu local-first and provider-agnostic. The distinctive value is the Peach-inspired experience, excellent reading, and intelligent personal library—not dependence on any one third-party downloader.

https://nhentai.net/ is nhentai
https://nhentai.zip/ is for downloading nhentai
