import { execFile, spawn } from 'child_process';
import * as vscode from 'vscode';
import { LATEX_FORGE_BINARY } from './cliDetection';
import { getCliEnv } from './cliEnv';

const PYPI_METADATA_URL = 'https://pypi.org/pypi/latex-forge/json';
const PIPX_BINARY = 'pipx';
const FETCH_TIMEOUT_MS = 8000;

// Only run the background check once per extension-host session, so it does
// not fire again if the user reloads the window.
let sessionCheckDone = false;

// Optional callback fired when a newer CLI version is detected.
let _onUpdateAvailable: ((latestVersion: string) => void) | undefined;

// Optional callback fired once a CLI upgrade has been applied successfully.
let _onUpdateApplied: (() => void) | undefined;

/** Register a callback that is called once when a CLI update is found. */
export function setUpdateAvailableCallback(cb: (latestVersion: string) => void): void {
    _onUpdateAvailable = cb;
}

/** Register a callback that is called once a CLI upgrade completes successfully. */
export function setUpdateAppliedCallback(cb: () => void): void {
    _onUpdateApplied = cb;
}

// ---------------------------------------------------------------------------
// Version helpers
// ---------------------------------------------------------------------------

/** Parses "latex-forge X.Y.Z …" → "X.Y.Z", or null when the format is unexpected. */
function parseVersionString(output: string): string | null {
    const match = output.trim().match(/^latex-forge\s+(\d+\.\d+(?:\.\d+)*)/);
    return match ? match[1] : null;
}

/**
 * Returns true when `latest` is strictly newer than `installed`.
 * Both strings are expected to be dot-separated integers ("X.Y.Z").
 */
function isNewer(installed: string, latest: string): boolean {
    const toNumbers = (v: string): number[] => v.split('.').map(Number);
    const a = toNumbers(installed);
    const b = toNumbers(latest);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const diff = (b[i] ?? 0) - (a[i] ?? 0);
        if (diff !== 0) {
            return diff > 0;
        }
    }
    return false;
}

// ---------------------------------------------------------------------------
// Network / process queries
// ---------------------------------------------------------------------------

/** Runs `latex-forge --version` and returns the version string, or null. */
function getInstalledVersion(): Promise<string | null> {
    return new Promise((resolve) => {
        execFile(LATEX_FORGE_BINARY, ['--version'], { env: getCliEnv() }, (error, stdout) => {
            resolve(error ? null : parseVersionString(stdout));
        });
    });
}

/** Queries the PyPI JSON API and returns the latest published version, or null. */
async function getLatestPyPiVersion(): Promise<string | null> {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        const response = await fetch(PYPI_METADATA_URL, { signal: controller.signal });
        clearTimeout(timer);
        if (!response.ok) {
            return null;
        }
        const data = (await response.json()) as { info?: { version?: string } };
        return data.info?.version ?? null;
    } catch {
        // Network unavailable, timeout, or unexpected JSON — silently ignore.
        return null;
    }
}

// ---------------------------------------------------------------------------
// Upgrade runner
// ---------------------------------------------------------------------------

/**
 * Runs `pipx upgrade latex-forge`, streams output to the channel, and
 * resolves with whether the command exited cleanly.
 */
function runPipxUpgrade(outputChannel: vscode.OutputChannel): Promise<boolean> {
    return new Promise((resolve) => {
        outputChannel.appendLine('$ pipx upgrade latex-forge');

        const child = spawn(PIPX_BINARY, ['upgrade', 'latex-forge'], { env: getCliEnv() });

        child.stdout.on('data', (chunk: Buffer) => outputChannel.append(chunk.toString()));
        child.stderr.on('data', (chunk: Buffer) => outputChannel.append(chunk.toString()));

        child.on('error', (err) => {
            outputChannel.appendLine(`Error: ${err.message}`);
            resolve(false);
        });

        child.on('close', (code) => resolve(code === 0));
    });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compares the installed CLI version against the latest version on PyPI.
 * If an update is available, shows a notification offering to upgrade via
 * `pipx upgrade latex-forge`.  Resolves immediately — never throws.
 *
 * @param outputChannel The shared output channel to stream upgrade output to.
 * @param force         When true, bypass the once-per-session guard (useful
 *                      when the user triggers the check manually).
 */
export async function checkForCliUpdate(
    outputChannel: vscode.OutputChannel,
    force = false
): Promise<void> {
    if (!force) {
        if (sessionCheckDone) {
            return;
        }
        sessionCheckDone = true;
    }

    const [installed, latest] = await Promise.all([
        getInstalledVersion(),
        getLatestPyPiVersion()
    ]);

    if (!installed || !latest) {
        if (force) {
            await vscode.window.showInformationMessage(
                'Could not determine the current or latest version of the LaTeX Forge CLI. ' +
                'Make sure you are connected to the internet and that the CLI is installed.'
            );
        }
        return;
    }

    if (!isNewer(installed, latest)) {
        _onUpdateAvailable = undefined; // already up to date — clear any stale ref
        if (force) {
            await vscode.window.showInformationMessage(
                `LaTeX Forge CLI is up to date (version ${installed}).`
            );
        }
        return;
    }

    // Notify the status bar (or any other subscriber) before showing the dialog.
    _onUpdateAvailable?.(latest);

    const choice = await vscode.window.showInformationMessage(
        `LaTeX Forge CLI ${latest} is available (installed: ${installed}).`,
        'Update now',
        'Later'
    );

    if (choice !== 'Update now') {
        return;
    }

    outputChannel.show(true);
    const success = await runPipxUpgrade(outputChannel);

    if (success) {
        _onUpdateApplied?.();
        await vscode.window.showInformationMessage(
            `LaTeX Forge CLI updated to ${latest} successfully.`
        );
    } else {
        await vscode.window.showErrorMessage(
            'Failed to update the LaTeX Forge CLI. ' +
            'See the "LaTeX Forge" output channel for details.'
        );
    }
}
