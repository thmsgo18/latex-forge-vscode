import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { isLatexForgeAvailable, promptInstallLatexForge } from '../cliDetection';
import { runLatexForge } from '../cliRunner';
import { RepoMode, SharingMode, Visibility, readConfig } from '../config';
import { isGhAuthenticated, isGhCliAvailable, promptGhLogin, promptInstallGhCli } from '../githubDetection';
import { pickTemplate } from '../templates';

const PROJECT_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

const REPO_MODE_ITEMS: { label: string; detail: string; mode: RepoMode }[] = [
    { label: 'Create a new GitHub repository', detail: 'gh creates it for you and pushes the initial commit', mode: 'create' },
    { label: 'This folder is already versioned', detail: 'e.g. a subfolder of an existing GitHub repo — nothing git-related is touched', mode: 'existing' },
    { label: "Don't version this project", detail: 'Fully local, nothing tracked', mode: 'none' }
];

const SHARING_ITEMS: { label: string; detail: string; sharing: SharingMode }[] = [
    { label: 'full', detail: 'Share the LaTeX sources and the compiled PDF', sharing: 'full' },
    { label: 'pdf-only', detail: 'Share only the compiled PDF, keep sources local', sharing: 'pdf-only' }
];

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

async function askRepoMode(defaultMode: RepoMode): Promise<RepoMode | undefined> {
    const items = REPO_MODE_ITEMS.map((item) => ({
        ...item,
        description: item.mode === defaultMode ? '(default)' : undefined
    }));
    const picked = await vscode.window.showQuickPick(items, {
        title: 'LaTeX Forge: Create Project',
        placeHolder: 'How should this project be versioned?'
    });
    return picked?.mode;
}

async function askRepoName(defaultName: string): Promise<string | undefined> {
    return vscode.window.showInputBox({
        title: 'LaTeX Forge: Create Project',
        prompt: 'Name of the GitHub repository to create',
        value: defaultName
    });
}

async function askVisibility(defaultVisibility: Visibility): Promise<Visibility | undefined> {
    const items: { label: string; visibility: Visibility }[] = [
        { label: 'private', visibility: 'private' },
        { label: 'public', visibility: 'public' }
    ];
    const picked = await vscode.window.showQuickPick(
        items.map((item) => ({ ...item, description: item.visibility === defaultVisibility ? '(default)' : undefined })),
        { title: 'LaTeX Forge: Create Project', placeHolder: 'Visibility of the new GitHub repository' }
    );
    return picked?.visibility;
}

async function askSharing(defaultSharing: SharingMode): Promise<SharingMode | undefined> {
    const items = SHARING_ITEMS.map((item) => ({
        ...item,
        description: item.sharing === defaultSharing ? '(default)' : undefined
    }));
    const picked = await vscode.window.showQuickPick(items, {
        title: 'LaTeX Forge: Create Project',
        placeHolder: 'What should be versioned?'
    });
    return picked?.sharing;
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
    const trimmedName = name.trim();

    const outputDirectory = await pickOutputDirectory();
    if (!outputDirectory) {
        return;
    }

    const config = await readConfig();

    const repoMode = await askRepoMode(config.defaultRepoMode ?? 'none');
    if (!repoMode) {
        return;
    }

    let repoName: string | undefined;
    let visibility: Visibility | undefined;

    if (repoMode === 'create') {
        if (!(await isGhCliAvailable())) {
            await promptInstallGhCli();
            return;
        }
        if (!(await isGhAuthenticated())) {
            await promptGhLogin();
            return;
        }

        repoName = await askRepoName(trimmedName);
        if (!repoName) {
            return;
        }

        visibility = await askVisibility(config.defaultVisibility ?? 'private');
        if (!visibility) {
            return;
        }

        const confirmed = await vscode.window.showWarningMessage(
            `Create a ${visibility} repository named "${repoName}" on your GitHub account?`,
            { modal: true },
            'Create'
        );
        if (confirmed !== 'Create') {
            return;
        }
    }

    let sharing: SharingMode | undefined;
    if (repoMode === 'create' || repoMode === 'existing') {
        sharing = await askSharing(config.defaultSharing ?? 'full');
        if (!sharing) {
            return;
        }
    }

    const args = ['create', '--name', trimmedName, '--template', template, '--output', outputDirectory, '--repo', repoMode];
    if (repoMode === 'create') {
        args.push('--repo-name', repoName!, '--visibility', visibility!);
        if (config.buildBeforeCommit) {
            args.push('--build-before-commit');
        }
    }
    if (sharing) {
        args.push('--sharing', sharing);
    }

    outputChannel.show(true);

    const result = await runLatexForge(args, { outputChannel });

    if (result.exitCode === 0) {
        const projectPath = path.join(outputDirectory, trimmedName);
        const repoUrlLine = result.stdout.split('\n').find((line) => line.startsWith('GitHub repo: '));
        const repoSuffix = repoUrlLine ? ` — ${repoUrlLine.replace('GitHub repo: ', '').trim()}` : '';
        const choice = await vscode.window.showInformationMessage(
            `LaTeX Forge project "${trimmedName}" created successfully (versioning: ${repoMode})${repoSuffix}.`,
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
