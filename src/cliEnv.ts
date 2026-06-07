import * as os from 'os';
import * as path from 'path';

/**
 * Directories where pipx (the documented installation method for the
 * latex-forge CLI, see the README) places executables by default.
 *
 * VS Code's extension host does not always see these: when the editor is
 * launched from Finder, the Dock, or Spotlight (rather than from a terminal),
 * it initially inherits a minimal PATH from the OS. VS Code tries to resolve
 * the user's real shell PATH at startup, but that resolution can time out
 * with heavier shell configurations (pyenv, nvm, etc.), silently leaving
 * `~/.local/bin` out of the PATH the extension host sees — even though
 * `latex-forge` is correctly installed and perfectly reachable from any
 * terminal.
 *
 * Appending these directories when looking up and running the CLI does not
 * duplicate any of its logic: it only ensures the wrapper can find the binary
 * it is supposed to wrap.
 */
function getSupplementalBinDirectories(): string[] {
    return [path.join(os.homedir(), '.local', 'bin')];
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
