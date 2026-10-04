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

/** The command that installs gh with this platform's package manager. */
export function installCommandForPlatform(platform: string = os.platform()): string {
    switch (platform) {
        case 'darwin':
            return 'brew install gh';
        case 'win32':
            return 'winget install -e --id GitHub.cli';
        default:
            return 'sudo apt-get install gh   # or: sudo dnf install gh / sudo pacman -S github-cli';
    }
}

/**
 * Installs gh in an integrated terminal: package managers may ask for a
 * password, which only a real terminal can collect.
 */
export function runGhInstallInTerminal(): void {
    const terminal = vscode.window.createTerminal({ name: 'Install GitHub CLI', env: { PATH: getCliEnv().PATH } });
    terminal.show();
    terminal.sendText(installCommandForPlatform().split('   #')[0]);
}

/**
 * Shows a warning explaining that the GitHub CLI is missing and offers to
 * install it in a terminal, to copy the install command, or to open its
 * homepage. Mirrors `promptInstallLatexForge` in `cliDetection.ts`.
 */
export async function promptInstallGhCli(): Promise<void> {
    const terminalAction = 'Install in terminal';
    const installAction = 'Copy install command';
    const websiteAction = 'Open cli.github.com';

    const choice = await vscode.window.showWarningMessage(
        'The GitHub CLI (gh) was not found on your PATH. It is required to create a new GitHub repository.',
        terminalAction,
        installAction,
        websiteAction
    );

    if (choice === terminalAction) {
        runGhInstallInTerminal();
    } else if (choice === installAction) {
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
        const terminal = vscode.window.createTerminal({ name: 'gh auth login', env: { PATH: getCliEnv().PATH } });
        terminal.show();
        terminal.sendText('gh auth login');
    }
}
