# Changelog

All notable changes to the "LaTeX Forge" extension will be documented in this file.

## [Unreleased]

## [0.0.4] - 2026-06-08

### Fixed

- The category filter in the Browse Template Gallery webview updated the result
  counter correctly but never actually hid the non-matching cards: it toggled
  the `hidden` attribute, which the browser implements via a `[hidden] {
  display: none }` rule that has the exact same specificity as this page's own
  `.card { display: flex; ... }` rule — and the page's rule, declared later,
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
  `~/.local/bin` — pipx's default install location — out of the extension host's `PATH`
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
