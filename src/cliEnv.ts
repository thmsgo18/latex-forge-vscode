import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Directories where the tools the extension relies on live, even when they
 * aren't on the PATH VS Code was started with.
 *
 * VS Code's extension host does not always see the user's real PATH: when
 * the editor is launched from Finder, the Dock, or Spotlight (rather than
 * from a terminal), it initially inherits a minimal PATH from the OS. VS
 * Code tries to resolve the user's shell PATH at startup, but that can time
 * out with heavier shell configurations (pyenv, nvm, etc.). And a tool
 * installed a minute ago (the CLI via uv, LaTeX via the setup wizard) is
 * never on the PATH of an editor that was already running.
 *
 * Appending these directories when looking up and running external binaries
 * does not duplicate any business logic: it only ensures the wrapper can
 * find the tools it is supposed to call.
 */

let privateBinDir: string | undefined;

/** Directory holding the extension's own copy of uv (set at activation). */
export function setPrivateBinDir(dir: string): void {
    privateBinDir = dir;
}

/** Per-user executable directory: where uv and pipx install `latex-forge`. */
export function userBinDir(): string {
    return path.join(os.homedir(), '.local', 'bin');
}

function isDirectory(dir: string): boolean {
    try {
        return fs.statSync(dir).isDirectory();
    } catch {
        return false;
    }
}

function subdirectories(dir: string): string[] {
    try {
        return fs.readdirSync(dir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => path.join(dir, entry.name));
    } catch {
        return [];
    }
}

/** Mirrors latex_forge/toolchain.py: where TinyTeX lives (TINYTEX_DIR overrides the parent). */
export function tinytexRoot(platform: string = process.platform, env: NodeJS.ProcessEnv = process.env): string {
    let parent = env.TINYTEX_DIR;
    if (!parent) {
        if (platform === 'darwin') {
            parent = path.join(os.homedir(), 'Library');
        } else if (platform === 'win32') {
            const appdata = env.APPDATA ?? '';
            // TeX Live can't live under a path with spaces or non-ASCII characters.
            parent = /^[!-~]+$/.test(appdata) ? appdata : (env.ProgramData ?? 'C:\\ProgramData');
        } else {
            parent = os.homedir();
        }
    }
    const name = platform === 'darwin' || platform === 'win32' ? 'TinyTeX' : '.TinyTeX';
    return path.join(parent, name);
}

/**
 * Existing TeX binary directories: the TinyTeX installed by `latex-forge
 * setup`, then the usual MacTeX / TeX Live / MiKTeX locations — or, like
 * the CLI, the directories listed in LATEX_FORGE_TEX_DIRS instead of those.
 */
export function texBinDirectories(): string[] {
    const candidates: string[] = [];
    candidates.push(...subdirectories(path.join(tinytexRoot(), 'bin')));

    const override = process.env.LATEX_FORGE_TEX_DIRS;
    if (override !== undefined) {
        candidates.push(...override.split(path.delimiter).filter(Boolean));
        return candidates.filter(isDirectory);
    }

    if (process.platform === 'darwin') {
        candidates.push('/Library/TeX/texbin');
    }
    if (process.platform === 'darwin' || process.platform === 'linux') {
        const years = subdirectories('/usr/local/texlive')
            .filter((dir) => /^\d{4}$/.test(path.basename(dir)))
            .sort()
            .reverse();
        for (const year of years) {
            candidates.push(...subdirectories(path.join(year, 'bin')));
        }
    }
    if (process.platform === 'win32') {
        const years = subdirectories('C:\\texlive')
            .filter((dir) => /^\d{4}$/.test(path.basename(dir)))
            .sort()
            .reverse();
        for (const year of years) {
            candidates.push(...subdirectories(path.join(year, 'bin')));
        }
        for (const base of [process.env.LOCALAPPDATA, process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)']]) {
            if (base) {
                candidates.push(path.join(base, 'Programs', 'MiKTeX', 'miktex', 'bin', 'x64'));
                candidates.push(path.join(base, 'MiKTeX', 'miktex', 'bin', 'x64'));
            }
        }
        // MiKTeX's latexmk is a Perl script.
        candidates.push('C:\\Strawberry\\perl\\bin');
    }
    return candidates.filter(isDirectory);
}

function getSupplementalBinDirectories(): string[] {
    const dirs = [
        userBinDir(),         // uv / pipx on every OS
        '/opt/homebrew/bin',  // Homebrew on Apple Silicon
        '/usr/local/bin',     // Homebrew on Intel Macs; common on Linux
        ...texBinDirectories(),
    ];
    if (privateBinDir) {
        dirs.push(privateBinDir);
    }
    return dirs;
}

/** Appends `extra` to a PATH string, skipping entries already present. */
export function mergePath(current: string | undefined, extra: string[], delimiter: string = path.delimiter): string {
    const entries = (current ?? '').split(delimiter).filter(Boolean);
    const normalise = (p: string) => (process.platform === 'win32' ? p.toLowerCase() : p);
    const seen = new Set(entries.map(normalise));
    for (const dir of extra) {
        if (!seen.has(normalise(dir))) {
            entries.push(dir);
            seen.add(normalise(dir));
        }
    }
    return entries.join(delimiter);
}

/**
 * Returns a copy of the current process environment with well-known
 * user-level bin directories appended to PATH (if not already present).
 * Use this as the `env` for any `child_process` call that looks up or runs
 * the `latex-forge` binary.
 */
export function getCliEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env, PATH: mergePath(process.env.PATH, getSupplementalBinDirectories()) };
    // Windows environment variables are case-insensitive but Node copies keep
    // whatever casing they had ("Path"); keep a single entry.
    if (process.platform === 'win32' && env.Path !== undefined) {
        env.PATH = mergePath(env.Path, getSupplementalBinDirectories());
        delete env.Path;
    }
    return env;
}

/**
 * Makes freshly installed tools usable right away, without restarting VS Code:
 *
 * - appended to this extension host's own PATH, which every extension shares —
 *   that is what lets LaTeX Workshop find latexmk in a TinyTeX installed a
 *   minute ago;
 * - appended to the PATH of new integrated terminals.
 *
 * Only appends (never prepends) existing directories, so a tool the user
 * already has on PATH keeps precedence.
 */
export function applyToolPaths(collection?: { append(variable: string, value: string): void; description?: unknown }): string[] {
    const dirs = [userBinDir(), ...texBinDirectories()].filter(isDirectory);
    // process.env is case-insensitive on Windows, so PATH also reaches "Path".
    const before = process.env.PATH;
    process.env.PATH = mergePath(before, dirs);
    const added = dirs.filter((dir) => !(before ?? '').split(path.delimiter).includes(dir));

    if (collection && dirs.length > 0) {
        collection.append('PATH', path.delimiter + dirs.join(path.delimiter));
    }
    return added;
}
