import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    downloadAndUnzipVSCode,
    resolveCliArgsFromVSCodeExecutablePath,
    runTests
} from '@vscode/test-electron';

/**
 * End-to-end test of the real user journey on a simulated fresh machine:
 * no LaTeX, no Python tools, no latex-forge. The extension's "Install
 * Everything" must download uv, install the CLI from PyPI and the light
 * TinyTeX; LaTeX Workshop must then compile on save in the same window, and
 * a package the document needs must get installed automatically.
 *
 * Everything lands in a throwaway HOME, so running it never touches your own
 * setup. It downloads uv, Python, latex-forge and TinyTeX (a few hundred MB)
 * and takes a few minutes. macOS and Linux only.
 */

// LaTeX Forge writes this for a pdfLaTeX project (latex_forge/project.py).
const PROJECT_SETTINGS = {
    'latex-workshop.latex.autoBuild.run': 'onSave',
    'latex-workshop.latex.recipe.default': 'first',
    'latex-workshop.latex.outDir': '%DIR%/build',
    'latex-workshop.latex.tools': [{
        name: 'pdflatexmk',
        command: 'latexmk',
        args: ['-synctex=1', '-interaction=nonstopmode', '-file-line-error', '-pdf', '-outdir=%OUTDIR%', '%DOC%']
    }],
    'latex-workshop.latex.recipes': [{ name: 'pdflatexmk', tools: ['pdflatexmk'] }]
};

const DOCUMENT = '\\documentclass{article}\n\\begin{document}\nLaTeX Forge end-to-end test.\n\\end{document}\n';

async function main(): Promise<void> {
    if (process.platform === 'win32') {
        console.log('The end-to-end test runs on macOS and Linux only.');
        return;
    }

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lfe2e-'));
    const home = path.join(root, 'home');
    const project = path.join(root, 'e2e');
    fs.mkdirSync(home);
    fs.mkdirSync(path.join(project, '.vscode'), { recursive: true });
    fs.writeFileSync(path.join(project, 'e2e.tex'), DOCUMENT);
    fs.writeFileSync(path.join(project, '.vscode', 'settings.json'), JSON.stringify(PROJECT_SETTINGS, null, 2));
    // Note: no AGENTS.md in the folder — recent VS Code builds never start the
    // extension tests when the opened folder contains one.

    const vscodeExecutablePath = await downloadAndUnzipVSCode('stable');
    const [cliPath, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);
    cp.spawnSync(cliPath, [...cliArgs, '--install-extension', 'James-Yu.latex-workshop'], {
        encoding: 'utf-8',
        stdio: 'inherit'
    });

    const env = {
        HOME: home,
        // A bare PATH: no TeX, uv or latex-forge the machine may already have.
        PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
        // Also hide TeX distributions installed in their usual places.
        LATEX_FORGE_TEX_DIRS: '/nonexistent-tex',
        LATEX_FORGE_E2E_PROJECT: project
    };

    try {
        await runTests({
            vscodeExecutablePath,
            extensionDevelopmentPath: path.resolve(__dirname, '../../../'),
            extensionTestsPath: path.resolve(__dirname, './suite/index'),
            extensionTestsEnv: env,
            // Short user-data dir: VS Code's IPC socket path must stay under 104 chars.
            launchArgs: [project, `--user-data-dir=${path.join(root, 'ud')}`]
        });
    } catch (err) {
        console.error('End-to-end test failed');
        console.error(err);
        process.exit(1);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

main();
