import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as TOML from '@iarna/toml';

export type SharingMode = 'full' | 'pdf-only';
export type RepoMode = 'create' | 'existing' | 'none';
export type Visibility = 'private' | 'public';

export const SHARING_MODES: SharingMode[] = ['full', 'pdf-only'];
export const REPO_MODES: RepoMode[] = ['create', 'existing', 'none'];
export const VISIBILITIES: Visibility[] = ['private', 'public'];

export interface LatexForgeConfig {
    defaultTemplate?: string;
    defaultOutputDir?: string;
    defaultSharing?: SharingMode;
    buildBeforeCommit?: boolean;
    defaultRepoMode?: RepoMode;
    defaultVisibility?: Visibility;
}

const CONFIG_PATH = path.join(os.homedir(), '.latex-forge.toml');

async function readRawConfig(): Promise<TOML.JsonMap> {
    try {
        const contents = await fs.readFile(CONFIG_PATH, 'utf8');
        return TOML.parse(contents);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return {};
        }
        throw error;
    }
}

/**
 * Reads the `default_template`, `default_output_dir`, `default_sharing`,
 * `build_before_commit`, `default_repo_mode`, and `default_visibility` keys
 * from `~/.latex-forge.toml`.
 */
export async function readConfig(): Promise<LatexForgeConfig> {
    const raw = await readRawConfig();
    const config: LatexForgeConfig = {};

    if (typeof raw.default_template === 'string' && raw.default_template) {
        config.defaultTemplate = raw.default_template;
    }
    if (typeof raw.default_output_dir === 'string' && raw.default_output_dir) {
        config.defaultOutputDir = raw.default_output_dir;
    }
    if (typeof raw.default_sharing === 'string' && SHARING_MODES.includes(raw.default_sharing as SharingMode)) {
        config.defaultSharing = raw.default_sharing as SharingMode;
    }
    if (typeof raw.build_before_commit === 'boolean') {
        config.buildBeforeCommit = raw.build_before_commit;
    }
    if (typeof raw.default_repo_mode === 'string' && REPO_MODES.includes(raw.default_repo_mode as RepoMode)) {
        config.defaultRepoMode = raw.default_repo_mode as RepoMode;
    }
    if (typeof raw.default_visibility === 'string' && VISIBILITIES.includes(raw.default_visibility as Visibility)) {
        config.defaultVisibility = raw.default_visibility as Visibility;
    }

    return config;
}

/**
 * Writes `default_template`, `default_output_dir`, `default_sharing`,
 * `build_before_commit`, `default_repo_mode`, and `default_visibility` back
 * to `~/.latex-forge.toml`, preserving any other keys already present in the
 * file. A key is removed from the file when its value is `undefined`.
 */
export async function writeConfig(config: LatexForgeConfig): Promise<void> {
    const raw = await readRawConfig();

    if (config.defaultTemplate) {
        raw.default_template = config.defaultTemplate;
    } else {
        delete raw.default_template;
    }

    if (config.defaultOutputDir) {
        raw.default_output_dir = config.defaultOutputDir;
    } else {
        delete raw.default_output_dir;
    }

    if (config.defaultSharing) {
        raw.default_sharing = config.defaultSharing;
    } else {
        delete raw.default_sharing;
    }

    if (config.buildBeforeCommit !== undefined) {
        raw.build_before_commit = config.buildBeforeCommit;
    } else {
        delete raw.build_before_commit;
    }

    if (config.defaultRepoMode) {
        raw.default_repo_mode = config.defaultRepoMode;
    } else {
        delete raw.default_repo_mode;
    }

    if (config.defaultVisibility) {
        raw.default_visibility = config.defaultVisibility;
    } else {
        delete raw.default_visibility;
    }

    await fs.writeFile(CONFIG_PATH, TOML.stringify(raw), 'utf8');
}
