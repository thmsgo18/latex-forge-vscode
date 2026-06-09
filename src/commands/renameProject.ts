import * as path from 'path';
import * as vscode from 'vscode';
import { isLatexForgeAvailable, promptInstallLatexForge } from '../cliDetection';
import { runLatexForge } from '../cliRunner';

const PROJECT_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

async function pickProjectFolder(): Promise<string | undefined> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const defaultUri = workspaceFolders?.[0]?.uri;

    const picked = await vscode.window.showOpenDialog({
        title: 'LaTeX Forge: Rename Project',
        defaultUri,
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select project folder to rename'
    });

    return picked?.[0]?.fsPath;
}

async function askNewName(currentName: string): Promise<string | undefined> {
    return vscode.window.showInputBox({
        title: 'LaTeX Forge: Rename Project',
        prompt: `New name for "${currentName}"`,
        value: currentName,
        valueSelection: [0, currentName.length],
        validateInput: (value) => {
            const trimmed = value.trim();
            if (trimmed.length === 0) {
                return 'Project name cannot be empty.';
            }
            if (trimmed === currentName) {
                return 'Enter a different name.';
            }
            if (!PROJECT_NAME_PATTERN.test(trimmed)) {
                return 'Use only letters, digits, dots, dashes and underscores.';
            }
            return undefined;
        }
    });
}

/**
 * @param folderPath  When provided, skips the folder picker (used from the
 *                    panel when the workspace is already a LaTeX project).
 */
export async function renameProjectCommand(
    outputChannel: vscode.OutputChannel,
    folderPath?: string
): Promise<void> {
    if (!(await isLatexForgeAvailable())) {
        await promptInstallLatexForge();
        return;
    }

    const projectPath = folderPath ?? await pickProjectFolder();
    if (!projectPath) {
        return;
    }

    const currentName = path.basename(projectPath);
    const newName = await askNewName(currentName);
    if (!newName) {
        return;
    }

    outputChannel.show(true);

    const result = await runLatexForge(['rename', newName.trim()], {
        cwd: projectPath,
        outputChannel
    });

    if (result.exitCode === 0) {
        const renamedPath = path.join(path.dirname(projectPath), newName.trim());
        const openAction = 'Open Renamed Project';
        const choice = await vscode.window.showInformationMessage(
            `Project renamed to "${newName.trim()}".`,
            openAction
        );
        if (choice === openAction) {
            await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(renamedPath), {
                forceNewWindow: false
            });
        }
    } else {
        await vscode.window.showErrorMessage(
            `LaTeX Forge failed to rename the project (exit code ${result.exitCode}). See the "LaTeX Forge" output channel for details.`
        );
    }
}
