import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Returns the root path of the first workspace folder, or undefined when
 * no folder is open.
 */
export function getWorkspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/**
 * Reads the build output directory from the project's .vscode/settings.json
 * (latex-workshop.latex.outDir, with %DIR% resolved to the workspace root).
 * Falls back to "<root>/build" when the setting is absent or unreadable.
 */
export function getOutDir(workspaceRoot: string): string {
    try {
        const settingsPath = path.join(workspaceRoot, '.vscode', 'settings.json');
        const raw = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
        const value = raw['latex-workshop.latex.outDir'];
        if (typeof value === 'string') {
            // %DIR% in LaTeX Workshop refers to the directory of the active document,
            // which for a single-root project equals the workspace root.
            return value.replace('%DIR%', workspaceRoot);
        }
    } catch {
        // Missing file or invalid JSON — use the default below.
    }
    return path.join(workspaceRoot, 'build');
}

/**
 * Reads the first latexmk tool definition from .vscode/settings.json and
 * returns the resolved command and arg list (with %OUTDIR% and %DOC%
 * substituted), or null when the settings file is absent or incomplete.
 */
export function getBuildTool(
    workspaceRoot: string,
    outDir: string,
    docWithoutExt: string
): { command: string; args: string[] } | null {
    try {
        const settingsPath = path.join(workspaceRoot, '.vscode', 'settings.json');
        const raw = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
        const tools = raw['latex-workshop.latex.tools'];
        if (!Array.isArray(tools) || tools.length === 0) {
            return null;
        }
        const tool = tools[0] as { command?: string; args?: unknown[] };
        if (typeof tool.command !== 'string' || !Array.isArray(tool.args)) {
            return null;
        }
        const args = tool.args
            .filter((a): a is string => typeof a === 'string')
            .map((a) => a.replace('%OUTDIR%', outDir).replace('%DOC%', docWithoutExt));
        return { command: tool.command, args };
    } catch {
        return null;
    }
}

/**
 * Finds the main .tex file in the workspace root.
 *  - If only one .tex file exists, returns it.
 *  - If a file matching "<folder-name>.tex" exists, returns it.
 *  - If several candidates exist and none matches the folder name, asks the
 *    user to pick one.
 */
export async function findMainTexFile(workspaceRoot: string): Promise<string | undefined> {
    let texFiles: string[];
    try {
        texFiles = fs.readdirSync(workspaceRoot).filter((f) => f.endsWith('.tex'));
    } catch {
        return undefined;
    }

    if (texFiles.length === 0) {
        return undefined;
    }
    if (texFiles.length === 1) {
        return path.join(workspaceRoot, texFiles[0]);
    }

    // Prefer a file whose base name matches the workspace folder name.
    const folderName = path.basename(workspaceRoot);
    const byName = texFiles.find((f) => f === `${folderName}.tex`);
    if (byName) {
        return path.join(workspaceRoot, byName);
    }

    // Ambiguous — let the user choose.
    const picked = await vscode.window.showQuickPick(texFiles, {
        title: 'Select the main .tex file to compile',
        placeHolder: 'Pick the root LaTeX document'
    });
    return picked ? path.join(workspaceRoot, picked) : undefined;
}
