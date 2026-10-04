import { execLatexForge } from './cliRunner';

/** One check from `latex-forge diagnose --json`. */
export interface DiagItem {
    ok: boolean;
    version?: string | null;
    engines?: string[];
    fix?: string;
    path?: string;
    value?: string | null;
    authenticated?: boolean;
}

/** Only reported by CLI versions that know about managed TeX installs. */
export interface TexDistribution {
    ok: boolean;
    kind: 'tinytex' | 'texlive' | 'miktex' | 'distro' | 'unknown' | 'none';
    label: string;
    bin_dir: string | null;
    managed: boolean;
    can_install_packages: boolean;
}

/** Only reported by CLI versions that know how they were installed. */
export interface CliInstall {
    ok: boolean;
    method: 'uv' | 'pipx' | 'editable' | 'venv' | 'pip';
    python: string;
}

export interface DiagnoseResult {
    latex_forge: DiagItem;
    cli_install?: CliInstall;
    pipx: DiagItem;
    tex_distribution?: TexDistribution;
    texlive: DiagItem;
    latexmk: DiagItem;
    /** Optional: only reported by CLI versions that check biber. */
    biber?: DiagItem;
    gh_cli?: DiagItem;
    profile: DiagItem;
    default_template: DiagItem;
}

export interface EnvironmentStatus {
    /** The `latex-forge` command runs. */
    cliAvailable: boolean;
    /** A TeX distribution with latexmk is usable (latex-forge can compile). */
    texReady: boolean;
    diagnose?: DiagnoseResult;
}

/** Parses `latex-forge diagnose --json` output; undefined when it isn't JSON. */
export function parseDiagnose(stdout: string): DiagnoseResult | undefined {
    try {
        const data = JSON.parse(stdout) as DiagnoseResult;
        return typeof data === 'object' && data !== null && 'texlive' in data ? data : undefined;
    } catch {
        return undefined;
    }
}

/** Whether `diagnose` data says LaTeX can compile (same rule as the CLI's exit code). */
export function isTexReady(data: DiagnoseResult | undefined): boolean {
    return !!data && data.texlive.ok && data.latexmk.ok;
}

/**
 * Asks the CLI what the machine looks like. Never throws: a missing CLI is
 * reported as `cliAvailable: false`.
 */
export async function getEnvironmentStatus(): Promise<EnvironmentStatus> {
    const result = await execLatexForge(['diagnose', '--json']);
    const diagnose = parseDiagnose(result.stdout);
    if (!diagnose) {
        // Not runnable at all (exit -1 / ENOENT) or an unexpected output.
        return { cliAvailable: result.exitCode === 0 || result.exitCode === 1, texReady: false };
    }
    return { cliAvailable: true, texReady: isTexReady(diagnose), diagnose };
}
