import * as vscode from 'vscode';
import { isLatexForgeAvailable, promptInstallLatexForge } from '../cliDetection';
import { runLatexForge } from '../cliRunner';

async function askSource(): Promise<string | undefined> {
    const value = await vscode.window.showInputBox({
        title: 'LaTeX Forge: Install Template',
        prompt: 'GitHub URL, ZIP URL, local directory, or local .zip file',
        placeHolder: 'https://github.com/user/template-repo',
        validateInput: (input) => (input.trim().length === 0 ? 'A template source is required.' : undefined)
    });

    return value?.trim();
}

async function askName(): Promise<string | undefined> {
    const value = await vscode.window.showInputBox({
        title: 'LaTeX Forge: Install Template',
        prompt: 'Name to give the installed template (leave empty to use the default)',
        placeHolder: 'my-template'
    });

    return value?.trim() || undefined;
}

export async function installTemplateCommand(
    outputChannel: vscode.OutputChannel,
    onInstalled?: () => void
): Promise<void> {
    if (!(await isLatexForgeAvailable())) {
        await promptInstallLatexForge();
        return;
    }

    const source = await askSource();
    if (!source) {
        return;
    }

    const name = await askName();

    outputChannel.show(true);

    const args = ['template', 'install', source];
    if (name) {
        args.push('--name', name);
    }

    const result = await runLatexForge(args, { outputChannel });

    if (result.exitCode === 0) {
        await vscode.window.showInformationMessage(`Template installed from "${source}".`);
        onInstalled?.();
    } else {
        await vscode.window.showErrorMessage(
            `Failed to install the template (exit code ${result.exitCode}). See the "LaTeX Forge" output channel for details.`
        );
    }
}
