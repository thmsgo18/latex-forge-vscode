import * as cp from 'child_process';
import * as path from 'path';
import {
    downloadAndUnzipVSCode,
    resolveCliArgsFromVSCodeExecutablePath,
    runTests
} from '@vscode/test-electron';

async function main(): Promise<void> {
    try {
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // Download (or reuse a cached) VS Code binary.
        const vscodeExecutablePath = await downloadAndUnzipVSCode('stable');

        // Resolve the CLI entry point for the downloaded binary and install
        // LaTeX Workshop before the test host starts.  Without this step VS Code
        // refuses to activate LaTeX Forge because extensionDependencies lists LW
        // as a required extension.
        const [cliPath, ...cliArgs] =
            resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

        cp.spawnSync(
            cliPath,
            [...cliArgs, '--install-extension', 'James-Yu.latex-workshop'],
            { encoding: 'utf-8', stdio: 'inherit' }
        );

        await runTests({ vscodeExecutablePath, extensionDevelopmentPath, extensionTestsPath });
    } catch (err) {
        console.error('Failed to run tests');
        console.error(err);
        process.exit(1);
    }
}

main();
