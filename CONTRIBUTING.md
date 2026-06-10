# Contributing to LaTeX Forge for VS Code

Thanks for your interest in contributing!

## Reporting a bug

Open an issue on GitHub and include:

- Your OS and VS Code version
- The installed `latex-forge` CLI version (`latex-forge --version`)
- Steps to reproduce, and the relevant output from the **LaTeX Forge** output channel

## Setting up the development environment

```bash
git clone https://github.com/thmsgo18/latex-forge-vscode.git
cd latex-forge-vscode
npm install
```

Requires Node.js 20+. For testing commands end to end, also install the [latex-forge CLI](https://github.com/thmsgo18/latex-forge): `pipx install latex-forge`.

## Running the extension

Open the project in VS Code and press `F5` to launch an Extension Development Host with the extension loaded. Command output and logs appear in the **LaTeX Forge** output channel.

## Building, linting, and testing

```bash
npm run compile   # bundle with esbuild
npm run watch     # rebuild on every change
npm run lint      # eslint
npm test          # compile, lint, and run the test suite (uses xvfb on Linux)
```

All of these run in CI; make sure `npm test` passes before opening a pull request.

## Project structure

```
src/
├── extension.ts              # activation and command registration
├── commands/                 # one file per command (createProject, browseGallery, ...)
├── templates.ts               # built-in and installed template handling
├── gallery.ts                 # gallery panel webview
├── projectTreeProvider.ts     # "Project" view
├── templatesTreeProvider.ts   # "Templates" view
├── cliDetection.ts            # locating the latex-forge CLI
├── cliRunner.ts                # running CLI commands and streaming output
├── cliEnv.ts                   # CLI environment helpers
├── cliUpdater.ts                # checking for CLI updates on PyPI
└── test/                       # extension tests (Mocha + @vscode/test-electron)
```

## Adding a command

1. Create a new file in `src/commands/`.
2. Register the command in `src/extension.ts`.
3. Declare it in `package.json` under `contributes.commands` (and `contributes.menus` if it should appear in a view's toolbar).
4. Add it to the expected command list in `src/test/suite/extension.test.ts`.

## Submitting a pull request

1. Fork the repository and create a branch: `git checkout -b my-fix`
2. Make your changes and run `npm test`
3. Open a pull request against `main` with a description of the change

## Releasing a new version

Maintainers only:

1. Update `version` in `package.json` and add an entry to `CHANGELOG.md`
2. Run `npm run compile && npx --yes @vscode/vsce package` to produce a `.vsix`
3. Upload the `.vsix` to the [VS Code Marketplace](https://marketplace.visualstudio.com/manage)
