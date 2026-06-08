import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getOutDir, getWorkspaceRoot } from '../projectUtils';

/** Collects all PDF files from a directory, returns absolute paths. */
function listPdfs(dir: string): string[] {
    try {
        return fs.readdirSync(dir)
            .filter((f) => f.endsWith('.pdf'))
            .map((f) => path.join(dir, f));
    } catch {
        return [];
    }
}

export async function openPdfCommand(): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        await vscode.window.showErrorMessage(
            'No folder open. Please open a LaTeX project folder first.'
        );
        return;
    }

    const outDir = getOutDir(workspaceRoot);

    // Look in the configured output directory first, then fall back to the
    // workspace root (in case the user compiled with a different tool).
    const candidates = [
        ...listPdfs(outDir),
        ...listPdfs(workspaceRoot)
    ];

    // Deduplicate (the output dir might equal the workspace root).
    const pdfs = [...new Set(candidates)];

    if (pdfs.length === 0) {
        await vscode.window.showErrorMessage(
            'No PDF found. Run "LaTeX Forge: Build" first.'
        );
        return;
    }

    let pdfPath: string;

    if (pdfs.length === 1) {
        pdfPath = pdfs[0];
    } else {
        // Several PDFs — let the user pick, showing paths relative to the root.
        const items = pdfs.map((p) => path.relative(workspaceRoot, p));
        const picked = await vscode.window.showQuickPick(items, {
            title: 'Select a PDF to open',
            placeHolder: 'Pick the compiled PDF to view'
        });
        if (!picked) {
            return;
        }
        pdfPath = path.join(workspaceRoot, picked);
    }

    // vscode.open handles .pdf files: VS Code will use its built-in PDF viewer
    // (if available) or hand off to the OS default application.
    await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(pdfPath));
}
