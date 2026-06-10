import * as vscode from 'vscode';
import { isLatexForgeAvailable, promptInstallLatexForge } from '../cliDetection';
import { runLatexForge } from '../cliRunner';

/**
 * Handles `vscode://thmsgo18.latex-forge-vscode/install?template=<name>&installUrl=<url>`,
 * the link used by the "Open in VS Code" button on the gallery website.
 */
export function createInstallUriHandler(
    outputChannel: vscode.OutputChannel,
    onTemplateInstalled: () => void,
    onInstallAndCreate: (templateName: string) => Promise<void>
): vscode.UriHandler {
    return {
        async handleUri(uri: vscode.Uri): Promise<void> {
            if (uri.path !== '/install') {
                return;
            }

            const params = new URLSearchParams(uri.query);
            const name = params.get('template');
            const installUrl = params.get('installUrl');

            if (!name || !installUrl) {
                await vscode.window.showErrorMessage(
                    'LaTeX Forge: invalid "Open in VS Code" link — missing template name or install URL.'
                );
                return;
            }

            if (!(await isLatexForgeAvailable())) {
                await promptInstallLatexForge();
                return;
            }

            outputChannel.show(true);
            const result = await runLatexForge(['template', 'install', installUrl], { outputChannel });

            if (result.exitCode !== 0) {
                await vscode.window.showErrorMessage(
                    `Failed to install "${name}" (exit code ${result.exitCode}). See the "LaTeX Forge" output channel for details.`
                );
                return;
            }

            onTemplateInstalled();
            await onInstallAndCreate(name);
        }
    };
}
