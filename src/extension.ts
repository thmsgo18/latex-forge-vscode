import * as vscode from 'vscode';
import { createProjectCommand } from './commands/createProject';

export function activate(context: vscode.ExtensionContext): void {
    const outputChannel = vscode.window.createOutputChannel('LaTeX Forge');
    context.subscriptions.push(outputChannel);

    context.subscriptions.push(
        vscode.commands.registerCommand('latex-forge.createProject', () => createProjectCommand(outputChannel))
    );
}

export function deactivate(): void {
    // Nothing to clean up: subscriptions are disposed by the extension host.
}
