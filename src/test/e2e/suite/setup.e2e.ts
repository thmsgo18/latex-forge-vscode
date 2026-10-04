import * as assert from 'assert';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const PROJECT = process.env.LATEX_FORGE_E2E_PROJECT ?? '';
const TEX = path.join(PROJECT, 'e2e.tex');
const PDF = path.join(PROJECT, 'build', 'e2e.pdf');
const LOG = path.join(PROJECT, 'build', 'e2e.log');
const CLI = path.join(process.env.HOME ?? '', '.local', 'bin', 'latex-forge');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check: () => boolean, what: string, minutes: number): Promise<void> {
    const end = Date.now() + minutes * 60_000;
    while (Date.now() < end) {
        if (check()) {
            return;
        }
        await sleep(2000);
    }
    throw new Error(`timed out waiting for ${what}`);
}

interface Diagnose {
    texlive: { ok: boolean };
    tex_distribution?: { kind: string; bin_dir: string };
}

function diagnose(): Diagnose {
    try {
        return JSON.parse(execFileSync(CLI, ['diagnose', '--json'], { env: process.env }).toString());
    } catch (error) {
        // Exit code 1 (LaTeX missing) still prints the JSON.
        return JSON.parse((error as { stdout: Buffer }).stdout.toString());
    }
}

suite('End to end: fresh machine → Install Everything → LaTeX Workshop compiles', () => {
    suiteSetup(async () => {
        assert.ok(PROJECT, 'LATEX_FORGE_E2E_PROJECT must point at the opened project');
        await vscode.extensions.getExtension('thmsgo18.latex-forge-vscode')!.activate();
    });

    test('starts with neither the CLI nor LaTeX', () => {
        assert.strictEqual(fs.existsSync(CLI), false);
        assert.ok(!(process.env.PATH ?? '').includes('TinyTeX'));
    });

    test('Install Everything installs the CLI and TinyTeX, then proves LaTeX works', async () => {
        const ok = await vscode.commands.executeCommand<boolean>(
            'latex-forge.installEverything', { tex: 'light', installExtensions: false }
        );
        assert.strictEqual(ok, true);
        const data = diagnose();
        assert.strictEqual(data.texlive.ok, true);
        assert.strictEqual(data.tex_distribution?.kind, 'tinytex');
        // No restart: this extension host — shared with LaTeX Workshop — can run latexmk.
        assert.ok((process.env.PATH ?? '').includes('TinyTeX'), process.env.PATH);
    });

    test('LaTeX Workshop compiles on save, without restarting VS Code', async () => {
        const doc = await vscode.workspace.openTextDocument(TEX);
        const editor = await vscode.window.showTextDocument(doc);
        await sleep(5000); // let LaTeX Workshop activate
        await editor.edit((e) => e.insert(new vscode.Position(doc.lineCount, 0), '\n'));
        await doc.save();
        await waitFor(() => fs.existsSync(PDF), 'the first PDF', 10);
    });

    test('a package the document needs is installed automatically', async () => {
        const doc = await vscode.workspace.openTextDocument(TEX);
        const text = doc.getText()
            .replace('\\begin{document}', '\\usepackage{tikz-cd}\n\\begin{document}')
            .replace('\\end{document}', '\\begin{tikzcd} A \\arrow[r] & B \\end{tikzcd}\n\\end{document}');
        const editor = await vscode.window.showTextDocument(doc);
        await editor.edit((e) => e.replace(new vscode.Range(0, 0, doc.lineCount, 0), text));
        const before = fs.statSync(PDF).mtimeMs;
        await doc.save();
        await waitFor(() => {
            if (!fs.existsSync(LOG) || fs.statSync(PDF).mtimeMs <= before) {
                return false;
            }
            const log = fs.readFileSync(LOG, 'utf8');
            return log.includes('tikz-cd.sty') && !log.includes('not found');
        }, 'the PDF rebuilt with tikz-cd', 15);
        const tlmgr = path.join(diagnose().tex_distribution!.bin_dir, 'tlmgr');
        const installed = execFileSync(tlmgr, ['info', '--list', '--only-installed', '--data', 'name'],
            { env: process.env }).toString().split('\n');
        assert.ok(installed.includes('tikz-cd'));
    });
});
