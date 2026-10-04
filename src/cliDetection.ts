import { execFile } from 'child_process';
import * as vscode from 'vscode';
import { getCliEnv } from './cliEnv';

export const LATEX_FORGE_BINARY = 'latex-forge';
const PYPI_URL = 'https://pypi.org/project/latex-forge/';
const INSTALL_COMMAND = 'uv tool install latex-forge   # or: pipx install latex-forge';

// Installs the CLI on demand; registered at activation (see SetupWizard).
let cliInstaller: (() => Promise<boolean>) | undefined;

export function setCliInstaller(installer: () => Promise<boolean>): void {
    cliInstaller = installer;
}

/**
 * Resolves once `latex-forge --version` succeeds, or false if the binary
 * cannot be found or fails to run.
 */
export function isLatexForgeAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
        execFile(LATEX_FORGE_BINARY, ['--version'], { env: getCliEnv() }, (error) => {
            resolve(!error);
        });
    });
}

/**
 * Shows a warning explaining that the CLI is missing and offers to install
 * it automatically (no Python or pipx needed), to copy a manual install
 * command, or to open its PyPI page. Resolves with whether the CLI is
 * available afterwards.
 */
export async function promptInstallLatexForge(): Promise<boolean> {
    const autoAction = 'Install automatically';
    const copyAction = 'Copy install command';
    const pypiAction = 'Open PyPI page';

    const actions = cliInstaller ? [autoAction, copyAction, pypiAction] : [copyAction, pypiAction];
    const choice = await vscode.window.showWarningMessage(
        'The LaTeX Forge CLI is not installed. LaTeX Forge can install it for you — no Python or pipx needed.',
        ...actions
    );

    if (choice === autoAction && cliInstaller) {
        return cliInstaller();
    }
    if (choice === copyAction) {
        await vscode.env.clipboard.writeText(INSTALL_COMMAND);
        await vscode.window.showInformationMessage(
            `Copied "${INSTALL_COMMAND}" to the clipboard. Run it in a terminal, then try again.`
        );
    } else if (choice === pypiAction) {
        await vscode.env.openExternal(vscode.Uri.parse(PYPI_URL));
    }
    return false;
}

/**
 * For commands that need the CLI: true if it's there, otherwise offers to
 * install it and resolves with the outcome, so the command can carry on.
 */
export async function ensureCliAvailable(): Promise<boolean> {
    if (await isLatexForgeAvailable()) {
        return true;
    }
    return promptInstallLatexForge();
}
