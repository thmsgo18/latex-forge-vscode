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

    test('registers the createProject command', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('latex-forge.createProject'), 'latex-forge.createProject should be registered');
    });
});
