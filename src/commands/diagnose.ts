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

let panel: vscode.WebviewPanel | undefined;

function renderDashboard(
    webview: vscode.Webview,
    data: DiagnoseResult
): string {
    const nonce = [...Array(32)].map(() => Math.random().toString(36)[2]).join('');
    const cspSource = webview.cspSource;

    const rows = [
        buildRow('LaTeX Forge CLI', data.latex_forge, (d) =>
            d.ok ? `v${d.version}` : 'Not found',
            'Not installed — run: pipx install latex-forge'
        ),
        buildRow('pipx', data.pipx, (d) =>
            d.ok ? `v${d.version}` : 'Not found',
            'Not installed — see <a href="https://pipx.pypa.io">pipx.pypa.io</a>'
        ),
        buildRow('TeX Live', data.texlive, (d) => {
            if (!d.ok) { return 'Not found'; }
            const engines = d.engines?.length ? ` (${d.engines.join(', ')})` : '';
            return d.version ? `v${d.version}${engines}` : `installed${engines}`;
        }, data.texlive.fix ?? 'Install TeX Live: <a href="https://tug.org/texlive/">tug.org/texlive</a>'),
        buildRow('latexmk', data.latexmk, (d) =>
            d.ok ? `v${d.version}` : 'Not found',
            data.latexmk.fix ?? 'Install via TeX Live or package manager'
        ),
        buildRow('Profile', data.profile, (d) =>
            d.ok ? (d.path ?? 'configured') : 'Not configured',
            'Run: latex-forge profile set'
        ),
        buildRow('Default template', data.default_template, (d) =>
            d.ok ? (d.value ?? 'set') : 'Not set',
            'Run: latex-forge config set default_template &lt;name&gt;'
        )
    ];

    const allOk = rows.every((r) => r.ok);
    const summaryClass = allOk ? 'summary-ok' : 'summary-warn';
    const summaryText = allOk
        ? '✓ All components are installed and configured.'
        : '⚠ Some components need attention — see details below.';

    const tableRows = rows.map((r) => `
        <tr class="${r.ok ? 'row-ok' : 'row-fail'}">
            <td class="col-name">${r.label}</td>
            <td class="col-status">${r.ok ? '<span class="badge ok">OK</span>' : '<span class="badge fail">Issue</span>'}</td>
            <td class="col-detail">${r.detail}</td>
            <td class="col-fix">${r.ok ? '' : r.fix}</td>
        </tr>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}'; img-src ${cspSource} https:;"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>LaTeX Forge — Diagnose</title>
    <style nonce="${nonce}">
        :root {
            --ok:   #4caf50;
            --fail: #e53935;
            --warn: #fb8c00;
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
        .col-status { width: 60px; }
        .col-detail { color: var(--vscode-descriptionForeground); font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; }
        .col-fix    { font-size: 12px; color: var(--warn); }
        .col-fix a  { color: var(--vscode-textLink-foreground); }
        .badge { display: inline-block; border-radius: 3px; padding: 1px 7px; font-size: 11px; font-weight: 600; }
        .badge.ok   { background: rgba(76,175,80,.2); color: var(--ok); }
        .badge.fail { background: rgba(229,57,53,.15); color: var(--fail); }
        .actions { margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap; }
        button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 3px; padding: 6px 14px; cursor: pointer; font-size: 12px; }
        button:hover { background: var(--vscode-button-hoverBackground); }
        button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
        button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    </style>
</head>
<body>
    <h1>$(beaker) LaTeX Forge — Environment Diagnostics</h1>
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
        <button id="refresh-btn">↻ Refresh</button>
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

interface Row {
    ok: boolean;
    label: string;
    detail: string;
    fix: string;
}

function buildRow(
    label: string,
    item: DiagItem,
    detailFn: (d: DiagItem) => string,
    fixText: string
): Row {
    return {
        ok: item.ok,
        label,
        detail: detailFn(item),
        fix: fixText
    };
}

export async function diagnoseCommand(
    outputChannel: vscode.OutputChannel
): Promise<void> {
    // Re-use existing panel if open
    if (panel) {
        panel.reveal();
        await reloadPanel(outputChannel);
        return;
    }

    panel = vscode.window.createWebviewPanel(
        'latexForgeDiagnose',
        'LaTeX Forge — Diagnose',
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

async function reloadPanel(
    outputChannel: vscode.OutputChannel
): Promise<void> {
    if (!panel) { return; }

    panel.webview.html = buildLoadingHtml(panel.webview);

    const result = await execLatexForge(['diagnose', '--json']);

    // diagnose exits 1 when some tools are missing, but JSON is still on stdout
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

    panel.webview.html = renderDashboard(panel.webview, data);
}

function buildLoadingHtml(webview: vscode.Webview): string {
    const nonce = [...Array(32)].map(() => Math.random().toString(36)[2]).join('');
    return `<!DOCTYPE html>
<html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}';"/>
<style nonce="${nonce}">body{font-family:var(--vscode-font-family);color:var(--vscode-editor-foreground);background:var(--vscode-editor-background);padding:24px;}</style>
</head><body>Loading diagnostics…</body></html>`;
}

function buildErrorHtml(webview: vscode.Webview, message: string): string {
    const nonce = [...Array(32)].map(() => Math.random().toString(36)[2]).join('');
    return `<!DOCTYPE html>
<html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}';"/>
<style nonce="${nonce}">body{font-family:var(--vscode-font-family);color:var(--vscode-editor-foreground);background:var(--vscode-editor-background);padding:24px;}</style>
</head><body><p style="color:#e53935">Error: ${message}</p><p>See the "LaTeX Forge" output channel for details.</p></body></html>`;
}
