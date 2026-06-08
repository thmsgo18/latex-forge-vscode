import * as vscode from 'vscode';
import { browseGalleryCommand } from './commands/browseGallery';
import { buildProjectCommand } from './commands/buildProject';
import { cleanProjectCommand } from './commands/cleanProject';
import { configureDefaultsCommand } from './commands/configureDefaults';
import { createProjectCommand } from './commands/createProject';
import { installTemplateCommand } from './commands/installTemplate';
import { listTemplatesCommand } from './commands/listTemplates';
import { openPdfCommand } from './commands/openPdf';
import { removeTemplateCommand } from './commands/removeTemplate';
import { renameProjectCommand } from './commands/renameProject';
import { setupEnvironmentCommand } from './commands/setupEnvironment';
import { checkForCliUpdate } from './cliUpdater';
import { TemplateInfo } from './templates';
import { ProjectTreeProvider } from './projectTreeProvider';
import { TemplatesTreeProvider } from './templatesTreeProvider';

export function activate(context: vscode.ExtensionContext): void {
    const outputChannel = vscode.window.createOutputChannel('LaTeX Forge');
    context.subscriptions.push(outputChannel);

    // Project actions view (Build / Clean / Open PDF)
    const projectProvider = new ProjectTreeProvider();
    // Refresh the project view whenever the workspace folders change (folder
    // opened / closed) so the welcome message and items stay in sync.
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(() => projectProvider.refresh())
    );

    // Templates view
    const templatesProvider = new TemplatesTreeProvider(outputChannel);
    const refreshTemplates = () => templatesProvider.refresh();

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('latexForgeProject', projectProvider),
        vscode.window.registerTreeDataProvider('latexForgeTemplates', templatesProvider),

        vscode.commands.registerCommand('latex-forge.buildProject', () =>
            buildProjectCommand(outputChannel)
        ),
        vscode.commands.registerCommand('latex-forge.cleanProject', () => cleanProjectCommand()),
        vscode.commands.registerCommand('latex-forge.openPdf', () => openPdfCommand()),
        vscode.commands.registerCommand('latex-forge.createProject', () => createProjectCommand(outputChannel)),
        vscode.commands.registerCommand('latex-forge.renameProject', () => renameProjectCommand(outputChannel)),
        vscode.commands.registerCommand('latex-forge.setupEnvironment', () => setupEnvironmentCommand(outputChannel)),
        vscode.commands.registerCommand('latex-forge.listTemplates', () => listTemplatesCommand(outputChannel)),
        vscode.commands.registerCommand('latex-forge.configureDefaults', () => configureDefaultsCommand(outputChannel)),
        vscode.commands.registerCommand('latex-forge.refreshTemplates', refreshTemplates),
        vscode.commands.registerCommand('latex-forge.installTemplate', () =>
            installTemplateCommand(outputChannel, refreshTemplates)
        ),
        vscode.commands.registerCommand('latex-forge.browseGallery', () =>
            browseGalleryCommand(outputChannel, refreshTemplates)
        ),
        vscode.commands.registerCommand('latex-forge.removeTemplate', (item?: TemplateInfo) =>
            removeTemplateCommand(outputChannel, refreshTemplates, item?.name)
        ),
        vscode.commands.registerCommand('latex-forge.checkForUpdate', () =>
            checkForCliUpdate(outputChannel, /* force */ true)
        )
    );

    // Check for a CLI update silently in the background once per session.
    // Never awaited — a slow network or an offline machine must not delay activation.
    void checkForCliUpdate(outputChannel);
}

export function deactivate(): void {
    // Nothing to clean up: subscriptions are disposed by the extension host.
}
