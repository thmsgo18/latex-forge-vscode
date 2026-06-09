import * as path from 'path';
import * as vscode from 'vscode';
import { isLatexForgeAvailable, promptInstallLatexForge } from '../cliDetection';
import { runLatexForge } from '../cliRunner';
import { pickTemplate } from '../templates';

const PROJECT_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

async function askProjectName(): Promise<string | undefined> {
    return vscode.window.showInputBox({
        title: 'LaTeX Forge: Create Project',
        prompt: 'Name of the new project',
        placeHolder: 'my-project',
        validateInput: (value) => {
            const trimmed = value.trim();
            if (trimmed.length === 0) {
                return 'Project name cannot be empty.';
            }
            if (!PROJECT_NAME_PATTERN.test(trimmed)) {
                return 'Use only letters, digits, dots, dashes and underscores.';
            }
            return undefined;
        }
    });
}

async function pickOutputDirectory(): Promise<string | undefined> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    const picked = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select destination folder',
        // Pre-open the current workspace folder so the user starts there,
        // but still has to confirm the location explicitly.
        defaultUri: workspaceFolders?.[0]?.uri
    });

    return picked?.[0]?.fsPath;
}

export async function createProjectCommand(outputChannel: vscode.OutputChannel): Promise<void> {
    if (!(await isLatexForgeAvailable())) {
        await promptInstallLatexForge();
        return;
    }

    const template = await pickTemplate(outputChannel, { title: 'LaTeX Forge: Create Project' });
    if (!template) {
        return;
    }

    const name = await askProjectName();
    if (!name) {
        return;
    }

    const outputDirectory = await pickOutputDirectory();
    if (!outputDirectory) {
        return;
    }

    outputChannel.show(true);

    const result = await runLatexForge(
        ['create', '--name', name.trim(), '--template', template, '--output', outputDirectory],
        { outputChannel }
    );

    if (result.exitCode === 0) {
        const projectPath = path.join(outputDirectory, name.trim());
        const choice = await vscode.window.showInformationMessage(
            `LaTeX Forge project "${name.trim()}" created successfully.`,
            'Open Project'
        );
        if (choice === 'Open Project') {
            await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath), {
                forceNewWindow: false
            });
        }
    } else {
        await vscode.window.showErrorMessage(
            `LaTeX Forge failed to create the project (exit code ${result.exitCode}). See the "LaTeX Forge" output channel for details.`
        );
    }
}
