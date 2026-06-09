import * as vscode from 'vscode';

const LW_EXTENSION_ID = 'James-Yu.latex-workshop';
const LW_MARKETPLACE_URL =
    'https://marketplace.visualstudio.com/items?itemName=James-Yu.latex-workshop';

// LaTeX Workshop command identifiers.
const LW_CMD_BUILD = 'latex-workshop.build';
const LW_CMD_CLEAN = 'latex-workshop.clean';
const LW_CMD_VIEW  = 'latex-workshop.view';

// Show the "missing" notification at most once per session so it does not
// become annoying when the user runs several commands in a row.
let missingNotificationShown = false;

/**
 * Returns true when the LaTeX Workshop extension is installed and active.
 * If it is installed but not yet activated, this function activates it first.
 */
export async function isLatexWorkshopAvailable(): Promise<boolean> {
    const ext = vscode.extensions.getExtension(LW_EXTENSION_ID);
    if (!ext) {
        return false;
    }
    if (!ext.isActive) {
        try {
            await ext.activate();
        } catch {
            return false;
        }
    }
    return true;
}

/**
 * Shows a one-per-session warning when LaTeX Workshop is not found, offering
 * a direct link to its Marketplace page.  Returns false so callers can decide
 * whether to proceed with the fallback.
 */
async function warnLatexWorkshopMissing(action: string): Promise<false> {
    if (!missingNotificationShown) {
        missingNotificationShown = true;
        const install = 'Install LaTeX Workshop';
        const choice = await vscode.window.showWarningMessage(
            `LaTeX Workshop is not installed. It is required for the best ${action} experience. ` +
            'Falling back to the built-in implementation.',
            install
        );
        if (choice === install) {
            await vscode.env.openExternal(vscode.Uri.parse(LW_MARKETPLACE_URL));
        }
    }
    return false;
}

// ---------------------------------------------------------------------------
// Delegating helpers
// ---------------------------------------------------------------------------

/**
 * Delegates a build to LaTeX Workshop.
 * Returns true on success, false when LaTeX Workshop is unavailable
 * (after showing a warning).
 */
export async function lwBuild(): Promise<boolean> {
    if (!(await isLatexWorkshopAvailable())) {
        return warnLatexWorkshopMissing('build');
    }
    await vscode.commands.executeCommand(LW_CMD_BUILD);
    return true;
}

/**
 * Delegates a clean to LaTeX Workshop.
 * Returns true on success, false when LaTeX Workshop is unavailable.
 */
export async function lwClean(): Promise<boolean> {
    if (!(await isLatexWorkshopAvailable())) {
        return warnLatexWorkshopMissing('clean');
    }
    await vscode.commands.executeCommand(LW_CMD_CLEAN);
    return true;
}

/**
 * Delegates opening the PDF viewer to LaTeX Workshop.
 * Returns true on success, false when LaTeX Workshop is unavailable.
 */
export async function lwOpenPdf(): Promise<boolean> {
    if (!(await isLatexWorkshopAvailable())) {
        return warnLatexWorkshopMissing('PDF preview');
    }
    await vscode.commands.executeCommand(LW_CMD_VIEW);
    return true;
}
