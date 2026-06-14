import * as vscode from 'vscode';
import { execLatexForge } from './cliRunner';

export interface TemplateInfo {
    name: string;
    description?: string;
    /** "builtin" for templates shipped with the CLI, "user" for installed ones. */
    type: 'builtin' | 'user';
    /** Installed version tag (only present for user-installed templates). */
    installedVersion?: string;
    installUrl?: string;
    /** Convenience alias kept for backward compatibility. */
    builtin: boolean;
}

interface TemplateQuickPickItem extends vscode.QuickPickItem {
    templateName: string;
}

interface CliTemplateEntry {
    name: string;
    type: 'builtin' | 'user';
    description?: string;
    installed_version?: string;
    install_url?: string;
}

/** Runs `latex-forge template list --json` and returns built-in and user-installed templates. */
export async function listTemplates(): Promise<TemplateInfo[]> {
    const result = await execLatexForge(['template', 'list', '--json']);
    if (result.exitCode !== 0 || !result.stdout.trim()) {
        return [];
    }
    try {
        const entries: CliTemplateEntry[] = JSON.parse(result.stdout);
        return entries.map((e) => ({
            name: e.name,
            description: e.description,
            type: e.type,
            installedVersion: e.installed_version,
            installUrl: e.install_url,
            builtin: e.type === 'builtin'
        }));
    } catch {
        return [];
    }
}

/** Shows a QuickPick of all known templates (built-in and user-installed) and returns the chosen name. */
export async function pickTemplate(
    options: { title?: string; placeHolder?: string } = {}
): Promise<string | undefined> {
    const templates = await listTemplates();
    if (templates.length === 0) {
        await vscode.window.showErrorMessage('No LaTeX Forge templates were found. See the "LaTeX Forge" output channel for details.');
        return undefined;
    }

    const items: TemplateQuickPickItem[] = templates.map((template) => ({
        label: template.name,
        description: template.builtin
            ? template.description
            : (template.installedVersion ? `v${template.installedVersion}` : 'user-installed'),
        templateName: template.name
    }));

    const selected = await vscode.window.showQuickPick(items, {
        title: options.title ?? 'LaTeX Forge: Select Template',
        placeHolder: options.placeHolder ?? 'Select a template'
    });

    return selected?.templateName;
}
