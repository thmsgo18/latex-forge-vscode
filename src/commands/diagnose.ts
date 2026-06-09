import * as vscode from 'vscode';
import { execLatexForge } from '../cliRunner';

interface DiagItem {
    ok: boolean;
    version?: string;
    engines?: string[];
    fix?: string;
    path?: string;
    value?: string;
}

interface DiagnoseResult {
    latex_forge: DiagItem;
    pipx: DiagItem;
    texlive: DiagItem;
    latexmk: DiagItem;
    profile: DiagItem;
    default_template: DiagItem;
}

interface Row {
    ok: boolean;
    optional: boolean;
    label: string;
    detail: string;
    fix: string;
}

let panel: vscode.WebviewPanel | undefined;

/**
 * Extracts a clean version number from a raw version string.
 * Handles cases like "Latexmk, John Collins, 9 March 2026. Version 4.88"
 * by looking for a "Version X.YY" pattern, falling back to the raw string.
 */
function cleanVersion(raw: string | undefined): string {
    if (!raw) { return 'installed'; }
    const match = raw.match(/Version\s+(\S+)/i);
    return `v${match ? match[1] : raw}`;
}

function buildRow(
    label: string,
    item: DiagItem,
    detailFn: (d: DiagItem) => string,
    fixText: string,
    optional = false
): Row {
    return { ok: item.ok, optional, label, detail: detailFn(item), fix: fixText };
}

function renderDashboard(
    webview: vscode.Webview,
    data: DiagnoseResult,
    latexWorkshopInstalled: boolean
): string {
    const nonce = [...Array(32)].map(() => Math.random().toString(36)[2]).join('');
    const cspSource = webview.cspSource;

    const rows: Row[] = [
        buildRow('LaTeX Forge CLI', data.latex_forge,
            (d) => d.ok ? cleanVersion(d.version) : 'Not found',
            'Run: pipx install latex-forge'
        ),
        buildRow('pipx', data.pipx,
            (d) => d.ok ? cleanVersion(d.version) : 'Not found',
            'See <a href="https://pipx.pypa.io">pipx.pypa.io</a>'
        ),
        buildRow('TeX Live', data.texlive, (d) => {
            if (!d.ok) { return 'Not found'; }
            const engines = d.engines?.length ? ` (${d.engines.join(', ')})` : '';
            return `${cleanVersion(d.version)}${engines}`;
        }, data.texlive.fix ?? 'Install TeX Live: <a href="https://tug.org/texlive/">tug.org/texlive</a>'),
        buildRow('latexmk', data.latexmk,
            (d) => d.ok ? cleanVersion(d.version) : 'Not found',
            data.latexmk.fix ?? 'Install via TeX Live or your package manager'
        ),
        buildRow('LaTeX Workshop', { ok: latexWorkshopInstalled },
            (d) => d.ok ? 'Installed' : 'Not installed',
            'Install from VS Code Marketplace: James-Yu.latex-workshop',
            true /* optional */
        ),
        buildRow('Profile', data.profile,
            (d) => d.ok ? (d.path ?? 'configured') : 'Not configured',
            'Open "LaTeX Forge: Edit Profile" to fill in your details',
            true /* optional */
        ),
        buildRow('Default template', data.default_template,
            (d) => d.ok ? (d.value ?? 'set') : 'Not set',
            'Run: latex-forge config set default_template &lt;name&gt;',
            true /* optional */
        )
    ];

    const requiredRows = rows.filter((r) => !r.optional);
    const allRequiredOk = requiredRows.every((r) => r.ok);
    const summaryClass = allRequiredOk ? 'summary-ok' : 'summary-warn';
    const summaryText = allRequiredOk
        ? 'All required components are installed and ready.'
        : 'Some required components need attention: see the table below.';

    function rowBadge(r: Row): string {
        if (r.ok) { return '<span class="badge ok">OK</span>'; }
        if (r.optional) { return '<span class="badge info">Not set</span>'; }
        return '<span class="badge fail">Issue</span>';
    }

    const tableRows = rows.map((r) => `
        <tr class="${r.ok ? 'row-ok' : (r.optional ? 'row-info' : 'row-fail')}">
            <td class="col-name">${r.label}</td>
            <td class="col-status">${rowBadge(r)}</td>
            <td class="col-detail">${r.detail}</td>
            <td class="col-fix">${r.ok ? '' : r.fix}</td>
        </tr>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}'; img-src ${cspSource} https:;"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>LaTeX Forge: Diagnose</title>
    <style nonce="${nonce}">
        :root {
            --ok:   #4caf50;
            --fail: #e53935;
            --warn: #fb8c00;
            --muted: var(--vscode-descriptionForeground);
            --bg:   var(--vscode-editor-background);
            --fg:   var(--vscode-editor-foreground);
            --border: var(--vscode-widget-border, #444);
            --table-bg: var(--vscode-editorWidget-background, var(--vscode-editor-background));
        }
        body { font-family: var(--vscode-font-family); font-size: 13px; color: var(--fg); background: var(--bg); padding: 20px 24px; margin: 0; }
        h1 { font-size: 16px; font-weight: 600; margin: 0 0 16px; }
        .summary { border-radius: 4px; padding: 10px 14px; margin-bottom: 20px; font-size: 13px; }
        .summary-ok   { background: rgba(76,175,80,.15); border: 1px solid var(--ok); color: var(--ok); }
        .summary-warn { background: rgba(251,140,0,.12); border: 1px solid var(--warn); color: var(--warn); }
        table { border-collapse: collapse; width: 100%; background: var(--table-bg); border: 1px solid var(--border); border-radius: 4px; }
        th { text-align: left; font-weight: 600; padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid var(--border); }
        td { padding: 8px 12px; vertical-align: top; }
        tr + tr td { border-top: 1px solid var(--border); }
        .col-name   { font-weight: 500; white-space: nowrap; }
        .col-status { width: 70px; }
        .col-detail { color: var(--vscode-descriptionForeground); font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; }
        .col-fix    { font-size: 12px; color: var(--warn); }
        .col-fix a  { color: var(--vscode-textLink-foreground); }
        .row-info .col-name,
        .row-info .col-detail { color: var(--muted); }
        .badge { display: inline-block; border-radius: 3px; padding: 1px 7px; font-size: 11px; font-weight: 600; }
        .badge.ok   { background: rgba(76,175,80,.2);  color: var(--ok); }
        .badge.fail { background: rgba(229,57,53,.15); color: var(--fail); }
        .badge.info { background: rgba(128,128,128,.15); color: var(--muted); }
        .actions { margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap; }
        button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 3px; padding: 6px 14px; cursor: pointer; font-size: 12px; }
        button:hover { background: var(--vscode-button-hoverBackground); }
        button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
        button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    </style>
</head>
<body>
    <h1>Environment Diagnostics</h1>
    <div class="summary ${summaryClass}">${summaryText}</div>
    <table>
        <thead>
            <tr>
                <th>Component</th>
                <th>Status</th>
                <th>Details</th>
                <th>Fix</th>
            </tr>
        </thead>
        <tbody>
            ${tableRows}
        </tbody>
    </table>
    <div class="actions">
        <button id="refresh-btn">Refresh</button>
        <button class="secondary" id="setup-btn">Run setup wizard</button>
    </div>
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        document.getElementById('refresh-btn').addEventListener('click', () => {
            vscode.postMessage({ type: 'refresh' });
        });
        document.getElementById('setup-btn').addEventListener('click', () => {
            vscode.postMessage({ type: 'setup' });
        });
    </script>
</body>
</html>`;
}

export async function diagnoseCommand(
    outputChannel: vscode.OutputChannel
): Promise<void> {
    if (panel) {
        panel.reveal();
        await reloadPanel(outputChannel);
        return;
    }

    panel = vscode.window.createWebviewPanel(
        'latexForgeDiagnose',
        'LaTeX Forge: Diagnose',
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    panel.onDidDispose(() => {
        panel = undefined;
    });

    panel.webview.onDidReceiveMessage(async (msg: { type: string }) => {
        if (msg.type === 'refresh') {
            await reloadPanel(outputChannel);
        } else if (msg.type === 'setup') {
            await vscode.commands.executeCommand('latex-forge.setupEnvironment');
        }
    });

    await reloadPanel(outputChannel);
}

async function reloadPanel(outputChannel: vscode.OutputChannel): Promise<void> {
    if (!panel) { return; }

    panel.webview.html = buildLoadingHtml(panel.webview);

    const latexWorkshopInstalled =
        vscode.extensions.getExtension('James-Yu.latex-workshop') !== undefined;

    const result = await execLatexForge(['diagnose', '--json']);

    if (!result.stdout.trim()) {
        outputChannel.appendLine('LaTeX Forge diagnose: no output received.');
        panel.webview.html = buildErrorHtml(panel.webview, 'No output from diagnose command.');
        return;
    }

    let data: DiagnoseResult;
    try {
        data = JSON.parse(result.stdout);
    } catch {
        outputChannel.appendLine('LaTeX Forge diagnose: could not parse JSON output.');
        outputChannel.appendLine(result.stdout);
        panel.webview.html = buildErrorHtml(panel.webview, 'Could not parse diagnose output.');
        return;
    }

    panel.webview.html = renderDashboard(panel.webview, data, latexWorkshopInstalled);
}

function buildLoadingHtml(webview: vscode.Webview): string {
    const nonce = [...Array(32)].map(() => Math.random().toString(36)[2]).join('');
    return `<!DOCTYPE html>
<html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}';"/>
<style nonce="${nonce}">body{font-family:var(--vscode-font-family);color:var(--vscode-editor-foreground);background:var(--vscode-editor-background);padding:24px;}</style>
</head><body>Loading diagnostics...</body></html>`;
}

function buildErrorHtml(webview: vscode.Webview, message: string): string {
    const nonce = [...Array(32)].map(() => Math.random().toString(36)[2]).join('');
    return `<!DOCTYPE html>
<html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}';"/>
<style nonce="${nonce}">body{font-family:var(--vscode-font-family);color:var(--vscode-editor-foreground);background:var(--vscode-editor-background);padding:24px;}</style>
</head><body><p style="color:#e53935">Error: ${message}</p><p>See the "LaTeX Forge" output channel for details.</p></body></html>`;
}
