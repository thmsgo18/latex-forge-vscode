import * as vscode from 'vscode';
import { isLatexForgeAvailable, promptInstallLatexForge } from '../cliDetection';
import { runLatexForge } from '../cliRunner';

interface SetupOption extends vscode.QuickPickItem {
    flag: string;
}

const SETUP_OPTIONS: SetupOption[] = [
    {
        flag: '--check-only',
        label: 'Check only',
        description: '--check-only',
        detail: 'Only check the current environment without installing anything.'
    },
    {
        flag: '--skip-extensions',
        label: 'Skip VS Code extension installation',
        description: '--skip-extensions',
        detail: 'Do not install the recommended VS Code extensions.'
    },
    {
        flag: '--install-tex',
        label: 'Install a LaTeX distribution',
        description: '--install-tex',
        detail: 'Try to install a LaTeX distribution with a common package manager for the current OS.'
    },
    {
        flag: '--install-gh',
        label: 'Install the GitHub CLI',
        description: '--install-gh',
        detail: 'Try to install the GitHub CLI (gh) with a common package manager. Needed to create a new GitHub repository from "Create Project".'
    }
];

async function pickSetupFlags(): Promise<string[] | undefined> {
    const selected = await vscode.window.showQuickPick(SETUP_OPTIONS, {
        title: 'LaTeX Forge: Setup Environment',
        placeHolder: 'Select options, or press Enter to run the default setup',
        canPickMany: true
    });

    if (selected === undefined) {
        return undefined;
    }

    return selected.map((option) => option.flag);
}

export async function setupEnvironmentCommand(outputChannel: vscode.OutputChannel): Promise<void> {
    if (!(await isLatexForgeAvailable())) {
        await promptInstallLatexForge();
        return;
    }

    const flags = await pickSetupFlags();
    if (flags === undefined) {
        return;
    }

    outputChannel.show(true);

    const result = await runLatexForge(['setup', ...flags], { outputChannel });

    if (result.exitCode === 0) {
        await vscode.window.showInformationMessage('LaTeX Forge setup completed successfully.');
    } else {
        await vscode.window.showErrorMessage(
            `LaTeX Forge setup finished with exit code ${result.exitCode}. See the "LaTeX Forge" output channel for details.`
        );
    }
}
