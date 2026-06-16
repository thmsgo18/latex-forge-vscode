import * as assert from 'assert';
import * as vscode from 'vscode';
import { MIN_CLI_VERSION, isBelowMinimum, isNewer, parseVersionString } from '../../cliUpdater';

suite('CLI version helpers', () => {
    test('parseVersionString extracts the version', () => {
        assert.strictEqual(parseVersionString('latex-forge 0.5.2'), '0.5.2');
        assert.strictEqual(parseVersionString('latex-forge 1.0.0 (extra)'), '1.0.0');
        assert.strictEqual(parseVersionString('garbage'), null);
    });

    test('isNewer compares dotted versions', () => {
        assert.strictEqual(isNewer('0.4.0', '0.5.0'), true);
        assert.strictEqual(isNewer('0.5.0', '0.5.0'), false);
        assert.strictEqual(isNewer('0.5.1', '0.5.0'), false);
        assert.strictEqual(isNewer('0.5', '0.5.1'), true);
    });

    test('isBelowMinimum flags versions older than the supported floor', () => {
        assert.strictEqual(isBelowMinimum('0.4.9'), true);
        assert.strictEqual(isBelowMinimum(MIN_CLI_VERSION), false);
        assert.strictEqual(isBelowMinimum('1.0.0'), false);
    });
});

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
            'latex-forge.renameCurrentProject',
            'latex-forge.setupEnvironment',
            'latex-forge.listTemplates',
            'latex-forge.installTemplate',
            'latex-forge.browseGallery',
            'latex-forge.removeTemplate',
            'latex-forge.refreshTemplates',
            'latex-forge.editProfile',
            'latex-forge.configureDefaults',
            'latex-forge.checkForUpdate',
            'latex-forge.updateTemplates',
            'latex-forge.diagnose'
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
