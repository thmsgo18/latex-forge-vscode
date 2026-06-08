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
        this.contextValue = 'projectAction';
    }
}

// ---------------------------------------------------------------------------
// Singleton items (reused across refreshes)
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

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class ProjectTreeProvider implements vscode.TreeDataProvider<ProjectActionItem> {
    private readonly _onDidChangeTreeData =
        new vscode.EventEmitter<ProjectActionItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    // Tracks whether a LaTeX project is currently open. Driven by extension.ts
    // via setHasProject() so the tree and the VS Code context stay in sync.
    private _hasProject = false;

    setHasProject(value: boolean): void {
        if (this._hasProject === value) {
            return;
        }
        this._hasProject = value;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ProjectActionItem): vscode.TreeItem {
        return element;
    }

    getChildren(): ProjectActionItem[] {
        // Return the three action items only when a LaTeX project is open.
        // When _hasProject is false the tree is empty, which causes VS Code to
        // display the matching "viewsWelcome" entry from package.json instead.
        return this._hasProject ? [BUILD_ITEM, CLEAN_ITEM, OPEN_PDF_ITEM] : [];
    }
}
