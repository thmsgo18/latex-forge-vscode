import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as TOML from '@iarna/toml';
import * as vscode from 'vscode';

// ── Schema (mirrors latex_forge/profile.py) ─────────────────────────────────

interface ProfileField {
    key: string;
    label: string;
    section: string;
    type?: 'email' | 'tel' | 'url' | 'text';
}

const PROFILE_SCHEMA: ProfileField[] = [
    { key: 'first_name',  label: 'First name',           section: 'identity' },
    { key: 'last_name',   label: 'Last name',            section: 'identity' },
    { key: 'email',       label: 'Email',                section: 'identity', type: 'email' },
    { key: 'phone',       label: 'Phone',                section: 'identity', type: 'tel' },
    { key: 'website',     label: 'Website',              section: 'identity', type: 'url' },
    { key: 'github',      label: 'GitHub username',      section: 'online' },
    { key: 'linkedin',    label: 'LinkedIn username',    section: 'online' },
    { key: 'university',  label: 'University',           section: 'academic' },
    { key: 'faculty',     label: 'Faculty / UFR',        section: 'academic' },
    { key: 'program',     label: 'Program / Formation',  section: 'academic' },
    { key: 'supervisor',  label: 'Supervisor',           section: 'academic' },
    { key: 'company',     label: 'Company',              section: 'professional' },
    { key: 'department',  label: 'Department / Service', section: 'professional' },
    { key: 'job_title',   label: 'Job title',            section: 'professional' },
];

const SECTION_HEADERS: Record<string, string> = {
    identity:     'Identity',
    online:       'Online profiles',
    academic:     'Academic',
    professional: 'Professional',
};

// ── File helpers ────────────────────────────────────────────────────────────

const PROFILE_PATH = path.join(os.homedir(), '.latex-forge', 'profile.toml');

function loadProfile(): Record<string, string> {
    try {
        const content = fs.readFileSync(PROFILE_PATH, 'utf8');
        const parsed = TOML.parse(content);
        const result: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
            if (typeof v === 'string') {
                result[k] = v;
            }
        }
        return result;
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            return {};
        }
        throw err;
    }
}

function saveProfile(values: Record<string, string>): void {
    const dir = path.dirname(PROFILE_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const lines: string[] = [];
    let currentSection: string | null = null;

    for (const { key, section } of PROFILE_SCHEMA) {
        if (section !== currentSection) {
            if (lines.length > 0) {
                lines.push('');
            }
            const header = SECTION_HEADERS[section];
            lines.push(`# ── ${header} ${'─'.repeat(55 - header.length)}`);
            currentSection = section;
        }
        const value = values[key] ?? '';
        lines.push(`${key} = "${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
    }

    fs.writeFileSync(PROFILE_PATH, lines.join('\n') + '\n', 'utf8');
}

function clearProfile(): void {
    try {
        fs.unlinkSync(PROFILE_PATH);
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw err;
        }
    }
}

// ── Nonce helper ────────────────────────────────────────────────────────────

function getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── Webview HTML ─────────────────────────────────────────────────────────────

function buildFormRows(fields: ProfileField[]): string {
    return fields.map(({ key, label, type }) => `
        <div class="field">
            <label for="${key}">${label}</label>
            <input id="${key}" name="${key}" type="${type ?? 'text'}"
                   autocomplete="off" spellcheck="false" />
        </div>`).join('');
}

function buildSections(): string {
    const sections = [...new Set(PROFILE_SCHEMA.map((f) => f.section))];
    return sections.map((section) => {
        const fields = PROFILE_SCHEMA.filter((f) => f.section === section);
        return `
        <section>
            <h2>${SECTION_HEADERS[section]}</h2>
            ${buildFormRows(fields)}
        </section>`;
    }).join('');
}

function renderHtml(nonce: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Edit Profile</title>
    <style nonce="${nonce}">
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            padding: 24px 28px 40px;
            max-width: 680px;
        }

        h1 {
            font-size: 1.25em;
            font-weight: 600;
            color: var(--vscode-foreground);
            margin-bottom: 6px;
        }
        .subtitle {
            font-size: 0.85em;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 28px;
        }

        section {
            margin-bottom: 28px;
        }
        h2 {
            font-size: 0.78em;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--vscode-descriptionForeground);
            border-bottom: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.1));
            padding-bottom: 6px;
            margin-bottom: 14px;
        }

        .field {
            display: grid;
            grid-template-columns: 180px 1fr;
            align-items: center;
            gap: 8px 16px;
            margin-bottom: 10px;
        }
        label {
            font-size: 0.9em;
            color: var(--vscode-foreground);
            white-space: nowrap;
        }
        input {
            width: 100%;
            padding: 5px 8px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border, transparent);
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            outline: none;
        }
        input:focus {
            border-color: var(--vscode-focusBorder);
        }
        input::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }

        .actions {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-top: 8px;
            flex-wrap: wrap;
        }
        button {
            padding: 6px 18px;
            border: none;
            border-radius: 2px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            cursor: pointer;
        }
        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn-primary:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        #status {
            font-size: 0.85em;
            padding: 4px 10px;
            border-radius: 2px;
            display: none;
        }
        #status.success {
            display: inline-block;
            color: var(--vscode-testing-iconPassed, #3fb950);
            background: transparent;
        }
        #status.error {
            display: inline-block;
            color: var(--vscode-errorForeground);
            background: transparent;
        }
    </style>
</head>
<body>
    <h1>Edit Profile</h1>
    <p class="subtitle">Saved values are automatically applied when you create a new project.</p>

    <form id="profile-form">
        ${buildSections()}
        <div class="actions">
            <button type="submit" class="btn-primary">Save Profile</button>
            <button type="button" id="btn-clear" class="btn-secondary">Clear Profile</button>
            <span id="status"></span>
        </div>
    </form>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const form   = document.getElementById('profile-form');
        const status = document.getElementById('status');
        const fields = ${JSON.stringify(PROFILE_SCHEMA.map((f) => f.key))};

        function setStatus(msg, type) {
            status.textContent = msg;
            status.className = type;
            clearTimeout(status._timer);
            status._timer = setTimeout(() => { status.className = ''; status.textContent = ''; }, 3000);
        }

        // Populate form with values sent from extension
        window.addEventListener('message', (event) => {
            const msg = event.data;
            if (msg.type === 'loaded') {
                for (const key of fields) {
                    const el = document.getElementById(key);
                    if (el) { el.value = msg.values[key] ?? ''; }
                }
            } else if (msg.type === 'saved') {
                setStatus('✓ Profile saved', 'success');
            } else if (msg.type === 'cleared') {
                for (const key of fields) {
                    const el = document.getElementById(key);
                    if (el) { el.value = ''; }
                }
                setStatus('✓ Profile cleared', 'success');
            } else if (msg.type === 'error') {
                setStatus('✗ ' + msg.message, 'error');
            }
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const values = {};
            for (const key of fields) {
                const el = document.getElementById(key);
                values[key] = el ? el.value.trim() : '';
            }
            vscode.postMessage({ type: 'save', values });
        });

        document.getElementById('btn-clear').addEventListener('click', () => {
            vscode.postMessage({ type: 'clear' });
        });
    </script>
</body>
</html>`;
}

// ── Command ─────────────────────────────────────────────────────────────────

let panel: vscode.WebviewPanel | undefined;

export function editProfileCommand(): void {
    // Reuse panel if already open
    if (panel) {
        panel.reveal(vscode.ViewColumn.One);
        return;
    }

    panel = vscode.window.createWebviewPanel(
        'latexForgeProfile',
        'LaTeX Forge — Edit Profile',
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    const nonce = getNonce();
    panel.webview.html = renderHtml(nonce);

    // Send current profile values once the webview is ready
    const sendProfile = () => {
        try {
            const values = loadProfile();
            void panel!.webview.postMessage({ type: 'loaded', values });
        } catch (err) {
            void panel!.webview.postMessage({ type: 'error', message: String(err) });
        }
    };

    // Give the webview a moment to initialise before sending data
    setTimeout(sendProfile, 200);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage((msg: { type: string; values?: Record<string, string> }) => {
        if (msg.type === 'save') {
            try {
                saveProfile(msg.values ?? {});
                void panel!.webview.postMessage({ type: 'saved' });
            } catch (err) {
                void panel!.webview.postMessage({ type: 'error', message: String(err) });
            }
        } else if (msg.type === 'clear') {
            try {
                clearProfile();
                void panel!.webview.postMessage({ type: 'cleared' });
            } catch (err) {
                void panel!.webview.postMessage({ type: 'error', message: String(err) });
            }
        }
    });

    panel.onDidDispose(() => {
        panel = undefined;
    });
}
