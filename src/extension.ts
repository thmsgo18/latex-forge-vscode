import * as fs from 'fs';
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
import { getWorkspaceRoot } from './projectUtils';
import { ProjectTreeProvider } from './projectTreeProvider';
import { TemplateInfo } from './templates';
import { TemplatesTreeProvider } from './templatesTreeProvider';

/**
 * Returns true when the current workspace root contains at least one .tex
 * file at its top level — the heuristic used to decide whether a LaTeX
 * project is open.
 */
function detectLatexProject(): boolean {
    const root = getWorkspaceRoot();
    if (!root) {
        return false;
    }
    try {
        return fs.readdirSync(root).some((f) => f.endsWith('.tex'));
    } catch {
        return false;
    }
}

/**
 * Syncs the `latex-forge.hasProject` VS Code context key and the project
 * tree provider with the current workspace state.  Must be called whenever
 * the workspace folders or relevant files change.
 */
async function syncProjectContext(projectProvider: ProjectTreeProvider): Promise<void> {
    const hasProject = detectLatexProject();
    projectProvider.setHasProject(hasProject);
    await vscode.commands.executeCommand('setContext', 'latex-forge.hasProject', hasProject);
}

export function activate(context: vscode.ExtensionContext): void {
    const outputChannel = vscode.window.createOutputChannel('LaTeX Forge');
    context.subscriptions.push(outputChannel);

    // --- Project view (Build / Clean / Open PDF) ----------------------------
    const projectProvider = new ProjectTreeProvider();

    // --- Templates view -----------------------------------------------------
    const templatesProvider = new TemplatesTreeProvider(outputChannel);
    const refreshTemplates = () => templatesProvider.refresh();

    // Keep the "latex-forge.hasProject" context key up to date so that the
    // "when" clauses in package.json (view visibility, toolbar buttons,
    // viewsWelcome) always reflect the actual workspace state.
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(() =>
            void syncProjectContext(projectProvider)
        ),
        // Re-check when .tex files are created or deleted inside the workspace.
        vscode.workspace.onDidCreateFiles((e) => {
            if (e.files.some((f) => f.fsPath.endsWith('.tex'))) {
                void syncProjectContext(projectProvider);
            }
        }),
        vscode.workspace.onDidDeleteFiles((e) => {
            if (e.files.some((f) => f.fsPath.endsWith('.tex'))) {
                void syncProjectContext(projectProvider);
            }
        })
    );

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('latexForgeProject', projectProvider),
        vscode.window.registerTreeDataProvider('latexForgeTemplates', templatesProvider),

        vscode.commands.registerCommand('latex-forge.buildProject', () =>
            buildProjectCommand(outputChannel)
        ),
        vscode.commands.registerCommand('latex-forge.cleanProject', () => cleanProjectCommand()),
        vscode.commands.registerCommand('latex-forge.openPdf', () => openPdfCommand()),
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
        )
    );

    // Initialise the project context synchronously at activation so views
    // render correctly on the very first paint.
    void syncProjectContext(projectProvider);

    // Check for a CLI update silently in the background once per session.
    void checkForCliUpdate(outputChannel);
}

export function deactivate(): void {
    // Nothing to clean up: subscriptions are disposed by the extension host.
}
