import * as vscode from 'vscode';

// ---------------------------------------------------------------------------
// Tree item
// ---------------------------------------------------------------------------

export class ProjectActionItem extends vscode.TreeItem {
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
        // Used by the "when" clause in package.json menus.
        this.contextValue = 'projectAction';
    }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const BUILD_ITEM = new ProjectActionItem(
    'Build',
    'debug-start',
    new vscode.ThemeColor('testing.iconPassed'),
    'latex-forge.buildProject',
    'Compile the project to PDF with latexmk'
);

const CLEAN_ITEM = new ProjectActionItem(
    'Clean',
    'trash',
    new vscode.ThemeColor('editorWarning.foreground'),
    'latex-forge.cleanProject',
    'Remove build artefacts (everything in the output folder except the PDF)'
);

const OPEN_PDF_ITEM = new ProjectActionItem(
    'Open PDF',
    'eye',
    new vscode.ThemeColor('textLink.foreground'),
    'latex-forge.openPdf',
    'Open the compiled PDF in VS Code'
);

export class ProjectTreeProvider implements vscode.TreeDataProvider<ProjectActionItem> {
    private readonly _onDidChangeTreeData =
        new vscode.EventEmitter<ProjectActionItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ProjectActionItem): vscode.TreeItem {
        return element;
    }

    getChildren(): ProjectActionItem[] {
        // Return the three actions whenever a folder is open; the "viewsWelcome"
        // contribution in package.json handles the empty-workspace placeholder.
        if (!vscode.workspace.workspaceFolders?.length) {
            return [];
        }
        return [BUILD_ITEM, CLEAN_ITEM, OPEN_PDF_ITEM];
    }
}
