import * as vscode from 'vscode';
import { runLatexForge } from './cliRunner';

export interface TemplateInfo {
    name: string;
    description?: string;
    builtin: boolean;
}

interface TemplateQuickPickItem extends vscode.QuickPickItem {
    templateName: string;
}

const SECTION_HEADERS: Record<string, 'builtin' | 'user'> = {
    'Built-in templates:': 'builtin',
    'Installed templates:': 'user'
};

const SKIPPED_LINE_PREFIXES = ['No user-installed templates', 'Install one with:'];

function parseTemplateListOutput(stdout: string): TemplateInfo[] {
    const templates: TemplateInfo[] = [];
    let section: 'builtin' | 'user' | undefined;

    for (const line of stdout.split('\n')) {
        const trimmed = line.trim();

        if (trimmed in SECTION_HEADERS) {
            section = SECTION_HEADERS[trimmed];
            continue;
        }
        if (trimmed === '' || SKIPPED_LINE_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) {
            continue;
        }
        if (!section) {
            continue;
        }

        const match = line.match(/^\s+(\S+)(?:\s{2,}(.+?))?\s*$/);
        if (!match) {
            continue;
        }
        const [, name, description] = match;
        templates.push({ name, description, builtin: section === 'builtin' });
    }

    return templates;
}

/** Runs `latex-forge template list` and returns built-in and user-installed templates. */
export async function listTemplates(outputChannel: vscode.OutputChannel): Promise<TemplateInfo[]> {
    const result = await runLatexForge(['template', 'list'], { outputChannel });
    if (result.exitCode !== 0) {
        return [];
    }
    return parseTemplateListOutput(result.stdout);
}

/** Shows a QuickPick of all known templates (built-in and user-installed) and returns the chosen name. */
export async function pickTemplate(
    outputChannel: vscode.OutputChannel,
    options: { title?: string; placeHolder?: string } = {}
): Promise<string | undefined> {
    const templates = await listTemplates(outputChannel);
    if (templates.length === 0) {
        await vscode.window.showErrorMessage('No LaTeX Forge templates were found. See the "LaTeX Forge" output channel for details.');
        return undefined;
    }

    const items: TemplateQuickPickItem[] = templates.map((template) => ({
        label: template.name,
        description: template.builtin ? template.description : 'user-installed',
        templateName: template.name
    }));

    const selected = await vscode.window.showQuickPick(items, {
        title: options.title ?? 'LaTeX Forge: Select Template',
        placeHolder: options.placeHolder ?? 'Select a template'
    });

    return selected?.templateName;
}
