import * as vscode from 'vscode';
import { EnvironmentStatus, getEnvironmentStatus } from './environment';
import { SetupWizard } from './setupWizard';

const DONT_ASK_KEY = 'latexForge.setupDontAsk';
const SNOOZE_KEY = 'latexForge.setupSnoozedUntil';
const SNOOZE_MS = 24 * 60 * 60 * 1000;

/** Something that shows whether the one-time setup is still to do. */
export interface SetupIndicator {
    setSetupNeeded(needed: boolean): void;
}

/** Whether the CLI runs and LaTeX can compile. */
export function isSetupComplete(status: EnvironmentStatus): boolean {
    return status.cliAvailable && status.texReady;
}

/** Human-readable list of what the setup will install. */
export function describeMissing(status: EnvironmentStatus): string {
    if (!status.cliAvailable) {
        return 'the LaTeX Forge CLI and a LaTeX distribution';
    }
    return 'a LaTeX distribution';
}

/**
 * Checks the environment and updates the indicators. On activation, also
 * offers the one-click setup while it is incomplete — at most once a day
 * after "Later", never after "Don't Ask Again" (the status bar and the panel
 * keep offering it either way).
 */
export async function refreshSetupState(
    indicators: SetupIndicator[],
    options: { context: vscode.ExtensionContext; wizard: SetupWizard; prompt: boolean }
): Promise<EnvironmentStatus> {
    const status = await getEnvironmentStatus();
    const complete = isSetupComplete(status);
    for (const indicator of indicators) {
        indicator.setSetupNeeded(!complete);
    }

    const state = options.context.globalState;
    const snoozed = Date.now() < (state.get<number>(SNOOZE_KEY) ?? 0);
    if (complete || !options.prompt || snoozed || state.get<boolean>(DONT_ASK_KEY)) {
        return status;
    }

    const choice = await vscode.window.showInformationMessage(
        `LaTeX Forge needs a one-time setup: ${describeMissing(status)} `
        + '(about 500 MB, a few minutes, no administrator password). Set it up now?',
        'Set Up Now',
        'Later',
        "Don't Ask Again"
    );
    if (choice === 'Set Up Now') {
        await options.wizard.run({ installExtensions: false });
        return getEnvironmentStatus();  // the machine changed: don't return the stale state
    } else if (choice === "Don't Ask Again") {
        await state.update(DONT_ASK_KEY, true);
    } else {
        // "Later" (or dismissed): don't nag in every window — ask again tomorrow.
        await state.update(SNOOZE_KEY, Date.now() + SNOOZE_MS);
    }
    return status;
}
