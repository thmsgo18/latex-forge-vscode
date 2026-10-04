import { execFile } from 'child_process';
import * as vscode from 'vscode';
import { isLatexForgeAvailable } from './cliDetection';
import { applyToolPaths, getCliEnv } from './cliEnv';
import { runLatexForge } from './cliRunner';
import { ensureMinimumCliVersion, MIN_CLI_VERSION } from './cliUpdater';
import { getEnvironmentStatus } from './environment';
import { installCli, installUv } from './uvBootstrap';

export type TexChoice = 'light' | 'full' | 'system';

/** Extensions the generated projects recommend (latex_forge/.vscode/extensions.json). */
export const RECOMMENDED_EXTENSIONS = [
    'James-Yu.latex-workshop',
    'ltex-plus.vscode-ltex-plus',
    'streetsidesoftware.code-spell-checker',
    'streetsidesoftware.code-spell-checker-french',
    'MS-vsliveshare.vsliveshare'
];

export interface SetupOptions {
    /** Distribution to install if LaTeX is missing; asked when undefined. */
    tex?: TexChoice;
    /** Also install the recommended VS Code extensions. */
    installExtensions?: boolean;
    /** Reinstall the managed TinyTeX even if LaTeX already works. */
    reinstallTex?: boolean;
}

interface TexPick extends vscode.QuickPickItem {
    choice: TexChoice;
}

function systemDescription(): string {
    switch (process.platform) {
        case 'darwin':
            return 'MacTeX via Homebrew';
        case 'win32':
            return 'MiKTeX via winget';
        default:
            return 'TeX Live via apt / dnf / pacman';
    }
}

/** Asks which LaTeX distribution to install. Light is first and preselected. */
export async function pickTexDistribution(): Promise<TexChoice | undefined> {
    const items: TexPick[] = [
        {
            choice: 'light',
            label: '$(zap) Light — TinyTeX',
            description: 'recommended',
            detail: 'About 500 MB in your home folder, a few minutes, no admin password. '
                + 'Extra LaTeX packages are installed automatically when a document needs them.'
        },
        {
            choice: 'full',
            label: '$(package) Full — all of TeX Live',
            detail: 'About 2 GB to download (5 GB on disk), everything available offline. No admin password.'
        },
        {
            choice: 'system',
            label: `$(terminal) System — ${systemDescription()}`,
            detail: 'Installed by your package manager in a terminal. Needs your administrator password; can take 20–30 minutes.'
        }
    ];
    const picked = await vscode.window.showQuickPick(items, {
        title: 'LaTeX Forge: Install LaTeX',
        placeHolder: 'Which LaTeX distribution should be installed?',
        ignoreFocusOut: true
    });
    return picked?.choice;
}

/**
 * Turns CLI output lines into progress messages: `==> Step` headers, download
 * percentages and tlmgr's `[12/86, ...]` counters.
 */
export class ProgressParser {
    private title = '';

    constructor(private readonly report: (message: string) => void) {}

    feed(line: string): void {
        const header = /^==> (.+)$/.exec(line);
        if (header) {
            this.title = header[1].trim();
            this.report(this.title);
            return;
        }
        const download = /downloading (\d+)%/.exec(line);
        if (download) {
            this.report(`${this.title} — ${download[1]}%`);
            return;
        }
        const counter = /^\s*\[(\d+)\/(\d+),/.exec(line);
        if (counter) {
            this.report(`${this.title} — ${counter[1]}/${counter[2]}`);
        }
    }
}

async function installMissingExtensions(log: (line: string) => void): Promise<number> {
    const missing = RECOMMENDED_EXTENSIONS.filter((id) => !vscode.extensions.getExtension(id));
    for (const id of missing) {
        log(`==> Installing VS Code extension ${id}`);
        try {
            await vscode.commands.executeCommand('workbench.extensions.installExtension', id);
        } catch (error) {
            log(`[warn] Could not install ${id}: ${(error as Error).message}`);
        }
    }
    return missing.length;
}

/** Installs the recommended VS Code extensions that aren't installed yet. */
export async function installRecommendedExtensions(outputChannel: vscode.OutputChannel): Promise<void> {
    const count = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'LaTeX Forge' },
        async (progress) => {
            const parser = new ProgressParser((message) => progress.report({ message }));
            return installMissingExtensions((line) => {
                outputChannel.appendLine(line);
                parser.feed(line);
            });
        }
    );
    await vscode.window.showInformationMessage(
        count === 0
            ? 'LaTeX Forge: the recommended VS Code extensions are already installed.'
            : `LaTeX Forge: installed ${count} recommended VS Code extension(s).`
    );
}

function findUvOnPath(): Promise<string | undefined> {
    return new Promise((resolve) => {
        execFile('uv', ['--version'], { env: getCliEnv() }, (error) => resolve(error ? undefined : 'uv'));
    });
}

export class SetupWizard {
    private running: Promise<boolean> | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly outputChannel: vscode.OutputChannel,
        private readonly onChanged: () => void
    ) {}

    /** Runs the setup; a second call while one is running joins the first. */
    run(options: SetupOptions = {}): Promise<boolean> {
        if (!this.running) {
            this.running = this.doRun(options).finally(() => {
                this.running = undefined;
            });
        }
        return this.running;
    }

    /** Installs only the CLI (used when a command needs it). Returns whether it's available. */
    async installCliOnly(): Promise<boolean> {
        return vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'LaTeX Forge', cancellable: false },
            async (progress) => {
                const parser = new ProgressParser((message) => progress.report({ message }));
                const ok = await this.ensureCli(parser);
                this.onChanged();
                return ok;
            }
        );
    }

    private log(line: string, parser?: ProgressParser): void {
        this.outputChannel.appendLine(line);
        parser?.feed(line);
    }

    private async ensureCli(parser: ProgressParser): Promise<boolean> {
        if (await isLatexForgeAvailable()) {
            return true;
        }
        this.outputChannel.show(true);
        try {
            let uv = await findUvOnPath();
            if (!uv) {
                uv = await installUv(this.context.globalStorageUri.fsPath, (line) => this.log(line, parser));
            }
            const code = await installCli(uv, { env: getCliEnv(), report: (line) => this.log(line, parser) });
            if (code !== 0) {
                this.log(`uv exited with code ${code}.`);
            }
        } catch (error) {
            this.log(`[error] ${(error as Error).message}`);
        }
        applyToolPaths(this.context.environmentVariableCollection);
        const available = await isLatexForgeAvailable();
        if (!available) {
            void vscode.window.showErrorMessage(
                'LaTeX Forge: the CLI could not be installed automatically. See the "LaTeX Forge" output channel; '
                + 'you can also install it yourself with "uv tool install latex-forge" or "pipx install latex-forge".',
                'Open Output'
            ).then((choice) => {
                if (choice === 'Open Output') {
                    this.outputChannel.show();
                }
            });
        }
        return available;
    }

    private runSystemInstallInTerminal(): void {
        // Package managers ask for an administrator password: that needs a real terminal.
        const terminal = vscode.window.createTerminal({ name: 'LaTeX Forge setup', env: { PATH: getCliEnv().PATH } });
        terminal.show();
        terminal.sendText('latex-forge setup --install-tex --tex system --skip-extensions');
        const listener = vscode.window.onDidCloseTerminal((closed) => {
            if (closed === terminal) {
                listener.dispose();
                applyToolPaths(this.context.environmentVariableCollection);
                this.onChanged();
            }
        });
        this.context.subscriptions.push(listener);
        void vscode.window.showInformationMessage(
            'LaTeX Forge: follow the installation in the terminal (your administrator password is needed). '
            + 'Run "LaTeX Forge: Setup Environment" again once it has finished.'
        );
    }

    private async doRun(options: SetupOptions): Promise<boolean> {
        let systemInTerminal = false;
        let cancelled = false;
        const ok = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'LaTeX Forge setup', cancellable: true },
            async (progress, token) => {
                const parser = new ProgressParser((message) => progress.report({ message }));

                parser.feed('==> Checking the LaTeX Forge CLI');
                if (!(await this.ensureCli(parser))) {
                    return false;
                }
                if (token.isCancellationRequested) {
                    cancelled = true;
                    return false;
                }
                parser.feed('==> Checking the LaTeX Forge CLI version');
                if (!(await ensureMinimumCliVersion(this.outputChannel))) {
                    this.log(`[error] The LaTeX Forge CLI must be ${MIN_CLI_VERSION} or newer, and it could not be upgraded.`);
                    return false;
                }

                parser.feed('==> Checking LaTeX');
                const status = await getEnvironmentStatus();
                if (!status.texReady || options.reinstallTex) {
                    const choice = options.tex ?? (options.reinstallTex ? 'light' : await pickTexDistribution());
                    if (!choice || token.isCancellationRequested) {
                        cancelled = true;  // the user backed out: not a failure
                        return false;
                    }
                    if (choice === 'system') {
                        systemInTerminal = true;
                    } else {
                        this.outputChannel.show(true);
                        const args = options.reinstallTex
                            ? ['setup', '--reinstall-tex', '--skip-extensions']
                            : ['setup', '--install-tex', '--tex', choice, '--yes', '--skip-extensions'];
                        const result = await runLatexForge(args, {
                            outputChannel: this.outputChannel,
                            onLine: (line) => parser.feed(line),
                            token
                        });
                        if (result.exitCode !== 0) {
                            cancelled = token.isCancellationRequested;
                            return false;
                        }
                    }
                }

                applyToolPaths(this.context.environmentVariableCollection);

                if (options.installExtensions) {
                    await installMissingExtensions((line) => this.log(line, parser));
                }
                return systemInTerminal || (await getEnvironmentStatus()).texReady;
            }
        );

        if (systemInTerminal) {
            this.runSystemInstallInTerminal();
        }
        this.outputChannel.appendLine(ok ? '==> LaTeX Forge setup finished.' : '==> LaTeX Forge setup stopped.');
        this.onChanged();

        // The setup is over once the work is: don't hold it until the user
        // dismisses the closing notification.
        if (ok && !systemInTerminal) {
            void vscode.window.showInformationMessage(
                'LaTeX Forge is ready: LaTeX is installed and working.',
                'Create Project'
            ).then((choice) => {
                if (choice === 'Create Project') {
                    void vscode.commands.executeCommand('latex-forge.createProject');
                }
            });
        } else if (!ok && !cancelled) {
            void vscode.window.showWarningMessage(
                'LaTeX Forge setup did not complete. See the "LaTeX Forge" output channel for details.',
                'Open Output',
                'Retry'
            ).then((choice) => {
                if (choice === 'Open Output') {
                    this.outputChannel.show();
                } else if (choice === 'Retry') {
                    void this.run(options);
                }
            });
        }
        return ok;
    }
}
