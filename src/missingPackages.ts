import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { runLatexForge } from './cliRunner';
import { EnvironmentStatus } from './environment';

/**
 * Installs the LaTeX packages a document needs when LaTeX Workshop's compile
 * reports them missing.
 *
 * With the light TinyTeX distribution, packages are installed on demand.
 * `latex-forge build` does that on its own, but in VS Code the compile on
 * save is run by LaTeX Workshop, which calls latexmk directly. So this
 * watches the projects' build logs: when one reports a missing package,
 * font or style, it runs `latex-forge build`, which installs what's missing
 * and recompiles — LaTeX Workshop's PDF viewer then refreshes by itself.
 */

// Missing-file names worth acting on: TeX inputs, not the user's own images
// or chapters (a typo in \includegraphics must not trigger an install).
const TEX_INPUT = /\.(sty|cls|ldf|bbx|cbx|lbx|dbx|bst|def|cfg|fd|tfm|clo|code\.tex)$/i;

const MISSING_PATTERNS: Array<{ pattern: RegExp; describe: (m: RegExpMatchArray) => string | undefined }> = [
    { pattern: /File `([^']+)' not found/g, describe: (m) => (TEX_INPUT.test(m[1]) ? m[1] : undefined) },
    { pattern: /language definition file ([\w.-]+\.ldf) was not found/g, describe: (m) => m[1] },
    { pattern: /Package babel Error: Unknown option [`']([\w-]+)'/g, describe: (m) => `babel language "${m[1]}"` },
    { pattern: /Package biblatex Error: Style '([^']+)' not found/g, describe: (m) => `biblatex style "${m[1]}"` },
    { pattern: /The font "([^"]+)" cannot be/g, describe: (m) => `font "${m[1]}"` },
    { pattern: /No color profile [\w.-]+\.icc found/g, describe: () => 'PDF color profiles' },
    { pattern: /Package pdfx Error: CreationDate is not properly supported/g, describe: () => 'luatex85' },
];

/** What a LaTeX log says is missing (deduplicated, human-readable). */
export function findMissingInLog(text: string): string[] {
    const found: string[] = [];
    for (const { pattern, describe } of MISSING_PATTERNS) {
        for (const match of text.matchAll(pattern)) {
            const item = describe(match);
            if (item && !found.includes(item)) {
                found.push(item);
            }
        }
    }
    return found;
}

/** A latex-forge project folder: `latex-forge build` can find its main file. */
export function isBuildableProject(dir: string): boolean {
    try {
        const tex = fs.readdirSync(dir).filter((name) => name.endsWith('.tex'));
        return tex.includes(`${path.basename(dir)}.tex`) || tex.length === 1;
    } catch {
        return false;
    }
}

export class MissingPackageWatcher implements vscode.Disposable {
    private readonly timers = new Map<string, NodeJS.Timeout>();
    private readonly running = new Set<string>();
    private readonly handled = new Set<string>();
    private readonly disposables: vscode.Disposable[] = [];
    /** Watchers for projects opened as a single file, outside any workspace folder. */
    private readonly projectWatchers = new Map<string, vscode.FileSystemWatcher>();

    constructor(
        private readonly outputChannel: vscode.OutputChannel,
        private readonly getStatus: () => EnvironmentStatus | undefined
    ) {
        this.watch(vscode.workspace.createFileSystemWatcher('**/build/*.log'));
        vscode.workspace.textDocuments.forEach((doc) => this.watchProjectOf(doc));
        this.disposables.push(vscode.workspace.onDidOpenTextDocument((doc) => this.watchProjectOf(doc)));
    }

    dispose(): void {
        this.timers.forEach((timer) => clearTimeout(timer));
        this.projectWatchers.forEach((watcher) => watcher.dispose());
        this.disposables.forEach((d) => d.dispose());
    }

    private watch(watcher: vscode.FileSystemWatcher): void {
        this.disposables.push(
            watcher,
            watcher.onDidCreate((uri) => this.schedule(uri)),
            watcher.onDidChange((uri) => this.schedule(uri))
        );
    }

    /**
     * The workspace watcher only sees workspace folders: when a .tex file is
     * opened on its own, watch its project's build folder directly.
     */
    private watchProjectOf(doc: vscode.TextDocument): void {
        if (doc.uri.scheme !== 'file' || !doc.fileName.endsWith('.tex')) {
            return;
        }
        const projectDir = path.dirname(doc.fileName);
        if (this.projectWatchers.has(projectDir) || vscode.workspace.getWorkspaceFolder(doc.uri)
            || !isBuildableProject(projectDir)) {
            return;
        }
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(vscode.Uri.file(path.join(projectDir, 'build')), '*.log')
        );
        this.projectWatchers.set(projectDir, watcher);
        watcher.onDidCreate((uri) => this.schedule(uri));
        watcher.onDidChange((uri) => this.schedule(uri));
    }

    /** Logs are rewritten many times during a compile: wait for it to settle. */
    private schedule(uri: vscode.Uri): void {
        const key = uri.fsPath;
        clearTimeout(this.timers.get(key));
        this.timers.set(key, setTimeout(() => {
            this.timers.delete(key);
            void this.handle(uri.fsPath);
        }, 1500));
    }

    private async handle(logPath: string): Promise<void> {
        const enabled = vscode.workspace.getConfiguration('latexForge').get<boolean>('autoInstallPackages', true);
        const projectDir = path.dirname(path.dirname(logPath));
        if (!enabled || this.running.has(projectDir) || !isBuildableProject(projectDir)) {
            return;
        }

        let text: string;
        try {
            text = fs.readFileSync(logPath, 'utf8');
        } catch {
            return;
        }
        const missing = findMissingInLog(text);
        if (missing.length === 0) {
            return;
        }
        // Never act twice on the same failure (e.g. a package we can't find).
        const key = `${projectDir}\n${missing.join('\n')}`;
        if (this.handled.has(key)) {
            return;
        }
        this.handled.add(key);

        const dist = this.getStatus()?.diagnose?.tex_distribution;
        const canInstall = !!dist && dist.can_install_packages && (dist.kind === 'tinytex' || dist.kind === 'texlive');
        if (!canInstall) {
            const choice = await vscode.window.showWarningMessage(
                `LaTeX: missing ${missing.join(', ')}. Your LaTeX distribution doesn't let LaTeX Forge install packages automatically.`,
                'Show How to Fix'
            );
            if (choice === 'Show How to Fix') {
                this.outputChannel.show(true);
                await runLatexForge(['build', projectDir], { outputChannel: this.outputChannel });
            }
            return;
        }

        this.running.add(projectDir);
        try {
            const result = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'LaTeX Forge',
                },
                async (progress) => {
                    progress.report({ message: `Installing what this document needs: ${missing.join(', ')}…` });
                    return runLatexForge(['build', projectDir], { outputChannel: this.outputChannel });
                }
            );
            if (result.exitCode === 0) {
                void vscode.window.showInformationMessage(
                    `LaTeX Forge installed the missing LaTeX packages (${missing.join(', ')}); the PDF is up to date.`
                );
            } else {
                const choice = await vscode.window.showWarningMessage(
                    'LaTeX Forge tried to install the missing LaTeX packages, but the document still does not compile.',
                    'Open Output'
                );
                if (choice === 'Open Output') {
                    this.outputChannel.show();
                }
            }
        } finally {
            this.running.delete(projectDir);
        }
    }
}
