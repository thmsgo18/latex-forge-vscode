import * as assert from 'assert';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { mergePath, tinytexRoot } from '../../cliEnv';
import { upgradeCommandFor } from '../../cliUpdater';
import { escapeHtml } from '../../commands/diagnose';
import { isTexReady, parseDiagnose } from '../../environment';
import { installCommandForPlatform } from '../../githubDetection';
import { findMissingInLog, isBuildableProject } from '../../missingPackages';
import { ProgressParser, RECOMMENDED_EXTENSIONS } from '../../setupWizard';
import {
    findExecutable,
    installCliArgs,
    sha256File,
    upgradeCliArgs,
    UV_ASSETS,
    UV_VERSION,
    uvAssetFor,
    uvDownloadUrl,
    uvExecutableName
} from '../../uvBootstrap';

function tempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'lf-test-'));
}

suite('uv bootstrap', () => {
    test('has a pinned, checksummed build for every supported platform', () => {
        for (const key of ['darwin-arm64', 'darwin-x64', 'linux-x64', 'linux-arm64', 'win32-x64', 'win32-arm64']) {
            const asset = UV_ASSETS[key];
            assert.ok(asset, key);
            assert.match(asset.sha256, /^[0-9a-f]{64}$/, key);
        }
        assert.strictEqual(uvAssetFor('linux', 'x64')?.file, 'uv-x86_64-unknown-linux-musl.tar.gz');
        assert.strictEqual(uvAssetFor('win32', 'x64')?.file, 'uv-x86_64-pc-windows-msvc.zip');
        assert.strictEqual(uvAssetFor('freebsd', 'x64'), undefined);
    });

    test('download URL points at the pinned GitHub release', () => {
        const asset = uvAssetFor('darwin', 'arm64')!;
        assert.strictEqual(
            uvDownloadUrl(asset),
            `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-aarch64-apple-darwin.tar.gz`
        );
    });

    test('executable name per platform', () => {
        assert.strictEqual(uvExecutableName('win32'), 'uv.exe');
        assert.strictEqual(uvExecutableName('darwin'), 'uv');
    });

    test('installs with a uv-managed Python and replaces stale launchers', () => {
        assert.deepStrictEqual(installCliArgs(), ['tool', 'install', '--managed-python', '--force', 'latex-forge']);
        assert.deepStrictEqual(installCliArgs('/src/latex-forge'), ['tool', 'install', '--managed-python', '--force', '/src/latex-forge']);
        assert.deepStrictEqual(upgradeCliArgs(), ['tool', 'upgrade', 'latex-forge']);
    });

    test('finds the binary inside an extracted archive', () => {
        const dir = tempDir();
        fs.mkdirSync(path.join(dir, 'uv-aarch64-apple-darwin'));
        fs.writeFileSync(path.join(dir, 'uv-aarch64-apple-darwin', 'uvx'), '');
        fs.writeFileSync(path.join(dir, 'uv-aarch64-apple-darwin', 'uv'), '');
        assert.strictEqual(findExecutable(dir, 'uv'), path.join(dir, 'uv-aarch64-apple-darwin', 'uv'));
        assert.strictEqual(findExecutable(dir, 'nope'), undefined);
    });

    test('sha256 of a file', async () => {
        const file = path.join(tempDir(), 'f');
        fs.writeFileSync(file, 'latex-forge');
        const expected = crypto.createHash('sha256').update('latex-forge').digest('hex');
        assert.strictEqual(await sha256File(file), expected);
    });
});

suite('Tool paths', () => {
    test('TinyTeX lives where its own installer puts it', () => {
        const home = os.homedir();
        assert.strictEqual(tinytexRoot('darwin', {}), path.join(home, 'Library', 'TinyTeX'));
        assert.strictEqual(tinytexRoot('linux', {}), path.join(home, '.TinyTeX'));
        assert.strictEqual(tinytexRoot('linux', { TINYTEX_DIR: '/opt' }), path.join('/opt', '.TinyTeX'));
        assert.strictEqual(
            tinytexRoot('win32', { APPDATA: 'C:\\Users\\me\\AppData\\Roaming' }),
            path.join('C:\\Users\\me\\AppData\\Roaming', 'TinyTeX')
        );
        // Spaces/accents break TeX Live: TinyTeX falls back to ProgramData.
        assert.strictEqual(
            tinytexRoot('win32', { APPDATA: 'C:\\Users\\Zoé M\\AppData', ProgramData: 'C:\\ProgramData' }),
            path.join('C:\\ProgramData', 'TinyTeX')
        );
    });

    test('mergePath appends without duplicates', () => {
        assert.strictEqual(mergePath('/a:/b', ['/b', '/c'], ':'), '/a:/b:/c');
        assert.strictEqual(mergePath(undefined, ['/c'], ':'), '/c');
        assert.strictEqual(mergePath('/a', [], ':'), '/a');
    });
});

suite('Setup progress', () => {
    test('turns CLI output into progress messages', () => {
        const messages: string[] = [];
        const parser = new ProgressParser((m) => messages.push(m));
        parser.feed('==> Downloading TinyTeX (light, v2026.10)');
        parser.feed('    downloading 45% (30 of 67 MB)');
        parser.feed('==> Installing the LaTeX packages latex-forge needs');
        parser.feed('    [12/86, 00:03/00:20] install: amsfonts [6436k]');
        parser.feed('some other line');
        assert.deepStrictEqual(messages, [
            'Downloading TinyTeX (light, v2026.10)',
            'Downloading TinyTeX (light, v2026.10) — 45%',
            'Installing the LaTeX packages latex-forge needs',
            'Installing the LaTeX packages latex-forge needs — 12/86'
        ]);
    });

    test('recommends the same extensions as generated projects', () => {
        assert.ok(RECOMMENDED_EXTENSIONS.includes('James-Yu.latex-workshop'));
        assert.strictEqual(new Set(RECOMMENDED_EXTENSIONS).size, RECOMMENDED_EXTENSIONS.length);
    });
});

suite('Missing packages in LaTeX logs', () => {
    test('detects packages, fonts, styles and languages', () => {
        const log = [
            "! LaTeX Error: File `tikz.sty' not found.",
            '! Package fontspec Error: The font "Fira Mono" cannot be found.',
            "Package biblatex Error: Style 'ieee' not found.",
            "! Package babel Error: Unknown option `ngerman'. Either you misspelled it",
            "! LaTeX Error: File `tikz.sty' not found."
        ].join('\n');
        assert.deepStrictEqual(findMissingInLog(log), [
            'tikz.sty', 'babel language "ngerman"', 'biblatex style "ieee"', 'font "Fira Mono"'
        ]);
    });

    test("ignores the user's own missing images and chapters", () => {
        assert.deepStrictEqual(findMissingInLog("! LaTeX Error: File `figures/plot.png' not found."), []);
        assert.deepStrictEqual(findMissingInLog("! LaTeX Error: File `chapter3.tex' not found."), []);
        assert.deepStrictEqual(findMissingInLog('All good.'), []);
    });

    test('only acts on folders latex-forge can build', () => {
        const project = path.join(tempDir(), 'report');
        fs.mkdirSync(project);
        assert.strictEqual(isBuildableProject(project), false);
        fs.writeFileSync(path.join(project, 'report.tex'), '');
        fs.writeFileSync(path.join(project, 'appendix.tex'), '');
        assert.strictEqual(isBuildableProject(project), true);
        const loose = tempDir();
        fs.writeFileSync(path.join(loose, 'a.tex'), '');
        fs.writeFileSync(path.join(loose, 'b.tex'), '');
        assert.strictEqual(isBuildableProject(loose), false);
    });
});

suite('Diagnose data', () => {
    const base = {
        latex_forge: { ok: true, version: '0.8.0' },
        pipx: { ok: false },
        texlive: { ok: true, engines: ['lualatex'] },
        latexmk: { ok: true },
        profile: { ok: false },
        default_template: { ok: false }
    };

    test('parses diagnose --json and tells whether LaTeX can compile', () => {
        const data = parseDiagnose(JSON.stringify(base));
        assert.ok(data);
        assert.strictEqual(isTexReady(data), true);
        assert.strictEqual(isTexReady(parseDiagnose(JSON.stringify({ ...base, latexmk: { ok: false } }))), false);
        assert.strictEqual(parseDiagnose('not json'), undefined);
        assert.strictEqual(parseDiagnose('{"other": 1}'), undefined);
        assert.strictEqual(isTexReady(undefined), false);
    });

    test('upgrades the CLI with the tool that installed it', () => {
        assert.deepStrictEqual(upgradeCommandFor('uv'), { command: 'uv', args: ['tool', 'upgrade', 'latex-forge'] });
        assert.deepStrictEqual(upgradeCommandFor('pipx'), { command: 'pipx', args: ['upgrade', 'latex-forge'] });
        assert.strictEqual(upgradeCommandFor('editable'), undefined);
    });

    test('escapes CLI output before rendering it', () => {
        assert.strictEqual(escapeHtml('<img src=x onerror="a">'), '&lt;img src=x onerror=&quot;a&quot;&gt;');
    });

    test('GitHub CLI install command per platform', () => {
        assert.strictEqual(installCommandForPlatform('darwin'), 'brew install gh');
        assert.strictEqual(installCommandForPlatform('win32'), 'winget install -e --id GitHub.cli');
        assert.match(installCommandForPlatform('linux'), /^sudo apt-get install gh/);
    });
});
