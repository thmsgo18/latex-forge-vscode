import * as path from 'path';
import * as vscode from 'vscode';
import { browseGalleryCommand } from './commands/browseGallery';
import { diagnoseCommand } from './commands/diagnose';
import { editProfileCommand } from './commands/editProfile';
import { configureDefaultsCommand } from './commands/configureDefaults';
import { createProjectCommand } from './commands/createProject';
import { installTemplateCommand } from './commands/installTemplate';
import { listTemplatesCommand } from './commands/listTemplates';
import { createInstallUriHandler } from './commands/openFromUri';
import { removeTemplateCommand } from './commands/removeTemplate';
import { renameProjectCommand } from './commands/renameProject';
import { setupEnvironmentCommand } from './commands/setupEnvironment';
import { updateTemplatesCommand } from './commands/updateTemplates';
import { setCliInstaller } from './cliDetection';
import { applyToolPaths, setPrivateBinDir } from './cliEnv';
import { checkForCliUpdate, checkMinimumCliVersion, setUpdateAppliedCallback, setUpdateAvailableCallback } from './cliUpdater';
import { EnvironmentStatus } from './environment';
import { refreshSetupState } from './firstRun';
import { MissingPackageWatcher } from './missingPackages';
import { ProjectTreeProvider } from './projectTreeProvider';
import { SetupOptions, SetupWizard } from './setupWizard';
import { StatusBarManager } from './statusBar';
import { TemplateInfo } from './templates';
import { TemplatesTreeProvider } from './templatesTreeProvider';

export function activate(context: vscode.ExtensionContext): void {
    const outputChannel = vscode.window.createOutputChannel('LaTeX Forge');
    context.subscriptions.push(outputChannel);

    // Tools installed by the setup (the CLI in ~/.local/bin, TinyTeX, uv in
    // our storage) must work in this window right away: no restart needed.
    setPrivateBinDir(path.join(context.globalStorageUri.fsPath, 'bin'));
    context.environmentVariableCollection.description = 'Adds LaTeX Forge and its LaTeX distribution to PATH';
    applyToolPaths(context.environmentVariableCollection);

    // Status bar — must be created before checkForCliUpdate runs so the
    // update callback is registered in time.
    const statusBar = new StatusBarManager(context);
    setUpdateAvailableCallback((v) => statusBar.notifyUpdateAvailable(v));
    setUpdateAppliedCallback(() => statusBar.clearUpdateAvailable());

    const projectProvider = new ProjectTreeProvider(context);
    const templatesProvider = new TemplatesTreeProvider();
    const refreshTemplates = () => templatesProvider.refresh();

    // Latest known state of the machine (CLI + LaTeX), refreshed after setup.
    let environment: EnvironmentStatus | undefined;
    const indicators = [statusBar, projectProvider];
    const wizard: SetupWizard = new SetupWizard(context, outputChannel, () => {
        applyToolPaths(context.environmentVariableCollection);
        void refreshSetupState(indicators, { context, wizard, prompt: false }).then((status) => {
            environment = status;
            refreshTemplates();
        });
    });
    setCliInstaller(() => wizard.installCliOnly());

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
            setupEnvironmentCommand(outputChannel, wizard)
        ),
        // Also callable with options, e.g. from a command link:
        // command:latex-forge.installEverything?{"tex":"full"}
        vscode.commands.registerCommand('latex-forge.installEverything', (options?: SetupOptions) =>
            wizard.run({ installExtensions: true, ...options })
        ),
        vscode.commands.registerCommand('latex-forge.listTemplates', () =>
            listTemplatesCommand(outputChannel)
        ),
        vscode.commands.registerCommand('latex-forge.configureDefaults', () =>
            configureDefaultsCommand()
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

        vscode.window.registerUriHandler(
            createInstallUriHandler(outputChannel, refreshTemplates, onInstallAndCreate)
        ),

        new MissingPackageWatcher(outputChannel, () => environment),
    );

    // Once per session: warn if the CLI is too old; otherwise check PyPI for a
    // newer version. Skipping the update check when we already warned about an
    // outdated CLI avoids showing the user two dialogs at once.
    void checkMinimumCliVersion(outputChannel).then((handled) => {
        if (!handled) {
            void checkForCliUpdate(outputChannel);
        }
    });

    // While the CLI or LaTeX is missing, offer the one-click setup (and keep
    // the status bar / panel pointing at it).
    void refreshSetupState(indicators, { context, wizard, prompt: true }).then((status) => {
        environment = status;
    });
}

export function deactivate(): void {
    // Nothing to clean up: subscriptions are disposed by the extension host.
}
