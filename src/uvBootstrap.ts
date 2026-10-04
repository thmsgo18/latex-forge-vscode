import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

/**
 * Installing the LaTeX Forge CLI without asking the user to install Python,
 * pipx or anything else first.
 *
 * uv (https://docs.astral.sh/uv/) is a single self-contained binary that can
 * install Python command-line tools — and download a private Python for them
 * when the machine has none (or only an outdated one). The extension
 * downloads a pinned uv release into its own storage, verifies it against
 * the checksums below, then runs `uv tool install latex-forge`, which puts
 * the `latex-forge` command in ~/.local/bin like pipx would.
 *
 * This module has no dependency on the `vscode` API so it can be unit-tested
 * and exercised from plain Node.
 */

export const UV_VERSION = '0.12.22';

interface UvAsset {
    file: string;
    sha256: string;
}

/** Release assets per `${process.platform}-${process.arch}`, with their SHA-256. */
export const UV_ASSETS: Record<string, UvAsset> = {
    'darwin-arm64': {
        file: 'uv-aarch64-apple-darwin.tar.gz',
        sha256: '5d714de09501a59393ceca78f4bc232a50478729640d251907160299b2a93ddd'
    },
    'darwin-x64': {
        file: 'uv-x86_64-apple-darwin.tar.gz',
        sha256: '1b8a5b316883df2daf20fb9a446e5b230e01d947d57aba2694977c5ac5a7e98c'
    },
    // musl builds are statically linked: they run on any Linux distribution.
    'linux-x64': {
        file: 'uv-x86_64-unknown-linux-musl.tar.gz',
        sha256: 'a50fd68c653b0cfb1c85e0a7db62cb78cf5c22b6f3dcf3ae173e5f222d084470'
    },
    'linux-arm64': {
        file: 'uv-aarch64-unknown-linux-musl.tar.gz',
        sha256: '228bd32c180421a94eef91378a92b2dd63c768bd278430e833250524c4a13382'
    },
    'win32-x64': {
        file: 'uv-x86_64-pc-windows-msvc.zip',
        sha256: 'ea1397797a0ca15f63516dd0f49c2dde9776db9be5861cab152ebe8ad199894d'
    },
    'win32-arm64': {
        file: 'uv-aarch64-pc-windows-msvc.zip',
        sha256: '6a42b919c2bb7135f07b4d1bb8e489f0eaab0bae039020573cc522d831e2d32e'
    }
};

export type Reporter = (line: string) => void;

/** The uv asset for this machine, or undefined if uv has no build for it. */
export function uvAssetFor(platform: string = process.platform, arch: string = process.arch): UvAsset | undefined {
    return UV_ASSETS[`${platform}-${arch}`];
}

export function uvDownloadUrl(asset: UvAsset, version: string = UV_VERSION): string {
    return `https://github.com/astral-sh/uv/releases/download/${version}/${asset.file}`;
}

/** Name of the uv executable on this platform. */
export function uvExecutableName(platform: string = process.platform): string {
    return platform === 'win32' ? 'uv.exe' : 'uv';
}

/** Where the extension keeps its private copy of uv. */
export function privateUvPath(storageDir: string): string {
    return path.join(storageDir, 'bin', uvExecutableName());
}

export async function sha256File(file: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    await pipeline(fs.createReadStream(file), hash);
    return hash.digest('hex');
}

// Give up on a download that can't connect, or that stops receiving data,
// after this long — then retry with curl. Without it a stalled connection
// (seen on some CI networks) would hang the setup forever.
export const DOWNLOAD_STALL_MS = 30_000;

/**
 * Downloads `url` to `dest`, reporting progress every 10%. Uses Node's fetch,
 * falling back to curl (present on macOS, Windows 10+ and most Linux) when
 * fetch fails or stalls — e.g. behind a proxy only the system tools know about.
 */
export async function downloadFile(
    url: string,
    dest: string,
    report?: Reporter,
    stallMs: number = DOWNLOAD_STALL_MS
): Promise<void> {
    try {
        await fetchToFile(url, dest, report, stallMs);
    } catch (error) {
        report?.(`    download stalled or failed (${(error as Error).message}); retrying with curl`);
        const code = await runProcess('curl', [
            '-fsSL', '--retry', '3', '--connect-timeout', '30', '--speed-limit', '1024', '--speed-time', '60',
            '-o', dest, url
        ], {});
        if (code !== 0) {
            throw new Error(`Could not download ${url}: ${(error as Error).message}`);
        }
    }
}

async function fetchToFile(url: string, dest: string, report: Reporter | undefined, stallMs: number): Promise<void> {
    const controller = new AbortController();
    let timer = setTimeout(() => controller.abort(), stallMs);
    const resetTimer = () => {
        clearTimeout(timer);
        timer = setTimeout(() => controller.abort(), stallMs);
    };
    try {
        const response = await fetch(url, { redirect: 'follow', signal: controller.signal });
        if (!response.ok || !response.body) {
            throw new Error(`HTTP ${response.status} for ${url}`);
        }
        const total = Number(response.headers.get('content-length') ?? 0);
        let done = 0;
        let nextReport = 10;
        const source = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
        source.on('data', (chunk: Buffer) => {
            resetTimer();
            done += chunk.length;
            if (report && total > 0) {
                const percent = Math.floor((done * 100) / total);
                if (percent >= nextReport) {
                    report(`    downloading ${percent}% (${(done / 1e6).toFixed(0)} of ${(total / 1e6).toFixed(0)} MB)`);
                    nextReport = percent - (percent % 10) + 10;
                }
            }
        });
        resetTimer();
        await pipeline(source, fs.createWriteStream(dest));
    } catch (error) {
        if (controller.signal.aborted) {
            throw new Error(`no data for ${Math.round(stallMs / 1000)}s`);
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

/** Runs a command, forwarding each output line to `report`. Resolves with the exit code. */
export function runProcess(
    command: string,
    args: string[],
    options: { env?: NodeJS.ProcessEnv; cwd?: string; report?: Reporter }
): Promise<number> {
    return new Promise((resolve) => {
        let child;
        try {
            child = spawn(command, args, { env: options.env ?? process.env, cwd: options.cwd });
        } catch {
            resolve(-1);
            return;
        }
        let buffer = '';
        const onData = (chunk: Buffer) => {
            buffer += chunk.toString();
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() ?? '';
            for (const line of lines) {
                options.report?.(line);
            }
        };
        child.stdout?.on('data', onData);
        child.stderr?.on('data', onData);
        child.on('error', () => resolve(-1));
        child.on('close', (code) => {
            if (buffer) {
                options.report?.(buffer);
            }
            resolve(code ?? -1);
        });
    });
}

/** Finds the uv executable inside an extracted release archive. */
export function findExecutable(dir: string, name: string): string | undefined {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isFile() && entry.name === name) {
            return full;
        }
        if (entry.isDirectory()) {
            const nested = findExecutable(full, name);
            if (nested) {
                return nested;
            }
        }
    }
    return undefined;
}

/**
 * Downloads, verifies and unpacks uv into `<storageDir>/bin`. Returns the
 * path of the uv executable. Throws with a user-readable message on failure.
 */
export async function installUv(storageDir: string, report?: Reporter): Promise<string> {
    const asset = uvAssetFor();
    if (!asset) {
        throw new Error(`uv has no prebuilt binary for ${process.platform}-${process.arch}.`);
    }

    const target = privateUvPath(storageDir);
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'latex-forge-uv-'));
    try {
        const archive = path.join(work, asset.file);
        report?.(`==> Downloading uv ${UV_VERSION} (installs the LaTeX Forge CLI and its Python)`);
        await downloadFile(uvDownloadUrl(asset), archive, report);

        const actual = await sha256File(archive);
        if (actual !== asset.sha256) {
            throw new Error(`Checksum mismatch for ${asset.file} (got ${actual}). Download aborted.`);
        }

        // bsdtar (macOS, Windows 10+) reads .zip and .tar.gz alike; GNU tar
        // detects gzip on its own.
        const extracted = path.join(work, 'x');
        fs.mkdirSync(extracted);
        const code = await runProcess('tar', ['-xf', archive, '-C', extracted], {});
        if (code !== 0) {
            throw new Error(`Could not unpack ${asset.file} (tar exited with ${code}).`);
        }

        const binary = findExecutable(extracted, uvExecutableName());
        if (!binary) {
            throw new Error(`${asset.file} did not contain ${uvExecutableName()}.`);
        }
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(binary, target);
        fs.chmodSync(target, 0o755);
        return target;
    } finally {
        fs.rmSync(work, { recursive: true, force: true });
    }
}

/**
 * `uv tool install` for latex-forge. `--managed-python` uses a Python that uv
 * downloads and owns, so a Homebrew or system Python upgrade can never break
 * the CLI (a classic pipx failure). `--force` replaces a stale `latex-forge`
 * launcher left in ~/.local/bin by a broken earlier install.
 */
export function installCliArgs(spec: string = 'latex-forge'): string[] {
    return ['tool', 'install', '--managed-python', '--force', spec];
}

export function upgradeCliArgs(): string[] {
    return ['tool', 'upgrade', 'latex-forge'];
}

export async function installCli(
    uv: string,
    options: { spec?: string; env?: NodeJS.ProcessEnv; report?: Reporter } = {}
): Promise<number> {
    options.report?.('==> Installing the LaTeX Forge CLI');
    const code = await runProcess(uv, installCliArgs(options.spec), { env: options.env, report: options.report });
    if (code === 0) {
        // Make ~/.local/bin available to the user's own terminals too.
        await runProcess(uv, ['tool', 'update-shell'], { env: options.env, report: options.report });
    }
    return code;
}
