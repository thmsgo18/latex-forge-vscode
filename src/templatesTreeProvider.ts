import * as vscode from 'vscode';
import { fetchGalleryTemplates } from './gallery';
import { listTemplates, TemplateInfo } from './templates';

export class TemplatesTreeProvider implements vscode.TreeDataProvider<TemplateInfo> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    // templateName -> preview_png URL fetched from gallery.json
    private readonly previewUrls = new Map<string, string>();
    private galleryFetched = false;

    refresh(): void {
        this.galleryFetched = false;
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

        item.contextValue = element.builtin ? 'latexForgeBuiltinTemplate' : 'latexForgeUserTemplate';
        item.iconPath = new vscode.ThemeIcon('file-code');

        const previewUrl = this.previewUrls.get(element.name);
        if (previewUrl) {
            const md = new vscode.MarkdownString();
            md.supportHtml = true;
            md.appendMarkdown(`**${element.name}**\n\n`);
            if (element.description) {
                md.appendMarkdown(`${element.description}\n\n`);
            }
            md.appendMarkdown(
                `<img src="${previewUrl}" style="max-width:100%;display:block;" />`
            );
            item.tooltip = md;
        } else {
            item.tooltip = element.description ?? element.name;
        }

        return item;
    }

    getChildren(element?: TemplateInfo): Thenable<TemplateInfo[]> {
        if (element) {
            return Promise.resolve([]);
        }
        return this.loadTemplates();
    }

    private async loadTemplates(): Promise<TemplateInfo[]> {
        const templates = await listTemplates();

        // Fetch gallery preview URLs in the background (once per refresh cycle).
        // When they arrive, fire a change event so tooltips update.
        if (!this.galleryFetched) {
            this.galleryFetched = true;
            void this.fetchPreviewUrls();
        }

        return templates;
    }

    private async fetchPreviewUrls(): Promise<void> {
        try {
            const gallery = await fetchGalleryTemplates();
            let changed = false;
            for (const g of gallery) {
                if (g.preview_png && !this.previewUrls.has(g.name)) {
                    this.previewUrls.set(g.name, g.preview_png);
                    changed = true;
                }
            }
            if (changed) {
                this._onDidChangeTreeData.fire();
            }
        } catch {
            // Gallery unreachable — tooltips just show text descriptions
        }
    }
}
