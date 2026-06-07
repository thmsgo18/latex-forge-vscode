import { execFile } from 'child_process';
import * as vscode from 'vscode';
import { getCliEnv } from './cliEnv';

export const LATEX_FORGE_BINARY = 'latex-forge';
const PYPI_URL = 'https://pypi.org/project/latex-forge/';

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
 * Shows a warning explaining that the CLI is missing and offers shortcuts to
 * install it (via pipx) or to open its PyPI page.
 */
export async function promptInstallLatexForge(): Promise<void> {
    const installAction = 'Copy install command';
    const pypiAction = 'Open PyPI page';

    const choice = await vscode.window.showWarningMessage(
        'LaTeX Forge CLI was not found on your PATH. Install it with pipx to use this extension.',
        installAction,
        pypiAction
    );

    if (choice === installAction) {
        await vscode.env.clipboard.writeText('pipx install latex-forge');
        await vscode.window.showInformationMessage(
            'Copied "pipx install latex-forge" to the clipboard. Run it in a terminal, then try again.'
        );
    } else if (choice === pypiAction) {
        await vscode.env.openExternal(vscode.Uri.parse(PYPI_URL));
    }
}
