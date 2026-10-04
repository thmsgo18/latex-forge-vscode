<p align="right"><b>English</b> | <a href="./README.fr.md">Français</a></p>

<p align="center">
  <img src="logo.png" alt="LaTeX Forge for VS Code" width="420">
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=thmsgo18.latex-forge-vscode"><img src="https://vsmarketplacebadges.dev/version/thmsgo18.latex-forge-vscode.svg?style=for-the-badge&label=marketplace&color=blue" alt="Visual Studio Marketplace"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License MIT"></a>
  <a href="https://github.com/thmsgo18/latex-forge"><img src="https://img.shields.io/badge/works_with-latex--forge-blue?style=for-the-badge" alt="Works with latex-forge"></a>
</p>

> **Create ready-to-write LaTeX projects, browse a gallery of 80+ templates, and manage your whole LaTeX setup, without leaving VS Code or touching a terminal.**

This extension is the visual companion of the [LaTeX Forge CLI](https://github.com/thmsgo18/latex-forge): pick a template, name your project, and start writing. The PDF preview is already wired up.

## Getting started

1. Install this extension (click **Install** on the banner above).
2. Click **Set Up Now** when it offers the one-time setup (or run **LaTeX Forge: Install Everything**). It installs the LaTeX Forge CLI and LaTeX — about 500 MB, a few minutes, **no Python, terminal or administrator password needed** — and checks that a test document compiles. No restart needed.
3. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and run **LaTeX Forge: Create Project**.

That's it: pick a template, enter a name, choose a folder, and open your new project.

A **Get Started with LaTeX Forge** walkthrough also appears on VS Code's Welcome page after install, walking through the same steps plus the gallery and your profile.

## Features

All commands live in the Command Palette under the **LaTeX Forge:** prefix and stream their output to the **LaTeX Forge** output channel.

### Create Project

Pick a template (built-in or installed), enter a name, choose the destination folder, and the extension runs `latex-forge create` and offers to open the generated project. If the chosen folder already contains LaTeX files, it warns you before nesting projects.

### Browse Template Gallery

A panel inside VS Code showing the curated templates from the [gallery](https://github.com/thmsgo18/latex-forge-gallery), with **preview images**, descriptions, tags, engine badges, and category + text filtering. Each card offers:

- **Install**: one click runs `latex-forge template install`
- **Install & Create**: installs the template, then jumps straight into project creation
- **Preview PDF**: full-size rendered preview in your browser
- **View in gallery repo**: the template's source on GitHub

Hovering a template in the Templates view also shows its preview image in a tooltip.

The [gallery website](https://thmsgo18.github.io/latex-forge-gallery/) also has an **Open in VS Code** button on every template; clicking it installs the template in this extension and jumps straight into project creation.

### Templates view (activity bar)

A dedicated **LaTeX Forge** icon in the activity bar lists built-in and user-installed templates, with toolbar actions:

- **Browse Template Gallery**: opens the gallery panel
- **Install Template**: from a GitHub URL, ZIP URL, or local folder (any template with a `main.tex` works, not just gallery ones)
- **Update Templates**: checks the gallery for newer versions of your installed templates
- **Remove Template**: with confirmation
- **Refresh**: reloads the list

### Project view & Rename

When the open workspace is a LaTeX Forge project, the **Project** view surfaces project actions, including **Rename Current Project**: folder, main `.tex` file, and build artifacts are renamed consistently via `latex-forge rename`.

### Edit Profile

A form inside VS Code to edit your LaTeX Forge profile (name, email, university, supervisor…) stored in `~/.latex-forge/profile.toml`. Every project you create afterwards is pre-filled with these values, the same file the CLI's `latex-forge profile` uses.

### Configure Defaults

Reads and writes `default_template` and `default_output_dir` in `~/.latex-forge.toml` through a simple menu (no manual TOML editing).

### One-click setup

- **Install Everything**: installs whatever is missing, with a progress notification:
  - the **LaTeX Forge CLI**, through [uv](https://docs.astral.sh/uv/) (downloaded and checksum-verified by the extension), on a Python uv manages — nothing to install beforehand, and a system Python upgrade can't break it;
  - **LaTeX**: you choose **Light** (TinyTeX in your home folder, ~500 MB, the default), **Full** (all of TeX Live, ~2 GB) or **System** (MacTeX / MiKTeX / TeX Live through your package manager, run in a terminal since it needs your password). A distribution you already have is detected and left alone;
  - the recommended VS Code extensions (LaTeX Workshop, LTeX+, spell checkers, Live Share);
  - then a test compile. New tools are added to VS Code's PATH (and new terminals') immediately: no restart.
- Until the setup is done, a **finish setup** item shows in the status bar and the LaTeX Forge panel.
- **Missing packages, installed for you**: with the light distribution, when a compile (LaTeX Workshop's compile on save included) reports a missing package, font or bibliography style, the extension installs it and recompiles. Turn it off with `latexForge.autoInstallPackages`.

### Setup Environment & Diagnose

- **Setup Environment**: everything above, plus finer options — check only, choose the LaTeX distribution, install only the recommended extensions, install the GitHub CLI, or repair LaTeX (reinstall TinyTeX after a new TeX Live year, keeping your packages).
- **Diagnose Environment**: runs `latex-forge diagnose` and presents the health check (the CLI and how it's installed, the LaTeX distribution, latexmk, biber, GitHub CLI, profile, defaults) with actionable fixes and an **Install everything** button.

### CLI updates

The extension checks once per session whether a newer CLI version is on PyPI and offers a one-click upgrade with the tool that installed it (`uv tool upgrade` or `pipx upgrade`; also available manually via **Check for CLI Update**). A status bar item signals when an update is available.

## Commands

| Command | Description |
|---|---|
| `LaTeX Forge: Create Project` | New project from a template |
| `LaTeX Forge: Browse Template Gallery` | Visual gallery with previews and one-click install |
| `LaTeX Forge: Install Template` | Install from URL, ZIP, or local folder |
| `LaTeX Forge: Update Templates` | Update installed gallery templates |
| `LaTeX Forge: Remove Template` | Remove an installed template |
| `LaTeX Forge: List Templates` | List templates in the output channel |
| `LaTeX Forge: Rename Project` / `Rename Current Project` | Rename folder + main file consistently |
| `LaTeX Forge: Edit Profile` | Auto-fill profile (name, email, university…) |
| `LaTeX Forge: Configure Defaults` | Default template & output directory |
| `LaTeX Forge: Install Everything (CLI + LaTeX)` | One-click setup of the CLI, LaTeX and the recommended extensions |
| `LaTeX Forge: Setup Environment` | Setup options: check only, choose the distribution, GitHub CLI, repair |
| `LaTeX Forge: Diagnose Environment` | Environment health check |
| `LaTeX Forge: Check for CLI Update` | Compare installed CLI with PyPI |
| `LaTeX Forge: Refresh Templates` | Reload the Templates view |

## Requirements

- The **latex-forge CLI**: the extension is a thin wrapper around it and duplicates none of its logic. **Install Everything** installs it for you; if you prefer, `uv tool install latex-forge` or `pipx install latex-forge` work too.
- A **LaTeX distribution** for compiling: **Install Everything** installs one (no administrator password), or uses the one you have.
- [LaTeX Workshop](https://marketplace.visualstudio.com/items?itemName=James-Yu.latex-workshop) is recommended for the live PDF preview; generated projects are pre-configured for it.

**Privacy note:** the network is only used by the gallery panel (it fetches `gallery.json` and preview images from `raw.githubusercontent.com`), the PyPI version check, and the setup, which downloads uv and TinyTeX from GitHub releases, latex-forge and a Python from PyPI / python-build-standalone (through uv), and LaTeX packages from CTAN mirrors. Everything else only talks to the local CLI.

## Extension Settings

- `latexForge.autoInstallPackages` (default `true`): when a compile reports a missing LaTeX package, font or bibliography style, install it and recompile — only with a distribution that allows it without administrator rights, such as the light TinyTeX.

Defaults that influence `latex-forge create` live in `~/.latex-forge.toml` and are managed with **LaTeX Forge: Configure Defaults**.

## Known Limitations

- The one-click setup needs an internet connection. With a **System** distribution (or a system-wide TeX Live), missing packages can't be installed automatically: the extension shows the command to run.

## Release Notes

See the [CHANGELOG](https://github.com/thmsgo18/latex-forge-vscode/blob/main/CHANGELOG.md).

## Contributing

Issues and pull requests are welcome on the [GitHub repository](https://github.com/thmsgo18/latex-forge-vscode). See [CONTRIBUTING.md](CONTRIBUTING.md) for setting up the development environment, building, and testing.

## License

[MIT](LICENSE)

## Related projects

- [**latex-forge**](https://github.com/thmsgo18/latex-forge): the CLI this extension drives
- [**latex-forge-gallery**](https://github.com/thmsgo18/latex-forge-gallery): the template gallery and its [browsable website](https://thmsgo18.github.io/latex-forge-gallery/)
- [**latex-forge-skill**](https://github.com/thmsgo18/latex-forge-skill): a Claude skill that drives the whole workflow from a conversation

## Author

Made by [thmsgo18](https://github.com/thmsgo18)
