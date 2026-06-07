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

### LaTeX Forge: Create Project

Run **LaTeX Forge: Create Project** from the Command Palette (`Cmd+Shift+P` /
`Ctrl+Shift+P`) to:

1. Pick a template from the list returned by `latex-forge list-templates`.
2. Enter a name for the new project.
3. Choose the destination folder (defaults to your workspace folder when one is open).

The extension then runs `latex-forge create` for you, streams its output to the
**LaTeX Forge** output channel, and offers to open the generated project once it's ready.

## Extension Settings

This extension does not contribute any settings yet.

## Known Limitations

This is an early MVP release. Only project creation is currently supported — commands for
`rename`, `setup`, `list-templates`, and template management are planned for a future
release.

## Contributing

Issues and pull requests are welcome on the
[GitHub repository](https://github.com/thmsgo18/latex-forge-vscode).

## License

[MIT](LICENSE)
