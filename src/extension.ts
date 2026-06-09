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
import { ProjectTreeProvider } from './projectTreeProvider';
import { TemplateInfo } from './templates';
import { TemplatesTreeProvider } from './templatesTreeProvider';

export function activate(context: vscode.ExtensionContext): void {
    const outputChannel = vscode.window.createOutputChannel('LaTeX Forge');
    context.subscriptions.push(outputChannel);

    const projectProvider = new ProjectTreeProvider();
    const templatesProvider = new TemplatesTreeProvider(outputChannel);
    const refreshTemplates = () => templatesProvider.refresh();

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('latexForgeProject', projectProvider),
        vscode.window.registerTreeDataProvider('latexForgeTemplates', templatesProvider),

        vscode.commands.registerCommand('latex-forge.createProject', () =>
            createProjectCommand(outputChannel)
        ),
        vscode.commands.registerCommand('latex-forge.renameProject', () =>
            renameProjectCommand(outputChannel)
        ),
        vscode.commands.registerCommand('latex-forge.setupEnvironment', () =>
            setupEnvironmentCommand(outputChannel)
        ),
        vscode.commands.registerCommand('latex-forge.listTemplates', () =>
            listTemplatesCommand(outputChannel)
        ),
        vscode.commands.registerCommand('latex-forge.configureDefaults', () =>
            configureDefaultsCommand(outputChannel)
        ),
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
        ),
        // Build / Clean / Open PDF still available from the Command Palette
        // (⌘⇧P), delegating to LaTeX Workshop with a latexmk fallback.
        vscode.commands.registerCommand('latex-forge.buildProject', () =>
            buildProjectCommand(outputChannel)
        ),
        vscode.commands.registerCommand('latex-forge.cleanProject', () => cleanProjectCommand()),
        vscode.commands.registerCommand('latex-forge.openPdf', () => openPdfCommand())
    );

    // Check for a CLI update silently in the background once per session.
    void checkForCliUpdate(outputChannel);
}

export function deactivate(): void {
    // Nothing to clean up: subscriptions are disposed by the extension host.
}
