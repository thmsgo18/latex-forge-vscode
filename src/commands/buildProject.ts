import * as fs from 'fs';
import { spawn } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { getCliEnv } from '../cliEnv';
import { lwBuild } from '../latexWorkshop';
import { findMainTexFile, getBuildTool, getOutDir, getWorkspaceRoot } from '../projectUtils';

export async function buildProjectCommand(outputChannel: vscode.OutputChannel): Promise<void> {
    // Prefer LaTeX Workshop: it handles multi-step recipes, SyncTeX, inline
    // error display, and PDF auto-refresh out of the box.
    if (await lwBuild()) {
        return;
    }

    // Fallback: run latexmk directly when LaTeX Workshop is not available.
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        await vscode.window.showErrorMessage(
            'No folder open. Please open a LaTeX project folder first.'
        );
        return;
    }

    const mainFile = await findMainTexFile(workspaceRoot);
    if (!mainFile) {
        await vscode.window.showErrorMessage(
            'No .tex file found at the workspace root. ' +
            'Open a LaTeX project folder or create one with "LaTeX Forge: Create Project".'
        );
        return;
    }

    const outDir = getOutDir(workspaceRoot);
    const docWithoutExt = mainFile.replace(/\.tex$/, '');

    // Make sure the output directory exists before latexmk tries to write to it.
    fs.mkdirSync(outDir, { recursive: true });

    const tool = getBuildTool(workspaceRoot, outDir, docWithoutExt);
    const command = tool?.command ?? 'latexmk';
    const args = tool?.args ?? [
        '-synctex=1',
        '-interaction=nonstopmode',
        '-file-line-error',
        '-lualatex',
        `-outdir=${outDir}`,
        mainFile
    ];

    outputChannel.show(true);
    outputChannel.appendLine(`$ ${command} ${args.join(' ')}`);

    await new Promise<void>((resolve) => {
        const child = spawn(command, args, {
            cwd: workspaceRoot,
            env: { ...getCliEnv(), PATH: `${process.env.PATH ?? ''}:${path.dirname(command)}` }
        });

        child.stdout.on('data', (chunk: Buffer) => outputChannel.append(chunk.toString()));
        child.stderr.on('data', (chunk: Buffer) => outputChannel.append(chunk.toString()));

        child.on('error', (err) => {
            outputChannel.appendLine(`Failed to start the build process: ${err.message}`);
        });

        child.on('close', async (exitCode) => {
            if (exitCode === 0) {
                await vscode.window.showInformationMessage('Build completed successfully.');
            } else {
                await vscode.window.showErrorMessage(
                    `Build failed (exit code ${exitCode ?? 'unknown'}). ` +
                    'See the "LaTeX Forge" output channel for details.'
                );
            }
            resolve();
        });
    });
}
