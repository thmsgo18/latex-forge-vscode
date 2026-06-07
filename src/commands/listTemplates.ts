import * as vscode from 'vscode';
import { isLatexForgeAvailable, promptInstallLatexForge } from '../cliDetection';
import { runLatexForge } from '../cliRunner';

export async function listTemplatesCommand(outputChannel: vscode.OutputChannel): Promise<void> {
    if (!(await isLatexForgeAvailable())) {
        await promptInstallLatexForge();
        return;
    }

    outputChannel.show(true);

    const result = await runLatexForge(['list-templates'], { outputChannel });

    if (result.exitCode !== 0) {
        await vscode.window.showErrorMessage(
            `Failed to list LaTeX Forge templates (exit code ${result.exitCode}). See the "LaTeX Forge" output channel for details.`
        );
    }
}
