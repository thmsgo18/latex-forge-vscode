import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { isLatexForgeAvailable, promptInstallLatexForge } from '../cliDetection';
import { runLatexForge } from '../cliRunner';
import { readConfig } from '../config';
import { pickTemplate } from '../templates';

const PROJECT_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

/**
 * Returns true if the given folder looks like an existing LaTeX project,
 * i.e. it contains at least one .tex file directly at its root.
 */
function looksLikeLatexProject(folderPath: string): boolean {
    try {
        return fs.readdirSync(folderPath).some((entry) => entry.endsWith('.tex'));
    } catch {
        return false;
    }
}

async function askInitGit(): Promise<boolean | undefined> {
    const picked = await vscode.window.showQuickPick(
        [
            { label: 'Yes', value: true },
            { label: 'No', value: false }
        ],
        { title: 'LaTeX Forge: Create Project', placeHolder: 'Initialize a git repository?' }
    );
    return picked?.value;
}

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

/**
 * Asks the user to pick a destination folder, looping if they choose a folder
 * that already looks like a LaTeX project (contains .tex files at its root).
 */
async function pickOutputDirectory(): Promise<string | undefined> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    let defaultUri = workspaceFolders?.[0]?.uri;

    for (let attempt = 0; attempt < 20; attempt++) {
        const picked = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select destination folder',
            defaultUri
        });

        if (!picked || picked.length === 0) {
            return undefined; // user cancelled
        }

        const folderPath = picked[0].fsPath;

        if (!looksLikeLatexProject(folderPath)) {
            return folderPath; // clean folder — proceed
        }

        const choice = await vscode.window.showWarningMessage(
            `"${path.basename(folderPath)}" already contains LaTeX files — creating a project here would nest projects inside each other.`,
            'Choose another folder',
            'Create here anyway'
        );

        if (choice === 'Create here anyway') {
            return folderPath;
        }
        if (!choice) {
            return undefined; // user dismissed the warning
        }
        // 'Choose another folder': loop, re-opening at the same location
        defaultUri = picked[0];
    }

    return undefined;
}

export async function createProjectCommand(
    outputChannel: vscode.OutputChannel,
    preselectedTemplate?: string
): Promise<void> {
    if (!(await isLatexForgeAvailable())) {
        await promptInstallLatexForge();
        return;
    }

    // When called from "Install & Create" in the gallery the template is
    // already known — skip the picker to avoid a redundant step.
    const template = preselectedTemplate
        ?? await pickTemplate({ title: 'LaTeX Forge: Create Project' });
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

    const initGit = await askInitGit();
    if (initGit === undefined) {
        return;
    }

    const config = await readConfig();
    const sharing = config.defaultSharing ?? 'full';

    const args = ['create', '--name', name.trim(), '--template', template, '--output', outputDirectory, '--sharing', sharing];
    if (initGit) {
        args.push('--git');
        if (sharing !== 'none' && config.buildBeforeCommit) {
            args.push('--build-before-commit');
        }
    }

    outputChannel.show(true);

    const result = await runLatexForge(args, { outputChannel });

    if (result.exitCode === 0) {
        const projectPath = path.join(outputDirectory, name.trim());
        const choice = await vscode.window.showInformationMessage(
            `LaTeX Forge project "${name.trim()}" created successfully (sharing: ${sharing}).`,
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
