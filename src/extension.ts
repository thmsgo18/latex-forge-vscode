import * as vscode from 'vscode';
import { browseGalleryCommand } from './commands/browseGallery';
import { diagnoseCommand } from './commands/diagnose';
import { editProfileCommand } from './commands/editProfile';
import { configureDefaultsCommand } from './commands/configureDefaults';
import { createProjectCommand } from './commands/createProject';
import { installTemplateCommand } from './commands/installTemplate';
import { listTemplatesCommand } from './commands/listTemplates';
import { removeTemplateCommand } from './commands/removeTemplate';
import { renameProjectCommand } from './commands/renameProject';
import { setupEnvironmentCommand } from './commands/setupEnvironment';
import { updateTemplatesCommand } from './commands/updateTemplates';
import { checkForCliUpdate, setUpdateAvailableCallback } from './cliUpdater';
import { ProjectTreeProvider } from './projectTreeProvider';
import { StatusBarManager } from './statusBar';
import { TemplateInfo } from './templates';
import { TemplatesTreeProvider } from './templatesTreeProvider';

export function activate(context: vscode.ExtensionContext): void {
    const outputChannel = vscode.window.createOutputChannel('LaTeX Forge');
    context.subscriptions.push(outputChannel);

    // Status bar — must be created before checkForCliUpdate runs so the
    // update callback is registered in time.
    const statusBar = new StatusBarManager(context);
    setUpdateAvailableCallback((v) => statusBar.notifyUpdateAvailable(v));

    const projectProvider = new ProjectTreeProvider(context);
    const templatesProvider = new TemplatesTreeProvider(outputChannel);
    const refreshTemplates = () => templatesProvider.refresh();

    // Callback used by "Install & Create" in the gallery: runs createProject
    // with the just-installed template pre-selected, skipping the picker.
    const onInstallAndCreate = (templateName: string) =>
        createProjectCommand(outputChannel, templateName);

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('latexForgeProject', projectProvider),
        vscode.window.registerTreeDataProvider('latexForgeTemplates', templatesProvider),

        vscode.commands.registerCommand('latex-forge.createProject', () =>
            createProjectCommand(outputChannel)
        ),
        vscode.commands.registerCommand('latex-forge.renameProject', () =>
            renameProjectCommand(outputChannel)
        ),
        vscode.commands.registerCommand('latex-forge.renameCurrentProject', () => {
            const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            return renameProjectCommand(outputChannel, root);
        }),
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
            browseGalleryCommand(outputChannel, refreshTemplates, onInstallAndCreate)
        ),
        vscode.commands.registerCommand('latex-forge.removeTemplate', (item?: TemplateInfo) =>
            removeTemplateCommand(outputChannel, refreshTemplates, item?.name)
        ),
        vscode.commands.registerCommand('latex-forge.editProfile', () =>
            editProfileCommand()
        ),
        vscode.commands.registerCommand('latex-forge.updateTemplates', () =>
            updateTemplatesCommand(outputChannel, refreshTemplates)
        ),
        vscode.commands.registerCommand('latex-forge.diagnose', () =>
            diagnoseCommand(outputChannel)
        ),
        vscode.commands.registerCommand('latex-forge.checkForUpdate', () =>
            checkForCliUpdate(outputChannel, /* force */ true)
        ),
    );

    // Check for a CLI update silently in the background once per session.
    void checkForCliUpdate(outputChannel);
}

export function deactivate(): void {
    // Nothing to clean up: subscriptions are disposed by the extension host.
}
