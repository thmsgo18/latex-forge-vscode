import * as os from 'os';
import * as path from 'path';

/**
 * Directories where common package managers (pipx, Homebrew) install
 * executables by default.
 *
 * VS Code's extension host does not always see these: when the editor is
 * launched from Finder, the Dock, or Spotlight (rather than from a terminal),
 * it initially inherits a minimal PATH from the OS. VS Code tries to resolve
 * the user's real shell PATH at startup, but that resolution can time out
 * with heavier shell configurations (pyenv, nvm, etc.), silently leaving
 * `~/.local/bin` (pipx on Linux/macOS) or Homebrew's prefix out of the PATH
 * the extension host sees — even though the binaries are correctly installed
 * and reachable from any terminal.
 *
 * Appending these directories when looking up and running external binaries
 * does not duplicate any business logic: it only ensures the wrapper can
 * find the tools it is supposed to call.
 */
function getSupplementalBinDirectories(): string[] {
    return [
        path.join(os.homedir(), '.local', 'bin'), // pipx default on macOS/Linux
        '/opt/homebrew/bin',                       // Homebrew on Apple Silicon
        '/usr/local/bin',                          // Homebrew on Intel Macs; common on Linux
    ];
}

/**
 * Returns a copy of the current process environment with well-known
 * user-level bin directories appended to PATH (if not already present).
 * Use this as the `env` for any `child_process` call that looks up or runs
 * the `latex-forge` binary.
 */
export function getCliEnv(): NodeJS.ProcessEnv {
    const delimiter = path.delimiter;
    const entries = (process.env.PATH ?? '').split(delimiter).filter(Boolean);

    for (const dir of getSupplementalBinDirectories()) {
        if (!entries.includes(dir)) {
            entries.push(dir);
        }
    }

    return { ...process.env, PATH: entries.join(delimiter) };
}
