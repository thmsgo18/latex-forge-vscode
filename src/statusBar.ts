import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/** Manages the LaTeX Forge status bar item. */
export class StatusBarManager {
    private readonly item: vscode.StatusBarItem;
    private updateAvailable: string | undefined;

    constructor(context: vscode.ExtensionContext) {
        this.item = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.item.command = 'workbench.view.extension.latexForge';
        context.subscriptions.push(this.item);

        this.refresh();

        context.subscriptions.push(
            vscode.workspace.onDidChangeWorkspaceFolders(() => this.refresh())
        );
    }

    /** Called by cliUpdater when a newer CLI version is detected. */
    notifyUpdateAvailable(version: string): void {
        this.updateAvailable = version;
        this.refresh();
    }

    /** Called after a successful CLI upgrade to clear the indicator. */
    clearUpdateAvailable(): void {
        this.updateAvailable = undefined;
        this.refresh();
    }

    private refresh(): void {
        const label = this.projectLabel();
        const hasUpdate = !!this.updateAvailable;

        this.item.text = hasUpdate
            ? `$(file-code) ${label} $(arrow-up)`
            : `$(file-code) ${label}`;

        this.item.tooltip = hasUpdate
            ? `LaTeX Forge — CLI ${this.updateAvailable} available. Click to open panel.`
            : 'LaTeX Forge — click to open panel';

        this.item.backgroundColor = undefined;
        this.item.show();
    }

    /**
     * Returns the workspace folder name when a LaTeX project is detected
     * (folder has at least one .tex file at its root), otherwise "LaTeX Forge".
     */
    private projectLabel(): string {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            return 'LaTeX Forge';
        }
        const root = folders[0].uri.fsPath;
        try {
            const hasTeX = fs.readdirSync(root).some((f) => f.endsWith('.tex'));
            if (hasTeX) {
                return path.basename(root);
            }
        } catch {
            // If we can't read the folder, fall back to generic label
        }
        return 'LaTeX Forge';
    }
}
