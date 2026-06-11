# Changelog

All notable changes to the "LaTeX Forge" extension will be documented in this file.

## [Unreleased]

## [1.0.0] - 2026-06-11

### Added

- Automated publishing to the VS Code Marketplace on version tags.

### Changed

- First stable release.

## [0.1.11] - 2026-06-10

### Added

- **"Open in VS Code" gallery links**: the extension now registers a
  `vscode://thmsgo18.latex-forge-vscode/install?template=<name>&installUrl=<url>`
  URI handler. Clicking the new "Open in VS Code" button on the
  [template gallery website](https://thmsgo18.github.io/latex-forge-gallery/)
  installs the template and jumps straight into project creation, no
  terminal needed.
- **Getting Started walkthrough**: a "Get Started with LaTeX Forge" entry
  appears on VS Code's Welcome page for new installs, walking through
  setup, creating a first project, browsing the gallery, and configuring
  your profile. Open it any time via **Help: Get Started** /
  **Welcome: Open Walkthrough**.

## [0.1.10] - 2026-06-09

### Fixed

- Template hover preview images no longer overflow the tooltip horizontally.
  The image now scales to fit the tooltip width exactly (`max-width: 100%`).

## [0.1.9] - 2026-06-09

### Added

- **Template hover previews**: hovering over any template in the Templates
  view now shows a tooltip with the template name, description, and its
  preview PNG loaded from the gallery. Works for both built-in and
  user-installed templates. The gallery is fetched once in the background;
  tooltips fall back to plain text when offline.
- **Rename Project in panel**: a "Rename Project" item (orange edit icon)
  now appears in the LaTeX Forge panel automatically when the current
  workspace contains `.tex` files. It is hidden otherwise. Clicking it
  jumps directly to the new-name prompt without asking for a folder. The
  panel updates live when projects are opened or closed.
- **LaTeX Workshop extension pack**: LaTeX Workshop
  (`James-Yu.latex-workshop`) is now bundled as an extension pack. VS Code
  installs it automatically alongside LaTeX Forge from the Marketplace.

### Changed

- **Removed Build / Clean / Open PDF commands**: these were duplicates of
  LaTeX Workshop's built-in actions. The commands and their source files
  have been removed to keep the extension focused.
- **Diagnose panel**: the LaTeX Workshop VS Code extension is now listed as
  an optional row (gray "Not set" badge when absent). Profile and default
  template rows also use the gray badge when unconfigured, so only genuinely
  broken components show a red "Issue" badge. The latexmk version is now
  extracted cleanly from the full CLI version string (was showing the entire
  "Latexmk, John Collins..." line).

## [0.1.8] - 2026-06-09

### Added

- **Template list (JSON backend)**: the Templates view and the template picker
  now use `latex-forge template list --json` instead of parsing human-readable
  text. User-installed templates display their installed version tag
  (e.g. `v1.2.0`) in the tree.
- **LaTeX Forge: Update Templates** (`latex-forge.updateTemplates`): runs
  `latex-forge template update` for all user-installed templates and shows a
  formatted summary in the output channel (one line per template: upgraded,
  already up-to-date, skipped, or error) plus a summary notification. A
  `$(arrow-up)` toolbar button appears at the top of the Templates view.
- **LaTeX Forge: Diagnose Environment** (`latex-forge.diagnose`): opens a
  webview dashboard that calls `latex-forge diagnose --json` and displays the
  status of every required component: CLI version, pipx, TeX Live (with engine
  list), latexmk, profile, and default template, with OK / Issue badges and
  inline fix hints. A `$(beaker)` toolbar button appears in the LaTeX Forge
  project view. The panel can be refreshed in place or used to launch the Setup
  Wizard directly.

## [0.1.7] - 2026-06-09

### Added

- **Gallery search bar**: a text input in the gallery toolbar lets you filter
  templates by name or description in real time, on top of the existing category
  filter.
- **Gallery "Installed" badges**: templates that are already installed locally
  are marked with a green **✓ Installed** badge in their card header. The badge
  also appears dynamically after a successful install within the current session.
- **Gallery "Install & Create" button**: each gallery card now has a second
  action button. For a template that is not yet installed it reads **Install &
  Create**: it installs the template then immediately opens the *Create
  Project* flow with that template pre-selected, skipping the template picker.
  Once installed the button reads **Create project** and skips the install step
  entirely.
- **Status bar item**: a `$(file-code) LaTeX Forge` item is now always visible
  in the status bar. When a workspace folder containing `.tex` files is open it
  shows the project folder name instead. When a CLI update is detected it adds a
  `$(arrow-up)` indicator with a tooltip showing the available version. Clicking
  it opens the LaTeX Forge activity bar panel.

## [0.1.6] - 2026-06-09

### Changed

- **Create Project** now always opens a folder picker to choose the destination,
  even when a workspace folder is already open. Previously the workspace folder
  was used silently, which could cause projects to be created inside other LaTeX
  projects. The picker opens pre-navigated to the current workspace folder for
  convenience, but the user must always confirm the location explicitly.
- If the selected destination already contains `.tex` files (i.e. looks like an
  existing LaTeX project), a warning is shown before proceeding. The user can
  pick a different folder or override and create there anyway.

## [0.1.5] - 2026-06-09

### Fixed

- The extension failed to activate on any installed (non-development) instance
  because the `@iarna/toml` runtime dependency was never bundled into the
  packaged VSIX. All runtime dependencies are now bundled into a single
  `out/extension.js` using **esbuild**, so the extension activates correctly
  when installed from the Marketplace or a VSIX file.

## [0.1.4] - 2026-06-09

### Fixed

- The extension failed to activate ("Aucun fournisseur de données inscrit")
  when LaTeX Workshop was not already installed. The hard `extensionDependencies`
  entry has been removed: LaTeX Forge now always activates, and the Build / Clean
  / Open PDF commands continue to recommend and link to LaTeX Workshop when it is
  absent, but do not block the rest of the extension.

## [0.1.3] - 2026-06-09

### Added

- **Edit Profile**: a new panel accessible from the **LaTeX Forge** activity
  bar view (or via `LaTeX Forge: Edit Profile` in the Command Palette). Opens a
  webview form with four sections (**Identity**, **Online profiles**,
  **Academic**, and **Professional**) matching the fields managed by
  `latex-forge profile set` in the CLI. Values are saved to
  `~/.latex-forge/profile.toml` and are automatically applied when you create a
  new project (filled in by the CLI).

## [0.1.2] - 2026-06-09

### Changed

- The activity bar panel is now always the same regardless of whether a LaTeX
  project is open or not:
  - The top **LaTeX Forge** view always shows **Create Project** and **Browse
    Template Gallery**, one click from anywhere.
  - The **Templates** view (collapsed by default) always lists installed
    templates below.
  - No more context detection, file watchers, or conditional visibility.
- Removed **Build**, **Clean**, and **Open PDF** from the panel toolbar: those
  actions are still available from the Command Palette (⌘⇧P) and are handled
  by LaTeX Workshop.

## [0.1.1] - 2026-06-09

### Changed

- **Build**, **Clean**, and **Open PDF** now delegate to LaTeX Workshop when
  it is available, so users get SyncTeX, live PDF refresh, inline error
  display, and all of LaTeX Workshop's features through the LaTeX Forge
  panel buttons.  A built-in fallback (latexmk / manual artifact removal /
  direct PDF open) is used when LaTeX Workshop is absent, with a one-time
  notification and a direct link to install it.
- LaTeX Workshop (`James-Yu.latex-workshop`) is now an extension dependency:
  VS Code installs it automatically alongside LaTeX Forge.

## [0.1.0] - 2026-06-09

### Changed

- The activity bar panel is now **context-aware**:
  - **Inside a LaTeX project** (folder with a `.tex` file at its root): only
    the **Project** view is shown, with the Build / Clean / Open PDF actions.
    The Templates list is hidden to keep the panel focused.
  - **Outside a project** (no folder open, or folder with no `.tex` file): the
    **Project** view shows a welcome message with **Create Project** and **Open
    Folder** buttons; the **Templates** view appears below it (collapsed) so
    installed templates are always one click away.
- The panel switches automatically when a `.tex` file is created or deleted, or
  when the workspace folder changes, no restart required.

## [0.0.9] - 2026-06-09

### Added

- **Project view** in the LaTeX Forge activity bar panel (above Templates):
  three clickable items (**Build**, **Clean**, and **Open PDF**) that trigger
  the corresponding commands with a single click, without going through the
  Command Palette.  The same three commands are also registered under
  `LaTeX Forge: Build`, `LaTeX Forge: Clean`, and `LaTeX Forge: Open PDF` in
  the Command Palette (⌘⇧P).  Icon buttons for all three also appear in the
  view's toolbar.  When no folder is open, a welcome message with quick-links
  to open or create a project is shown instead.
- **LaTeX Forge: Build** runs `latexmk` using the engine and flags defined
  in the project's `.vscode/settings.json` (generated by `latex-forge create`).
  Falls back to `latexmk -lualatex -outdir=./build` when no settings file is
  present.  Streams live output to the "LaTeX Forge" channel.
- **LaTeX Forge: Clean** removes all build artefacts from the configured
  output directory (and any stray artefacts at the workspace root) while
  keeping the compiled PDF intact.
- **LaTeX Forge: Open PDF** opens the compiled PDF directly in VS Code.
  Looks in the configured output directory first, then falls back to the
  workspace root.  Shows a picker when more than one PDF is found.

### Changed

- The **Templates** view now starts collapsed in the activity bar panel so
  the Project actions are immediately visible when opening LaTeX Forge.

## [0.0.8] - 2026-06-08

### Changed

- **Create Project** reverts to showing an "Open Project" button after
  a successful creation, rather than opening the folder automatically.

### Added

- The extension now checks for a newer version of the `latex-forge` CLI on
  PyPI silently at startup (once per VS Code session). When an update is found
  a notification appears offering to run `pipx upgrade latex-forge`
  automatically, with live output in the "LaTeX Forge" channel.
- **LaTeX Forge: Check for CLI Update** command: trigger the same check
  manually from the Command Palette at any time; also reports "up to date"
  when the CLI is already on the latest version.

### Fixed

- Added `/opt/homebrew/bin` and `/usr/local/bin` to the supplemental PATH
  directories (previously only `~/.local/bin` was added). This ensures that
  `pipx` installed via Homebrew on Apple Silicon Macs is found correctly when
  running the upgrade command.

## [0.0.6] - 2026-06-08

### Changed

- **Create Project** now opens the new project folder automatically as soon as
  the CLI finishes, instead of showing an "Open Project" button the user had
  to click. The project's `.vscode/settings.json` (which sets the correct LaTeX
  engine and build recipe) is therefore always active from the very first build,
  regardless of which folder was open before.

## [0.0.5] - 2026-06-08

### Changed

- The Browse Template Gallery cards' "View source" link, which opened the
  upstream project the template was adapted from, is now a "View in gallery
  repo" link that opens the template's own folder in the `latex-forge-gallery`
  repository on GitHub instead, i.e. the exact location the **Install** button
  fetches from.

### Added

- Gallery cards now show a "Preview PDF" link (when the gallery provides one)
  that opens a full-size, rendered PDF preview of the template in the
  browser, useful since the thumbnail image in the card is small.

## [0.0.4] - 2026-06-08

### Fixed

- The category filter in the Browse Template Gallery webview updated the result
  counter correctly but never actually hid the non-matching cards: it toggled
  the `hidden` attribute, which the browser implements via a `[hidden] {
  display: none }` rule that has the exact same specificity as this page's own
  `.card { display: flex; ... }` rule, and the page's rule, declared later,
  won the cascade. The filter now toggles the cards' inline `display` style
  directly, which always takes precedence over stylesheet rules.

## [0.0.3] - 2026-06-07

### Fixed

- The Browse Template Gallery webview generated a different nonce for its
  Content-Security-Policy than for its `<script>` tags, so the browser
  silently blocked all of the panel's JavaScript: the category filter, result
  counter, and Install/Refresh/Retry buttons did nothing. The webview now
  generates a single nonce and reuses it in both places.

## [0.0.2] - 2026-06-07

### Fixed

- The `latex-forge` binary could fail to be detected (and commands could fail to run) on
  the very first launch when VS Code was started from Finder, the Dock, or Spotlight: the
  editor starts with a minimal `PATH` from the OS and its own resolution of the user's
  shell `PATH` can time out with heavier shell setups (pyenv, nvm, etc.), leaving
  `~/.local/bin` (pipx's default install location) out of the extension host's `PATH`
  even though the CLI was correctly installed and reachable from any terminal. The
  extension now also looks in `~/.local/bin` when locating and running `latex-forge`.

### Added

- **LaTeX Forge: Rename Project** command: pick a project folder, enter a new name, and
  run `latex-forge rename` from inside it.
- **LaTeX Forge: Setup Environment** command: run `latex-forge setup` with any
  combination of `--check-only`, `--skip-extensions`, and `--install-tex`.
- **LaTeX Forge: List Templates** command: run `latex-forge list-templates` and show the
  result in the output channel.
- **Templates view** in a new "LaTeX Forge" activity bar container, listing built-in and
  user-installed templates via `latex-forge template list`, with toolbar actions to
  install or refresh, and an inline action to remove user-installed templates.
- **LaTeX Forge: Install Template** and **LaTeX Forge: Remove Template** commands wrapping
  `latex-forge template install` / `template remove`.
- **LaTeX Forge: Configure Defaults** command: read and write `default_template` and
  `default_output_dir` in `~/.latex-forge.toml` through a simple menu.
- **LaTeX Forge: Create Project** now lists user-installed templates alongside built-in
  ones (previously built-in only).
- **LaTeX Forge: Browse Template Gallery** command: a webview panel listing the curated
  templates from the `latex-forge-gallery` repository, with preview images, descriptions,
  tags, engine, and a category filter, plus a one-click **Install** button that runs
  `latex-forge template install` and refreshes the Templates view.

## [0.0.1] - 2026-06-07

### Added

- Initial scaffold of the extension.
- Detection of the `latex-forge` CLI on the user's `PATH`, with guidance to install it via
  pipx when it is missing.
- **LaTeX Forge: Create Project** command: pick a template, name the project, choose a
  destination folder, and run `latex-forge create` with live output in a dedicated output
  channel.
