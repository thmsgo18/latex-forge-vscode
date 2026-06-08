import * as assert from 'assert';
import * as vscode from 'vscode';

suite('LaTeX Forge extension', () => {
    suiteSetup(async () => {
        const extension = vscode.extensions.getExtension('thmsgo18.latex-forge-vscode');
        assert.ok(extension, 'extension should be discoverable');
        await extension!.activate();
    });

    test('activates without throwing', () => {
        const extension = vscode.extensions.getExtension('thmsgo18.latex-forge-vscode');
        assert.strictEqual(extension!.isActive, true);
    });

    test('registers all contributed commands', async () => {
        const commands = await vscode.commands.getCommands(true);
        const expected = [
            'latex-forge.createProject',
            'latex-forge.renameProject',
            'latex-forge.setupEnvironment',
            'latex-forge.listTemplates',
            'latex-forge.installTemplate',
            'latex-forge.browseGallery',
            'latex-forge.removeTemplate',
            'latex-forge.refreshTemplates',
            'latex-forge.configureDefaults',
            'latex-forge.checkForUpdate'
        ];
        for (const command of expected) {
            assert.ok(commands.includes(command), `${command} should be registered`);
        }
    });

    test('registers the templates tree view', async () => {
        const view = vscode.window.createTreeView('latexForgeTemplates', {
            treeDataProvider: { getChildren: () => [], getTreeItem: (e) => e as unknown as vscode.TreeItem }
        });
        assert.ok(view, 'latexForgeTemplates view should be registered');
        view.dispose();
    });
});
