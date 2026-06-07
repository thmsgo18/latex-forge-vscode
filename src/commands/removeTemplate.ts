import * as vscode from 'vscode';
import { isLatexForgeAvailable, promptInstallLatexForge } from '../cliDetection';
import { runLatexForge } from '../cliRunner';
import { listTemplates } from '../templates';

async function pickUserTemplate(outputChannel: vscode.OutputChannel): Promise<string | undefined> {
    const templates = await listTemplates(outputChannel);
    const userTemplates = templates.filter((template) => !template.builtin);

    if (userTemplates.length === 0) {
        await vscode.window.showInformationMessage('There are no user-installed LaTeX Forge templates to remove.');
        return undefined;
    }

    const selected = await vscode.window.showQuickPick(
        userTemplates.map((template) => ({ label: template.name })),
        { title: 'LaTeX Forge: Remove Template', placeHolder: 'Select a template to remove' }
    );

    return selected?.label;
}

async function confirmRemoval(name: string): Promise<boolean> {
    const confirmAction = 'Remove';
    const choice = await vscode.window.showWarningMessage(
        `Remove the user-installed template "${name}"? This cannot be undone.`,
        { modal: true },
        confirmAction
    );
    return choice === confirmAction;
}

export async function removeTemplateCommand(
    outputChannel: vscode.OutputChannel,
    onRemoved?: () => void,
    templateName?: string
): Promise<void> {
    if (!(await isLatexForgeAvailable())) {
        await promptInstallLatexForge();
        return;
    }

    const name = templateName ?? (await pickUserTemplate(outputChannel));
    if (!name) {
        return;
    }

    if (!(await confirmRemoval(name))) {
        return;
    }

    outputChannel.show(true);

    const result = await runLatexForge(['template', 'remove', name], { outputChannel });

    if (result.exitCode === 0) {
        await vscode.window.showInformationMessage(`Template "${name}" removed.`);
        onRemoved?.();
    } else {
        await vscode.window.showErrorMessage(
            `Failed to remove template "${name}" (exit code ${result.exitCode}). See the "LaTeX Forge" output channel for details.`
        );
    }
}
