import * as vscode from 'vscode';
import { isLatexForgeAvailable, promptInstallLatexForge } from '../cliDetection';
import { runLatexForge } from '../cliRunner';
import { fetchGalleryTemplates, GalleryTemplate } from '../gallery';
import { listTemplates } from '../templates';

const GALLERY_IMAGE_HOST = 'https://raw.githubusercontent.com';

let currentPanel: vscode.WebviewPanel | undefined;

// ── Message contracts ────────────────────────────────────────────────────────

interface WebviewToExtensionMessage {
    type: 'install' | 'installAndCreate' | 'create' | 'refresh' | 'openLink';
    name?: string;
    installUrl?: string;
    url?: string;
}

interface ExtensionToWebviewMessage {
    type: 'installResult';
    name: string;
    success: boolean;
    andCreate: boolean;
}

// ── Public command ────────────────────────────────────────────────────────────

export async function browseGalleryCommand(
    outputChannel: vscode.OutputChannel,
    onTemplateInstalled?: () => void,
    onInstallAndCreate?: (templateName: string) => Promise<void>
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

    panel.webview.onDidReceiveMessage(async (msg: WebviewToExtensionMessage) => {
        switch (msg.type) {
            case 'refresh':
                await loadGallery(panel, outputChannel);
                break;

            case 'install':
                if (msg.name && msg.installUrl) {
                    await runInstall(panel, outputChannel, msg.name, msg.installUrl, false,
                        onTemplateInstalled, onInstallAndCreate);
                }
                break;

            case 'installAndCreate':
                if (msg.name && msg.installUrl) {
                    await runInstall(panel, outputChannel, msg.name, msg.installUrl, true,
                        onTemplateInstalled, onInstallAndCreate);
                }
                break;

            case 'create':
                // Template already installed — skip install, go straight to project creation.
                if (msg.name && onInstallAndCreate) {
                    await onInstallAndCreate(msg.name);
                }
                break;

            case 'openLink':
                if (msg.url) {
                    await vscode.env.openExternal(vscode.Uri.parse(msg.url));
                }
                break;
        }
    });

    await loadGallery(panel, outputChannel);
}

// ── Loaders ──────────────────────────────────────────────────────────────────

async function loadGallery(
    panel: vscode.WebviewPanel,
    outputChannel: vscode.OutputChannel
): Promise<void> {
    panel.webview.html = renderShell(panel.webview, '<p class="status">Loading the template gallery…</p>');

    try {
        const [galleryTemplates, installed] = await Promise.all([
            fetchGalleryTemplates(),
            listTemplates(outputChannel)
        ]);
        const installedNames = new Set(installed.map((t) => t.name));
        panel.webview.html = renderGallery(panel.webview, galleryTemplates, installedNames);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`Failed to load the template gallery: ${msg}`);
        panel.webview.html = renderShell(
            panel.webview,
            `<p class="status status-error">Failed to load the template gallery.</p>
             <p class="status-detail">${escapeHtml(msg)}</p>
             <button class="button" id="retry-button">Retry</button>`,
            `const vscode = acquireVsCodeApi();
             document.getElementById('retry-button').addEventListener('click', () => {
                 vscode.postMessage({ type: 'refresh' });
             });`
        );
    }
}

async function runInstall(
    panel: vscode.WebviewPanel,
    outputChannel: vscode.OutputChannel,
    name: string,
    installUrl: string,
    andCreate: boolean,
    onTemplateInstalled?: () => void,
    onInstallAndCreate?: (templateName: string) => Promise<void>
): Promise<void> {
    outputChannel.show(true);
    const result = await runLatexForge(['template', 'install', installUrl], { outputChannel });
    const success = result.exitCode === 0;

    void panel.webview.postMessage({ type: 'installResult', name, success, andCreate } satisfies ExtensionToWebviewMessage);

    if (success) {
        onTemplateInstalled?.();
        if (andCreate && onInstallAndCreate) {
            await onInstallAndCreate(name);
        } else if (!andCreate) {
            await vscode.window.showInformationMessage(`Template "${name}" installed from the gallery.`);
        }
    } else {
        await vscode.window.showErrorMessage(
            `Failed to install "${name}" (exit code ${result.exitCode}). See the "LaTeX Forge" output channel for details.`
        );
    }
}

// ── Renderers ─────────────────────────────────────────────────────────────────

function renderGallery(
    webview: vscode.Webview,
    templates: GalleryTemplate[],
    installedNames: Set<string>
): string {
    const categories = [...new Set(templates.map((t) => t.category))].sort();

    const categoryOptions = categories
        .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
        .join('');

    const cards = templates.map((t) => renderCard(t, installedNames.has(t.name))).join('\n');

    const body = `
        <div class="toolbar">
            <label for="category-filter">Category</label>
            <select id="category-filter">
                <option value="">All</option>
                ${categoryOptions}
            </select>
            <input type="search" id="search-input" placeholder="Search by name or description…" />
            <span class="result-count" id="result-count"></span>
            <button class="button button-secondary" id="refresh-button">↺ Refresh</button>
        </div>
        <div class="grid" id="grid">
            ${cards}
        </div>
        <p class="status" id="empty-state" hidden>No templates match the current filter.</p>
    `;

    const script = `
        const vscode = acquireVsCodeApi();
        const categoryFilter = document.getElementById('category-filter');
        const searchInput    = document.getElementById('search-input');
        const cards          = Array.from(document.querySelectorAll('.card'));
        const resultCount    = document.getElementById('result-count');
        const emptyState     = document.getElementById('empty-state');

        function applyFilter() {
            const category = categoryFilter.value;
            const query    = searchInput.value.toLowerCase().trim();
            let visible = 0;
            for (const card of cards) {
                const matchesCategory = !category || card.dataset.category === category;
                const matchesSearch   = !query
                    || card.dataset.name.toLowerCase().includes(query)
                    || (card.dataset.description || '').toLowerCase().includes(query);
                const matches = matchesCategory && matchesSearch;
                card.style.display = matches ? '' : 'none';
                if (matches) { visible++; }
            }
            resultCount.textContent = visible + ' / ' + cards.length + ' templates';
            emptyState.hidden = visible !== 0;
        }

        categoryFilter.addEventListener('change', applyFilter);
        searchInput.addEventListener('input', applyFilter);
        applyFilter();

        document.getElementById('refresh-button').addEventListener('click', () => {
            vscode.postMessage({ type: 'refresh' });
        });

        for (const card of cards) {
            const installBtn       = card.querySelector('.install-btn');
            const installCreateBtn = card.querySelector('.install-create-btn');

            installBtn.addEventListener('click', () => {
                installBtn.disabled       = true;
                installBtn.textContent    = 'Installing…';
                installCreateBtn.disabled = true;
                card.querySelector('.card-status').textContent = '';
                vscode.postMessage({ type: 'install', name: card.dataset.name, installUrl: card.dataset.installUrl });
            });

            installCreateBtn.addEventListener('click', () => {
                if (card.dataset.installed === 'true') {
                    // Already installed — skip reinstall, go straight to project creation.
                    vscode.postMessage({ type: 'create', name: card.dataset.name });
                } else {
                    installBtn.disabled            = true;
                    installCreateBtn.disabled      = true;
                    installCreateBtn.textContent   = 'Installing…';
                    card.querySelector('.card-status').textContent = '';
                    vscode.postMessage({ type: 'installAndCreate', name: card.dataset.name, installUrl: card.dataset.installUrl });
                }
            });

            for (const link of card.querySelectorAll('.external-link')) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    vscode.postMessage({ type: 'openLink', url: link.dataset.url });
                });
            }
        }

        window.addEventListener('message', (event) => {
            const msg = event.data;
            if (msg.type !== 'installResult') { return; }
            const card = cards.find((c) => c.dataset.name === msg.name);
            if (!card) { return; }
            const installBtn       = card.querySelector('.install-btn');
            const installCreateBtn = card.querySelector('.install-create-btn');
            const status           = card.querySelector('.card-status');

            if (msg.success) {
                card.dataset.installed     = 'true';
                installBtn.disabled        = false;
                installBtn.textContent     = 'Reinstall';
                installCreateBtn.disabled  = false;
                installCreateBtn.textContent = 'Create project';

                // Add the installed badge if it isn't there yet.
                const header = card.querySelector('.card-header');
                if (header && !header.querySelector('.badge-installed')) {
                    const badge = document.createElement('span');
                    badge.className   = 'badge badge-installed';
                    badge.textContent = '✓ Installed';
                    header.appendChild(badge);
                }

                if (!msg.andCreate) {
                    status.textContent = '✓ Installed successfully.';
                    status.className   = 'card-status card-status-success';
                }
            } else {
                installBtn.disabled        = false;
                installBtn.textContent     = card.dataset.installed === 'true' ? 'Reinstall' : 'Install';
                installCreateBtn.disabled  = false;
                installCreateBtn.textContent = card.dataset.installed === 'true' ? 'Create project' : 'Install & Create';
                status.textContent = '✗ Installation failed. See the output channel for details.';
                status.className   = 'card-status card-status-error';
            }
        });
    `;

    return renderShell(webview, body, script);
}

function renderCard(template: GalleryTemplate, isInstalled: boolean): string {
    const tags = template.tags
        .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
        .join('');

    const preview = template.preview_png
        ? `<img class="preview" src="${escapeHtml(template.preview_png)}"
               alt="Preview of ${escapeHtml(template.name)}" loading="lazy" />`
        : '<div class="preview preview-placeholder">No preview</div>';

    const installedBadge = isInstalled
        ? '<span class="badge badge-installed">✓ Installed</span>'
        : '';

    const previewPdfLink = template.preview_pdf
        ? `<a class="link external-link" href="#"
               data-url="${escapeHtml(template.preview_pdf)}">Preview PDF</a>`
        : '';

    const installBtnLabel     = isInstalled ? 'Reinstall'      : 'Install';
    const installCreateLabel  = isInstalled ? 'Create project' : 'Install &amp; Create';

    return `
        <div class="card"
             data-name="${escapeHtml(template.name)}"
             data-category="${escapeHtml(template.category)}"
             data-description="${escapeHtml(template.description)}"
             data-install-url="${escapeHtml(template.install_url)}"
             data-installed="${isInstalled ? 'true' : 'false'}">
            ${preview}
            <div class="card-body">
                <div class="card-header">
                    <h3 class="card-title">${escapeHtml(template.name)}</h3>
                    ${installedBadge}
                </div>
                <p class="card-description">${escapeHtml(template.description)}</p>
                <div class="card-meta">
                    <span class="badge">${escapeHtml(template.category)}</span>
                    <span class="badge badge-engine">${escapeHtml(template.engine)}</span>
                </div>
                <div class="tags">${tags}</div>
                <div class="card-actions">
                    <button class="button install-btn">${installBtnLabel}</button>
                    <button class="button button-accent install-create-btn">${installCreateLabel}</button>
                    ${previewPdfLink}
                    <a class="link external-link" href="#"
                       data-url="${escapeHtml(template.install_url)}">View in gallery repo</a>
                </div>
                <p class="card-status"></p>
            </div>
        </div>
    `;
}

function renderShell(webview: vscode.Webview, body: string, script?: string): string {
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
        *, *::before, *::after { box-sizing: border-box; }
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            padding: 16px;
            margin: 0;
        }

        /* ── Toolbar ── */
        .toolbar {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 16px;
            flex-wrap: wrap;
        }
        .toolbar label { font-weight: 600; white-space: nowrap; }
        select {
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 2px;
            padding: 4px 8px;
        }
        #search-input {
            flex: 1;
            min-width: 160px;
            padding: 4px 8px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border, transparent);
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
        }
        #search-input:focus { outline: 1px solid var(--vscode-focusBorder); }
        #search-input::placeholder { color: var(--vscode-input-placeholderForeground); }
        .result-count { opacity: 0.7; white-space: nowrap; margin-left: auto; margin-right: 4px; }

        /* ── Buttons ── */
        .button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none; border-radius: 2px;
            padding: 5px 12px; cursor: pointer;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            white-space: nowrap;
        }
        .button:hover { background: var(--vscode-button-hoverBackground); }
        .button:disabled { opacity: 0.55; cursor: default; }
        .button-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .button-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
        .button-accent {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            opacity: 0.85;
        }
        .button-accent:hover { opacity: 1; background: var(--vscode-button-hoverBackground); }

        /* ── Grid & cards ── */
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
            gap: 16px;
        }
        .card {
            border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
            border-radius: 4px; overflow: hidden;
            display: flex; flex-direction: column;
            background: var(--vscode-editorWidget-background);
        }
        .preview {
            width: 100%; height: 160px;
            object-fit: cover; object-position: top;
            background: var(--vscode-input-background);
        }
        .preview-placeholder {
            display: flex; align-items: center; justify-content: center;
            opacity: 0.5;
        }
        .card-body {
            padding: 12px;
            display: flex; flex-direction: column; gap: 6px;
            flex: 1;
        }
        .card-header {
            display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        }
        .card-title { margin: 0; font-size: 1em; }
        .card-description { margin: 0; opacity: 0.82; font-size: 0.88em; }

        /* ── Badges ── */
        .card-meta { display: flex; gap: 6px; flex-wrap: wrap; }
        .badge {
            font-size: 0.72em; text-transform: uppercase; letter-spacing: 0.04em;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 2px; padding: 2px 6px;
        }
        .badge-installed {
            background: color-mix(in srgb, var(--vscode-testing-iconPassed, #3fb950) 20%, transparent);
            color: var(--vscode-testing-iconPassed, #3fb950);
            border: 1px solid var(--vscode-testing-iconPassed, #3fb950);
        }
        .badge-engine { opacity: 0.75; }

        /* ── Tags ── */
        .tags { display: flex; flex-wrap: wrap; gap: 4px; }
        .tag {
            font-size: 0.72em; opacity: 0.65;
            border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
            border-radius: 10px; padding: 1px 7px;
        }

        /* ── Card actions ── */
        .card-actions {
            display: flex; align-items: center;
            flex-wrap: wrap; gap: 8px;
            margin-top: auto; padding-top: 6px;
        }
        .link {
            color: var(--vscode-textLink-foreground);
            font-size: 0.83em; cursor: pointer;
            text-decoration: none;
        }
        .link:hover { text-decoration: underline; }
        .card-status { margin: 0; font-size: 0.83em; min-height: 1.2em; }
        .card-status-success { color: var(--vscode-testing-iconPassed, #3fb950); }
        .card-status-error   { color: var(--vscode-errorForeground); }

        /* ── Misc ── */
        .status        { opacity: 0.8; }
        .status-error  { color: var(--vscode-errorForeground); }
        .status-detail { opacity: 0.7; font-size: 0.9em; }
    </style>
</head>
<body>
    ${body}
    ${scriptTag}
</body>
</html>`;
}

// ── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
