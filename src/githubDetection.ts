import { execFile } from 'child_process';
import * as os from 'os';
import * as vscode from 'vscode';
import { getCliEnv } from './cliEnv';

const GH_CLI_URL = 'https://cli.github.com/';

/**
 * Resolves once `gh --version` succeeds, or false if the binary cannot be
 * found or fails to run.
 */
export function isGhCliAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
        execFile('gh', ['--version'], { env: getCliEnv() }, (error) => {
            resolve(!error);
        });
    });
}

/**
 * Resolves once `gh auth status` succeeds (exit code 0), meaning the user is
 * authenticated against github.com.
 */
export function isGhAuthenticated(): Promise<boolean> {
    return new Promise((resolve) => {
        execFile('gh', ['auth', 'status'], { env: getCliEnv() }, (error) => {
            resolve(!error);
        });
    });
}

function installCommandForPlatform(): string {
    switch (os.platform()) {
        case 'darwin':
            return 'brew install gh';
        case 'win32':
            return 'winget install --id GitHub.cli';
        default:
            return 'sudo apt-get install gh   # or: sudo dnf install gh / sudo pacman -S github-cli';
    }
}

/**
 * Shows a warning explaining that the GitHub CLI is missing and offers
 * shortcuts to install it (via the host's package manager) or to open its
 * homepage. Mirrors `promptInstallLatexForge` in `cliDetection.ts`.
 */
export async function promptInstallGhCli(): Promise<void> {
    const installAction = 'Copy install command';
    const websiteAction = 'Open cli.github.com';

    const choice = await vscode.window.showWarningMessage(
        'The GitHub CLI (gh) was not found on your PATH. It is required to create a new GitHub repository.',
        installAction,
        websiteAction
    );

    if (choice === installAction) {
        const command = installCommandForPlatform();
        await vscode.env.clipboard.writeText(command);
        await vscode.window.showInformationMessage(`Copied "${command}" to the clipboard. Run it in a terminal, then try again.`);
    } else if (choice === websiteAction) {
        await vscode.env.openExternal(vscode.Uri.parse(GH_CLI_URL));
    }
}

/**
 * Shows a warning explaining that the user isn't authenticated with the
 * GitHub CLI, and offers to open an integrated terminal running
 * `gh auth login` — this has to be a real interactive terminal, since the
 * device-code OAuth flow can't be driven from our own non-interactive calls.
 */
export async function promptGhLogin(): Promise<void> {
    const loginAction = 'Run "gh auth login" in terminal';

    const choice = await vscode.window.showWarningMessage(
        'Not authenticated with the GitHub CLI. Log in to create a new GitHub repository.',
        loginAction
    );

    if (choice === loginAction) {
        const terminal = vscode.window.createTerminal('gh auth login');
        terminal.show();
        terminal.sendText('gh auth login');
    }
}
