import { spawn } from 'child_process';
import * as vscode from 'vscode';
import { LATEX_FORGE_BINARY } from './cliDetection';

export interface RunResult {
    exitCode: number;
    stdout: string;
    stderr: string;
}

/**
 * Runs `latex-forge <args>`, streaming combined output to the given output
 * channel as it arrives, and resolves with the exit code and captured output.
 */
export function runLatexForge(
    args: string[],
    options: { cwd?: string; outputChannel: vscode.OutputChannel }
): Promise<RunResult> {
    const { cwd, outputChannel } = options;

    return new Promise((resolve, reject) => {
        outputChannel.appendLine(`$ ${LATEX_FORGE_BINARY} ${args.join(' ')}`);

        const child = spawn(LATEX_FORGE_BINARY, args, { cwd });
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk: Buffer) => {
            const text = chunk.toString();
            stdout += text;
            outputChannel.append(text);
        });

        child.stderr.on('data', (chunk: Buffer) => {
            const text = chunk.toString();
            stderr += text;
            outputChannel.append(text);
        });

        child.on('error', (error) => reject(error));

        child.on('close', (exitCode) => {
            resolve({ exitCode: exitCode ?? -1, stdout, stderr });
        });
    });
}
