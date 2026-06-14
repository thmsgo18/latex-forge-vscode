import * as vscode from 'vscode';
import { isLatexForgeAvailable, promptInstallLatexForge } from './cliDetection';
import { execLatexForge, runLatexForge } from './cliRunner';

const SETUP_PROMPTED_KEY = 'latexForge.setupPrompted';

/**
 * On the extension's first-ever activation, checks whether the LaTeX Forge
 * CLI and a working LaTeX toolchain (a TeX distribution + latexmk) are
 * present, and if not, offers a one-click setup.
 *
 * Gated on `globalState` so this only ever runs once per machine, regardless
 * of whether the user acts on the notification.
 */
export async function maybeOfferSetup(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
): Promise<void> {
    if (context.globalState.get<boolean>(SETUP_PROMPTED_KEY)) {
        return;
    }
    await context.globalState.update(SETUP_PROMPTED_KEY, true);

    if (!(await isLatexForgeAvailable())) {
        await promptInstallLatexForge();
        return;
    }

    // `latex-forge diagnose --json` exits 1 if a TeX distribution or
    // latexmk is missing, 0 otherwise — no need to parse its output.
    const diagnoseResult = await execLatexForge(['diagnose', '--json']);
    if (diagnoseResult.exitCode === 0) {
        return;
    }

    const choice = await vscode.window.showInformationMessage(
        'LaTeX Forge: no LaTeX distribution (with latexmk) was found. ' +
        'Install it now? This downloads MiKTeX/TeX Live and can take several minutes.',
        'Run Setup Now',
        'Later'
    );

    if (choice !== 'Run Setup Now') {
        return;
    }

    outputChannel.show(true);
    const setupResult = await runLatexForge(['setup', '--install-tex'], { outputChannel });

    if (setupResult.exitCode === 0) {
        await vscode.window.showInformationMessage(
            'LaTeX Forge: setup completed. Restart VS Code before compiling.'
        );
    } else {
        await vscode.window.showWarningMessage(
            `LaTeX Forge setup finished with exit code ${setupResult.exitCode}. ` +
            'See the "LaTeX Forge" output channel for details.'
        );
    }
}
