import * as vscode from 'vscode';
import { isLatexForgeAvailable, promptInstallLatexForge } from '../cliDetection';
import { runLatexForge } from '../cliRunner';
import { fetchGalleryTemplates, GalleryTemplate } from '../gallery';

const GALLERY_IMAGE_HOST = 'https://raw.githubusercontent.com';

let currentPanel: vscode.WebviewPanel | undefined;

interface WebviewToExtensionMessage {
    type: 'install' | 'refresh' | 'openSource';
    name?: string;
    installUrl?: string;
    sourceUrl?: string;
}

interface ExtensionToWebviewMessage {
    type: 'installResult';
    name: string;
    success: boolean;
}

export async function browseGalleryCommand(
    outputChannel: vscode.OutputChannel,
    onTemplateInstalled?: () => void
): Promise<void> {
    if (!(await isLatexForgeAvailable())) {
        await promptInstallLatexForge();
        return;
    }

    if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.One);
        return;
    }

    const panel = vscode.window.createWebviewPanel(
        'latexForgeGallery',
        'LaTeX Forge: Template Gallery',
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    currentPanel = panel;
    panel.onDidDispose(() => {
        currentPanel = undefined;
    });

    panel.webview.onDidReceiveMessage(async (message: WebviewToExtensionMessage) => {
        switch (message.type) {
            case 'refresh':
                await loadGallery(panel, outputChannel);
                break;
            case 'install':
                if (message.name && message.installUrl) {
                    await installFromGallery(panel, outputChannel, message.name, message.installUrl, onTemplateInstalled);
                }
                break;
            case 'openSource':
                if (message.sourceUrl) {
                    await vscode.env.openExternal(vscode.Uri.parse(message.sourceUrl));
                }
                break;
        }
    });

    await loadGallery(panel, outputChannel);
}

async function loadGallery(panel: vscode.WebviewPanel, outputChannel: vscode.OutputChannel): Promise<void> {
    panel.webview.html = renderShell(panel.webview, '<p class="status">Loading the template gallery…</p>');

    try {
        const templates = await fetchGalleryTemplates();
        panel.webview.html = renderGallery(panel.webview, templates);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`Failed to load the template gallery: ${message}`);
        panel.webview.html = renderShell(
            panel.webview,
            `<p class="status status-error">Failed to load the template gallery.</p>
             <p class="status-detail">${escapeHtml(message)}</p>
             <button class="button" id="retry-button">Retry</button>`,
            `const vscode = acquireVsCodeApi();
             document.getElementById('retry-button').addEventListener('click', () => {
                 vscode.postMessage({ type: 'refresh' });
             });`
        );
    }
}

async function installFromGallery(
    panel: vscode.WebviewPanel,
    outputChannel: vscode.OutputChannel,
    name: string,
    installUrl: string,
    onTemplateInstalled?: () => void
): Promise<void> {
    outputChannel.show(true);

    const result = await runLatexForge(['template', 'install', installUrl], { outputChannel });
    const success = result.exitCode === 0;

    const reply: ExtensionToWebviewMessage = { type: 'installResult', name, success };
    panel.webview.postMessage(reply);

    if (success) {
        await vscode.window.showInformationMessage(`Template "${name}" installed from the gallery.`);
        onTemplateInstalled?.();
    } else {
        await vscode.window.showErrorMessage(
            `Failed to install "${name}" (exit code ${result.exitCode}). See the "LaTeX Forge" output channel for details.`
        );
    }
}

function renderGallery(webview: vscode.Webview, templates: GalleryTemplate[]): string {
    const categories = [...new Set(templates.map((t) => t.category))].sort();

    const categoryOptions = categories
        .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
        .join('');

    const cards = templates.map((template) => renderCard(template)).join('\n');

    const body = `
        <div class="toolbar">
            <label for="category-filter">Category</label>
            <select id="category-filter">
                <option value="">All categories</option>
                ${categoryOptions}
            </select>
            <span class="result-count" id="result-count"></span>
            <button class="button button-secondary" id="refresh-button">Refresh</button>
        </div>
        <div class="grid" id="grid">
            ${cards}
        </div>
        <p class="status" id="empty-state" hidden>No templates match the selected category.</p>
    `;

    const script = `
            const vscode = acquireVsCodeApi();
            const categoryFilter = document.getElementById('category-filter');
            const cards = Array.from(document.querySelectorAll('.card'));
            const resultCount = document.getElementById('result-count');
            const emptyState = document.getElementById('empty-state');

            function applyFilter() {
                const category = categoryFilter.value;
                let visible = 0;
                for (const card of cards) {
                    const matches = !category || card.dataset.category === category;
                    // Toggle visibility through the inline "display" style rather than
                    // the "hidden" attribute: ".card" already sets "display: flex" with
                    // the same selector specificity as the browser's default
                    // "[hidden] { display: none }" rule, so the page's own rule would win
                    // and the attribute would have no visual effect. An inline style
                    // always wins over stylesheet rules, so this reliably hides cards.
                    card.style.display = matches ? '' : 'none';
                    if (matches) {
                        visible++;
                    }
                }
                resultCount.textContent = visible + ' / ' + cards.length + ' templates';
                emptyState.hidden = visible !== 0;
            }

            categoryFilter.addEventListener('change', applyFilter);
            applyFilter();

            document.getElementById('refresh-button').addEventListener('click', () => {
                vscode.postMessage({ type: 'refresh' });
            });

            for (const card of cards) {
                const installButton = card.querySelector('.install-button');
                installButton.addEventListener('click', () => {
                    installButton.disabled = true;
                    installButton.textContent = 'Installing…';
                    card.querySelector('.card-status').textContent = '';
                    vscode.postMessage({
                        type: 'install',
                        name: card.dataset.name,
                        installUrl: card.dataset.installUrl
                    });
                });

                const sourceLink = card.querySelector('.source-link');
                if (sourceLink) {
                    sourceLink.addEventListener('click', (event) => {
                        event.preventDefault();
                        vscode.postMessage({ type: 'openSource', sourceUrl: card.dataset.sourceUrl });
                    });
                }
            }

            window.addEventListener('message', (event) => {
                const message = event.data;
                if (message.type !== 'installResult') {
                    return;
                }
                const card = cards.find((c) => c.dataset.name === message.name);
                if (!card) {
                    return;
                }
                const button = card.querySelector('.install-button');
                const status = card.querySelector('.card-status');
                if (message.success) {
                    button.textContent = 'Installed';
                    status.textContent = 'Installed successfully.';
                    status.className = 'card-status card-status-success';
                } else {
                    button.disabled = false;
                    button.textContent = 'Install';
                    status.textContent = 'Installation failed. See the output channel for details.';
                    status.className = 'card-status card-status-error';
                }
            });
    `;

    return renderShell(webview, body, script);
}

function renderCard(template: GalleryTemplate): string {
    const tags = template.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
    const preview = template.preview_png
        ? `<img class="preview" src="${escapeHtml(template.preview_png)}" alt="Preview of ${escapeHtml(template.name)}" loading="lazy" />`
        : '<div class="preview preview-placeholder">No preview</div>';

    return `
        <div class="card" data-name="${escapeHtml(template.name)}" data-category="${escapeHtml(template.category)}"
             data-install-url="${escapeHtml(template.install_url)}" data-source-url="${escapeHtml(template.source_url)}">
            ${preview}
            <div class="card-body">
                <h3 class="card-title">${escapeHtml(template.name)}</h3>
                <p class="card-description">${escapeHtml(template.description)}</p>
                <div class="card-meta">
                    <span class="badge">${escapeHtml(template.category)}</span>
                    <span class="badge badge-engine">${escapeHtml(template.engine)}</span>
                </div>
                <div class="tags">${tags}</div>
                <div class="card-actions">
                    <button class="button install-button">Install</button>
                    <a class="source-link" href="${escapeHtml(template.source_url)}">View source</a>
                </div>
                <p class="card-status"></p>
            </div>
        </div>
    `;
}

function renderShell(webview: vscode.Webview, body: string, script?: string): string {
    // The nonce must be identical in the CSP's script-src directive and in the
    // <script> tag's nonce attribute below — generating it here, once, and
    // reusing it in both places is what makes the inline script eligible to
    // run under the policy.
    const nonce = getNonce();
    const csp = [
        "default-src 'none'",
        `img-src ${GALLERY_IMAGE_HOST} https: data:`,
        `style-src ${webview.cspSource} 'unsafe-inline'`,
        `script-src 'nonce-${nonce}'`
    ].join('; ');

    const scriptTag = script ? `<script nonce="${nonce}">${script}</script>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LaTeX Forge: Template Gallery</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            padding: 16px;
        }
        .toolbar {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 16px;
        }
        .toolbar label {
            font-weight: 600;
        }
        select {
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 2px;
            padding: 4px 8px;
        }
        .result-count {
            opacity: 0.7;
            margin-left: auto;
            margin-right: 8px;
        }
        .button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            padding: 6px 14px;
            cursor: pointer;
        }
        .button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .button:disabled {
            opacity: 0.6;
            cursor: default;
        }
        .button-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .button-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
            gap: 16px;
        }
        .card {
            border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
            border-radius: 4px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            background: var(--vscode-editorWidget-background);
        }
        .preview {
            width: 100%;
            height: 160px;
            object-fit: cover;
            object-position: top;
            background: var(--vscode-input-background);
        }
        .preview-placeholder {
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.6;
        }
        .card-body {
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .card-title {
            margin: 0;
            font-size: 1.05em;
        }
        .card-description {
            margin: 0;
            opacity: 0.85;
            font-size: 0.9em;
        }
        .card-meta {
            display: flex;
            gap: 6px;
        }
        .badge {
            font-size: 0.75em;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 2px;
            padding: 2px 6px;
        }
        .tags {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }
        .tag {
            font-size: 0.75em;
            opacity: 0.7;
            border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
            border-radius: 10px;
            padding: 1px 8px;
        }
        .card-actions {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-top: 4px;
        }
        .source-link {
            color: var(--vscode-textLink-foreground);
            font-size: 0.85em;
            cursor: pointer;
        }
        .card-status {
            margin: 0;
            font-size: 0.85em;
            min-height: 1.2em;
        }
        .card-status-success {
            color: var(--vscode-testing-iconPassed, var(--vscode-foreground));
        }
        .card-status-error {
            color: var(--vscode-errorForeground);
        }
        .status {
            opacity: 0.8;
        }
        .status-error {
            color: var(--vscode-errorForeground);
        }
        .status-detail {
            opacity: 0.7;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    ${body}
    ${scriptTag}
</body>
</html>`;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getNonce(): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
