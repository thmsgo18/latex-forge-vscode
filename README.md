<p align="right"><b>English</b> | <a href="./README.fr.md">Français</a></p>

<p align="center">
  <img src="logo.png" alt="LaTeX Forge for VS Code" width="420">
</p>

# LaTeX Forge for VS Code

> **Create ready-to-write LaTeX projects, browse a gallery of 80+ templates, and manage your whole LaTeX setup, without leaving VS Code or touching a terminal.**

This extension is the visual companion of the [LaTeX Forge CLI](https://github.com/thmsgo18/latex-forge): pick a template, name your project, and start writing. The PDF preview is already wired up.

## Getting started

1. Install this extension (click **Install** on the banner above).
2. Install the CLI it drives: `pipx install latex-forge`. If the extension can't find it, it offers to copy this command or open the [PyPI page](https://pypi.org/project/latex-forge/).
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

### Setup Environment & Diagnose

- **Setup Environment**: runs `latex-forge setup` with your choice of `--check-only`, `--skip-extensions`, `--install-tex`; installs the LaTeX toolchain for your OS.
- **Diagnose Environment**: runs `latex-forge diagnose` and presents the health check (TeX Live, latexmk, profile, defaults) with actionable fixes.

### CLI updates

The extension checks once per session whether a newer CLI version is on PyPI and offers a one-click `pipx upgrade latex-forge` (also available manually via **Check for CLI Update**). A status bar item signals when an update is available.

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
| `LaTeX Forge: Setup Environment` | Install / check the LaTeX toolchain |
| `LaTeX Forge: Diagnose Environment` | Environment health check |
| `LaTeX Forge: Check for CLI Update` | Compare installed CLI with PyPI |
| `LaTeX Forge: Refresh Templates` | Reload the Templates view |

## Requirements

- The **latex-forge CLI** (`pipx install latex-forge`): the extension is a thin wrapper around it and duplicates none of its logic.
- A **LaTeX distribution** for compiling (the extension can install it for you via **Setup Environment**).
- [LaTeX Workshop](https://marketplace.visualstudio.com/items?itemName=James-Yu.latex-workshop) is recommended for the live PDF preview; generated projects are pre-configured for it.

**Privacy note:** the gallery panel is the only feature that talks to the network (it fetches `gallery.json` and preview images from `raw.githubusercontent.com`, plus the PyPI version check). Everything else only talks to the local CLI.

## Extension Settings

This extension does not contribute VS Code settings. Defaults that influence `latex-forge create` live in `~/.latex-forge.toml` and are managed with **LaTeX Forge: Configure Defaults**.

## Known Limitations

- The extension requires the CLI to be installed separately (it will guide you if it's missing).

## Release Notes

See the [CHANGELOG](https://github.com/thmsgo18/latex-forge-vscode/blob/main/CHANGELOG.md).

## Related projects

- [**latex-forge**](https://github.com/thmsgo18/latex-forge): the CLI this extension drives
- [**latex-forge-gallery**](https://github.com/thmsgo18/latex-forge-gallery): the template gallery and its [browsable website](https://thmsgo18.github.io/latex-forge-gallery/)

## Contributing

Issues and pull requests are welcome on the [GitHub repository](https://github.com/thmsgo18/latex-forge-vscode).

## License

[MIT](LICENSE)
