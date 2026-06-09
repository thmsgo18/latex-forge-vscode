import * as fs from 'fs';
import * as vscode from 'vscode';

export class QuickActionItem extends vscode.TreeItem {
    constructor(
        label: string,
        codicon: string,
        color: vscode.ThemeColor,
        commandId: string,
        tooltip: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon(codicon, color);
        this.tooltip = tooltip;
        this.command = { command: commandId, title: label };
    }
}

const ITEM_CREATE = new QuickActionItem(
    'Create Project',
    'add',
    new vscode.ThemeColor('testing.iconPassed'),
    'latex-forge.createProject',
    'Create a new LaTeX project from a template'
);

const ITEM_GALLERY = new QuickActionItem(
    'Browse Template Gallery',
    'library',
    new vscode.ThemeColor('textLink.foreground'),
    'latex-forge.browseGallery',
    'Browse and install templates from the online gallery'
);

const ITEM_PROFILE = new QuickActionItem(
    'Edit Profile',
    'account',
    new vscode.ThemeColor('charts.purple'),
    'latex-forge.editProfile',
    'Edit your personal profile - auto-filled when creating a new project'
);

const ITEM_RENAME = new QuickActionItem(
    'Rename Project',
    'edit',
    new vscode.ThemeColor('charts.orange'),
    'latex-forge.renameCurrentProject',
    'Rename the current LaTeX Forge project'
);

/** Returns true when the current workspace root contains at least one .tex file. */
function isInLatexProject(): boolean {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) { return false; }
    try {
        return fs.readdirSync(root).some((f) => f.endsWith('.tex'));
    } catch {
        return false;
    }
}

export class ProjectTreeProvider implements vscode.TreeDataProvider<QuickActionItem> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(context: vscode.ExtensionContext) {
        // Refresh when the user opens or closes a workspace folder
        context.subscriptions.push(
            vscode.workspace.onDidChangeWorkspaceFolders(() =>
                this._onDidChangeTreeData.fire()
            )
        );

        // Refresh when .tex files are created or deleted at the workspace root
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.tex', false, true, false);
        context.subscriptions.push(
            watcher,
            watcher.onDidCreate(() => this._onDidChangeTreeData.fire()),
            watcher.onDidDelete(() => this._onDidChangeTreeData.fire())
        );
    }

    getTreeItem(element: QuickActionItem): vscode.TreeItem {
        return element;
    }

    getChildren(): QuickActionItem[] {
        const items = [ITEM_CREATE, ITEM_GALLERY, ITEM_PROFILE];
        if (isInLatexProject()) {
            items.push(ITEM_RENAME);
        }
        return items;
    }
}
