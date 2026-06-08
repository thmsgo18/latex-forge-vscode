# LaTeX Forge for VS Code

VS Code extension for [LaTeX Forge](https://github.com/thmsgo18/latex-forge), the CLI that
generates standalone LaTeX projects with live PDF preview. This extension lets you create
LaTeX Forge projects directly from the editor, without touching the terminal.

## Requirements

This extension is a thin wrapper around the `latex-forge` CLI: it does not duplicate any of
its logic, it simply runs the binary and displays the results in VS Code. You need the CLI
installed and available on your `PATH`:

```bash
pipx install latex-forge
```

See the [PyPI page](https://pypi.org/project/latex-forge/) for alternative installation
methods. If the extension cannot find the `latex-forge` binary, it will offer to copy the
install command to your clipboard or open the PyPI page.

## Features

All commands are available from the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and
stream their output to the **LaTeX Forge** output channel.

### LaTeX Forge: Create Project

1. Pick a template (built-in or user-installed).
2. Enter a name for the new project.
3. Choose the destination folder (defaults to your workspace folder when one is open).

Runs `latex-forge create` and offers to open the generated project once it's ready.

### LaTeX Forge: Rename Project

Pick a project folder, enter its new name, and the extension runs `latex-forge rename`
from inside that folder. Offers to reopen the project at its new location.

### LaTeX Forge: Setup Environment

Select any combination of `--check-only`, `--skip-extensions`, and `--install-tex`, and
the extension runs `latex-forge setup` with those flags — useful for checking or
installing your LaTeX toolchain and recommended VS Code extensions.

### LaTeX Forge: List Templates

Runs `latex-forge list-templates` and shows the result in the output channel.

### LaTeX Forge: Browse Template Gallery

Opens a panel inside VS Code that lists the curated templates from the
[latex-forge-gallery](https://github.com/thmsgo18/latex-forge-gallery) repository, with
preview images, descriptions, tags, LaTeX engine, and a category filter. Each card also
offers a **Preview PDF** link (when available) to open a full-size rendered preview in your
browser, and a **View in gallery repo** link to the template's folder on GitHub. Selecting
**Install** runs `latex-forge template install <url>` and refreshes the Templates view on
success.

This is the only feature that talks to the network: it fetches `gallery.json` and preview
images from `raw.githubusercontent.com`. Everything else in the extension only talks to the
local `latex-forge` CLI.

### Templates view (activity bar)

A dedicated **LaTeX Forge** view in the activity bar lists built-in and user-installed
templates (via `latex-forge template list`):

- **Browse Template Gallery** (toolbar button): opens the gallery panel described above.
- **Install Template** (toolbar button or **LaTeX Forge: Install Template** command):
  prompts for a source (GitHub URL, ZIP URL, or local path) and an optional name, then
  runs `latex-forge template install`.
- **Remove Template** (inline action on user-installed templates, or the
  **LaTeX Forge: Remove Template** command): asks for confirmation, then runs
  `latex-forge template remove`.
- **Refresh** reloads the list.

### LaTeX Forge: Configure Defaults

Reads and writes `default_template` and `default_output_dir` in `~/.latex-forge.toml`
(the same file the CLI itself reads), through a simple menu — no manual TOML editing
required.

## Extension Settings

This extension does not contribute any VS Code settings. Defaults that influence
`latex-forge create` (default template and output directory) live in `~/.latex-forge.toml`
and can be managed with **LaTeX Forge: Configure Defaults**.

## Known Limitations

Project creation, renaming, setup, and template management are covered. A tree view of
*generated projects* is not provided: the CLI has no central registry of created
projects, and scanning the filesystem for them would mean guessing at project structure —
logic that belongs in the CLI, not in this thin wrapper.

## Contributing

Issues and pull requests are welcome on the
[GitHub repository](https://github.com/thmsgo18/latex-forge-vscode).

## License

[MIT](LICENSE)
