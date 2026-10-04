import { execFile, spawn } from 'child_process';
import * as vscode from 'vscode';
import { LATEX_FORGE_BINARY } from './cliDetection';
import { getCliEnv } from './cliEnv';

export interface RunResult {
    exitCode: number;
    stdout: string;
    stderr: string;
}

export interface RunOptions {
    cwd?: string;
    outputChannel: vscode.OutputChannel;
    /** Called with each complete output line (stdout and stderr), e.g. to drive progress. */
    onLine?: (line: string) => void;
    /** Kills the process when cancellation is requested. */
    token?: vscode.CancellationToken;
}

/**
 * Runs `latex-forge <args>`, streaming combined output to the given output
 * channel as it arrives, and resolves with the exit code and captured output.
 */
export function runLatexForge(args: string[], options: RunOptions): Promise<RunResult> {
    const { cwd, outputChannel, onLine, token } = options;

    return new Promise((resolve, reject) => {
        outputChannel.appendLine(`$ ${LATEX_FORGE_BINARY} ${args.join(' ')}`);

        const child = spawn(LATEX_FORGE_BINARY, args, { cwd, env: getCliEnv() });
        let stdout = '';
        let stderr = '';
        let pending = '';

        const forwardLines = (text: string) => {
            if (!onLine) {
                return;
            }
            pending += text;
            const lines = pending.split(/\r?\n/);
            pending = lines.pop() ?? '';
            lines.forEach(onLine);
        };

        child.stdout.on('data', (chunk: Buffer) => {
            const text = chunk.toString();
            stdout += text;
            outputChannel.append(text);
            forwardLines(text);
        });

        child.stderr.on('data', (chunk: Buffer) => {
            const text = chunk.toString();
            stderr += text;
            outputChannel.append(text);
            forwardLines(text);
        });

        const cancellation = token?.onCancellationRequested(() => {
            outputChannel.appendLine('Cancelled.');
            child.kill();
        });

        child.on('error', (error) => {
            cancellation?.dispose();
            reject(error);
        });

        child.on('close', (exitCode) => {
            cancellation?.dispose();
            if (pending && onLine) {
                onLine(pending);
            }
            resolve({ exitCode: exitCode ?? -1, stdout, stderr });
        });
    });
}

/**
 * Runs `latex-forge <args>` silently (no output channel streaming).
 * Intended for JSON queries where the raw output is parsed by the caller.
 * Non-zero exit codes are resolved normally (not rejected) because many CLI
 * subcommands use exit codes as semantic signals (e.g. diagnose exits 1 when
 * tools are missing, template update exits 2 when nothing to update).
 */
export function execLatexForge(args: string[]): Promise<RunResult> {
    return new Promise((resolve) => {
        execFile(LATEX_FORGE_BINARY, args, { env: getCliEnv() }, (error, stdout, stderr) => {
            const exitCode = error
                ? (typeof error.code === 'number' ? error.code : -1)
                : 0;
            resolve({ exitCode, stdout, stderr });
        });
    });
}
