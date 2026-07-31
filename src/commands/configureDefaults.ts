import * as vscode from 'vscode';
import { LatexForgeConfig, SHARING_MODES, SharingMode, readConfig, writeConfig } from '../config';
import { pickTemplate } from '../templates';

const SHARING_MODE_LABELS: Record<SharingMode, string> = {
    full: 'full — LaTeX sources + compiled PDF',
    'pdf-only': 'pdf-only — compiled PDF only, sources stay local',
    none: 'none — nothing tracked, project stays local'
};

type ConfigAction =
    | { kind: 'setTemplate' }
    | { kind: 'clearTemplate' }
    | { kind: 'setOutputDir' }
    | { kind: 'clearOutputDir' }
    | { kind: 'setSharing' }
    | { kind: 'toggleBuildBeforeCommit' };

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

    items.push({
        label: '$(git-branch) Set default sharing mode…',
        description: `currently "${config.defaultSharing ?? 'full'}"`,
        action: { kind: 'setSharing' }
    });

    const buildBeforeCommit = config.buildBeforeCommit ?? false;
    items.push({
        label: `$(sync) Auto-build before initial git commit: ${buildBeforeCommit ? 'on' : 'off'}`,
        description: 'Only applies when "Initialize git repository?" is Yes and the sharing mode includes a PDF',
        action: { kind: 'toggleBuildBeforeCommit' }
    });

    return items;
}

async function pickSharingMode(): Promise<SharingMode | undefined> {
    const picked = await vscode.window.showQuickPick(
        SHARING_MODES.map((mode) => ({ label: SHARING_MODE_LABELS[mode], mode })),
        { title: 'LaTeX Forge: Set Default Sharing Mode' }
    );
    return picked?.mode;
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

export async function configureDefaultsCommand(): Promise<void> {
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
            const template = await pickTemplate({ title: 'LaTeX Forge: Set Default Template' });
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
        case 'setSharing': {
            const mode = await pickSharingMode();
            if (!mode) {
                return;
            }
            await writeConfig({ ...config, defaultSharing: mode });
            await vscode.window.showInformationMessage(`Default sharing mode set to "${mode}".`);
            break;
        }
        case 'toggleBuildBeforeCommit': {
            const next = !(config.buildBeforeCommit ?? false);
            await writeConfig({ ...config, buildBeforeCommit: next });
            await vscode.window.showInformationMessage(
                `Auto-build before initial git commit turned ${next ? 'on' : 'off'}.`
            );
            break;
        }
    }
}
