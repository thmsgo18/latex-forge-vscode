import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getOutDir, getWorkspaceRoot } from '../projectUtils';

/**
 * Extensions that latexmk / pdflatex / xelatex / lualatex leave behind.
 * The compiled PDF is intentionally excluded so the user never loses it.
 */
const ARTIFACT_EXTENSIONS = new Set([
    '.aux', '.log', '.fls', '.fdb_latexmk',
    '.synctex', '.synctex.gz',
    '.toc', '.out', '.lof', '.lot',
    '.bbl', '.blg', '.bcf', '.run.xml',
    '.nav', '.snm', '.vrb',      // Beamer
]);

function isArtifact(filename: string): boolean {
    // Handle double extensions like .synctex.gz
    const ext = path.extname(filename);
    const ext2 = path.extname(filename.slice(0, -ext.length));
    return ARTIFACT_EXTENSIONS.has(ext) || ARTIFACT_EXTENSIONS.has(`${ext2}${ext}`);
}

function removeFile(filePath: string): boolean {
    try {
        fs.unlinkSync(filePath);
        return true;
    } catch {
        return false;
    }
}

export async function cleanProjectCommand(): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        await vscode.window.showErrorMessage(
            'No folder open. Please open a LaTeX project folder first.'
        );
        return;
    }

    const outDir = getOutDir(workspaceRoot);
    let cleaned = 0;

    // Remove everything in the build output directory except the PDF itself.
    if (fs.existsSync(outDir)) {
        for (const file of fs.readdirSync(outDir)) {
            if (path.extname(file) !== '.pdf') {
                if (removeFile(path.join(outDir, file))) {
                    cleaned++;
                }
            }
        }
    }

    // Also sweep the workspace root for stray artifacts (e.g. from a run that
    // used the root as the output directory before the project was configured).
    for (const file of fs.readdirSync(workspaceRoot)) {
        if (isArtifact(file)) {
            if (removeFile(path.join(workspaceRoot, file))) {
                cleaned++;
            }
        }
    }

    if (cleaned > 0) {
        await vscode.window.showInformationMessage(
            `Cleaned ${cleaned} build artefact${cleaned === 1 ? '' : 's'}.`
        );
    } else {
        await vscode.window.showInformationMessage('Nothing to clean — no build artefacts found.');
    }
}
