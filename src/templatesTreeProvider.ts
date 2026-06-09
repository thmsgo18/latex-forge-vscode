import * as vscode from 'vscode';
import { listTemplates, TemplateInfo } from './templates';

export class TemplatesTreeProvider implements vscode.TreeDataProvider<TemplateInfo> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private readonly outputChannel: vscode.OutputChannel) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TemplateInfo): vscode.TreeItem {
        const item = new vscode.TreeItem(element.name);
        if (element.builtin) {
            item.description = element.description;
        } else {
            item.description = element.installedVersion
                ? `v${element.installedVersion}`
                : 'user-installed';
        }
        item.tooltip = element.description ?? element.name;
        item.contextValue = element.builtin ? 'latexForgeBuiltinTemplate' : 'latexForgeUserTemplate';
        item.iconPath = new vscode.ThemeIcon('file-code');
        return item;
    }

    getChildren(element?: TemplateInfo): Thenable<TemplateInfo[]> {
        if (element) {
            return Promise.resolve([]);
        }
        return listTemplates(this.outputChannel);
    }
}
