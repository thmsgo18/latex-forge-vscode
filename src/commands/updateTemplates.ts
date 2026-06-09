import * as vscode from 'vscode';
import { execLatexForge } from '../cliRunner';

interface UpdateEntry {
    name: string;
    status: 'updated' | 'up_to_date' | 'skipped' | 'error';
    from?: string;
    to?: string;
    reason?: string;
}

function statusIcon(status: UpdateEntry['status']): string {
    switch (status) {
        case 'updated':   return '↑';
        case 'up_to_date': return '✓';
        case 'skipped':   return '–';
        case 'error':     return '✗';
    }
}

/**
 * Runs `latex-forge template update --json`, parses the results, and displays
 * a formatted summary in the output channel plus a summary notification.
 */
export async function updateTemplatesCommand(
    outputChannel: vscode.OutputChannel,
    onUpdated?: () => void
): Promise<void> {
    outputChannel.show(true);
    outputChannel.appendLine('');
    outputChannel.appendLine('$ latex-forge template update --json');

    const result = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'LaTeX Forge: Checking for template updates…',
            cancellable: false
        },
        () => execLatexForge(['template', 'update', '--json'])
    );

    // Exit code 2 → nothing to update (not an error)
    if (result.exitCode === 2) {
        outputChannel.appendLine('All templates are already up to date.');
        void vscode.window.showInformationMessage('LaTeX Forge: All templates are up to date.');
        return;
    }

    if (result.exitCode !== 0 && !result.stdout.trim()) {
        outputChannel.appendLine(`Error: process exited with code ${result.exitCode}.`);
        if (result.stderr.trim()) {
            outputChannel.appendLine(result.stderr.trim());
        }
        void vscode.window.showErrorMessage('LaTeX Forge: Failed to update templates. See the output channel.');
        return;
    }

    let entries: UpdateEntry[];
    try {
        entries = JSON.parse(result.stdout);
    } catch {
        outputChannel.appendLine('Error: could not parse update results.');
        outputChannel.appendLine(result.stdout);
        void vscode.window.showErrorMessage('LaTeX Forge: Unexpected output from template update. See the output channel.');
        return;
    }

    // Format results in the output channel
    const updated   = entries.filter((e) => e.status === 'updated');
    const errors    = entries.filter((e) => e.status === 'error');

    outputChannel.appendLine('');
    outputChannel.appendLine('Template update results:');
    for (const e of entries) {
        const icon = statusIcon(e.status);
        if (e.status === 'updated' && e.from && e.to) {
            outputChannel.appendLine(`  ${icon}  ${e.name}: ${e.from} → ${e.to}`);
        } else if (e.status === 'error') {
            outputChannel.appendLine(`  ${icon}  ${e.name}: ${e.reason ?? 'unknown error'}`);
        } else {
            outputChannel.appendLine(`  ${icon}  ${e.name}`);
        }
    }
    outputChannel.appendLine('');

    // Summary notification
    if (errors.length > 0) {
        const names = errors.map((e) => e.name).join(', ');
        void vscode.window.showWarningMessage(
            `LaTeX Forge: ${updated.length} template(s) updated. Errors in: ${names}.`
        );
    } else if (updated.length > 0) {
        const names = updated.map((e) => e.name).join(', ');
        void vscode.window.showInformationMessage(
            `LaTeX Forge: ${updated.length} template(s) updated: ${names}.`
        );
        onUpdated?.();
    } else {
        void vscode.window.showInformationMessage('LaTeX Forge: All templates are up to date.');
    }
}
