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

const ITEMS: QuickActionItem[] = [
    new QuickActionItem(
        'Create Project',
        'add',
        new vscode.ThemeColor('testing.iconPassed'),
        'latex-forge.createProject',
        'Create a new LaTeX project from a template'
    ),
    new QuickActionItem(
        'Browse Template Gallery',
        'library',
        new vscode.ThemeColor('textLink.foreground'),
        'latex-forge.browseGallery',
        'Browse and install templates from the online gallery'
    ),
    new QuickActionItem(
        'Edit Profile',
        'account',
        new vscode.ThemeColor('charts.purple'),
        'latex-forge.editProfile',
        'Edit your personal profile — auto-filled when creating a new project'
    ),
];

export class ProjectTreeProvider implements vscode.TreeDataProvider<QuickActionItem> {
    getTreeItem(element: QuickActionItem): vscode.TreeItem {
        return element;
    }

    getChildren(): QuickActionItem[] {
        return ITEMS;
    }
}
