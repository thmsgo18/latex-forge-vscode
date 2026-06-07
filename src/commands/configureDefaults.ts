import * as vscode from 'vscode';
import { LatexForgeConfig, readConfig, writeConfig } from '../config';
import { pickTemplate } from '../templates';

type ConfigAction =
    | { kind: 'setTemplate' }
    | { kind: 'clearTemplate' }
    | { kind: 'setOutputDir' }
    | { kind: 'clearOutputDir' };

interface ConfigQuickPickItem extends vscode.QuickPickItem {
    action: ConfigAction;
}

function buildMenuItems(config: LatexForgeConfig): ConfigQuickPickItem[] {
    const items: ConfigQuickPickItem[] = [
        {
            label: '$(symbol-keyword) Set default template…',
            description: config.defaultTemplate ? `currently "${config.defaultTemplate}"` : 'not set',
            action: { kind: 'setTemplate' }
        }
    ];

    if (config.defaultTemplate) {
        items.push({ label: '$(close) Clear default template', action: { kind: 'clearTemplate' } });
    }

    items.push({
        label: '$(folder) Set default output directory…',
        description: config.defaultOutputDir ? `currently "${config.defaultOutputDir}"` : 'not set',
        action: { kind: 'setOutputDir' }
    });

    if (config.defaultOutputDir) {
        items.push({ label: '$(close) Clear default output directory', action: { kind: 'clearOutputDir' } });
    }

    return items;
}

async function pickOutputDirectory(): Promise<string | undefined> {
    const picked = await vscode.window.showOpenDialog({
        title: 'LaTeX Forge: Configure Defaults',
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Set as default output directory'
    });

    return picked?.[0]?.fsPath;
}

export async function configureDefaultsCommand(outputChannel: vscode.OutputChannel): Promise<void> {
    const config = await readConfig();

    const picked = await vscode.window.showQuickPick(buildMenuItems(config), {
        title: 'LaTeX Forge: Configure Defaults',
        placeHolder: 'Select a default to change (stored in ~/.latex-forge.toml)'
    });
    if (!picked) {
        return;
    }

    switch (picked.action.kind) {
        case 'setTemplate': {
            const template = await pickTemplate(outputChannel, { title: 'LaTeX Forge: Set Default Template' });
            if (!template) {
                return;
            }
            await writeConfig({ ...config, defaultTemplate: template });
            await vscode.window.showInformationMessage(`Default template set to "${template}".`);
            break;
        }
        case 'clearTemplate': {
            await writeConfig({ ...config, defaultTemplate: undefined });
            await vscode.window.showInformationMessage('Default template cleared.');
            break;
        }
        case 'setOutputDir': {
            const directory = await pickOutputDirectory();
            if (!directory) {
                return;
            }
            await writeConfig({ ...config, defaultOutputDir: directory });
            await vscode.window.showInformationMessage(`Default output directory set to "${directory}".`);
            break;
        }
        case 'clearOutputDir': {
            await writeConfig({ ...config, defaultOutputDir: undefined });
            await vscode.window.showInformationMessage('Default output directory cleared.');
            break;
        }
    }
}
