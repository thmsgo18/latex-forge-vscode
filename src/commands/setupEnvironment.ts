import * as vscode from 'vscode';
import { ensureCliAvailable } from '../cliDetection';
import { runGhInstallInTerminal } from '../githubDetection';
import { runLatexForge } from '../cliRunner';
import { installRecommendedExtensions, pickTexDistribution, SetupWizard } from '../setupWizard';

type SetupAction = 'everything' | 'choose-tex' | 'check' | 'extensions' | 'gh' | 'reinstall-tex';

interface SetupItem extends vscode.QuickPickItem {
    action: SetupAction;
}

const SETUP_ITEMS: SetupItem[] = [
    {
        action: 'everything',
        label: '$(rocket) Install everything',
        description: 'recommended',
        detail: 'The LaTeX Forge CLI, LaTeX itself (if missing) and the recommended VS Code extensions, then a test compile.'
    },
    {
        action: 'choose-tex',
        label: '$(package) Install LaTeX — choose the distribution',
        detail: 'Light (TinyTeX, ~500 MB), Full (all of TeX Live, ~2 GB) or System (MacTeX / MiKTeX / TeX Live, admin password).'
    },
    {
        action: 'check',
        label: '$(checklist) Check only',
        description: '--check-only',
        detail: 'Only check the current environment without installing anything.'
    },
    {
        action: 'extensions',
        label: '$(extensions) Install the recommended VS Code extensions',
        detail: 'LaTeX Workshop, LTeX+ grammar checking, spell checkers (English and French), Live Share.'
    },
    {
        action: 'gh',
        label: '$(github) Install the GitHub CLI',
        description: '--install-gh',
        detail: 'Needed to create a new GitHub repository from "Create Project". Runs in a terminal (it may ask for your password).'
    },
    {
        action: 'reinstall-tex',
        label: '$(debug-restart) Repair LaTeX (reinstall TinyTeX)',
        description: '--reinstall-tex',
        detail: 'Reinstalls the TinyTeX managed by LaTeX Forge, keeping its packages — e.g. after a new TeX Live year.'
    }
];

export async function setupEnvironmentCommand(
    outputChannel: vscode.OutputChannel,
    wizard: SetupWizard
): Promise<void> {
    const picked = await vscode.window.showQuickPick(SETUP_ITEMS, {
        title: 'LaTeX Forge: Setup Environment',
        placeHolder: 'What should be set up?'
    });
    if (!picked) {
        return;
    }

    switch (picked.action) {
        case 'everything':
            await wizard.run({ installExtensions: true });
            return;
        case 'choose-tex': {
            const tex = await pickTexDistribution();
            if (tex) {
                await wizard.run({ tex });
            }
            return;
        }
        case 'reinstall-tex':
            await wizard.run({ reinstallTex: true });
            return;
        case 'extensions':
            await installRecommendedExtensions(outputChannel);
            return;
        case 'gh':
            runGhInstallInTerminal();
            return;
        case 'check': {
            if (!(await ensureCliAvailable())) {
                return;
            }
            outputChannel.show(true);
            const result = await runLatexForge(['setup', '--check-only'], { outputChannel });
            if (result.exitCode === 0) {
                await vscode.window.showInformationMessage('LaTeX Forge: everything needed to compile is installed.');
            } else {
                const choice = await vscode.window.showWarningMessage(
                    'LaTeX Forge: the environment is incomplete. See the "LaTeX Forge" output channel.',
                    'Install Everything'
                );
                if (choice === 'Install Everything') {
                    await wizard.run({ installExtensions: true });
                }
            }
            return;
        }
    }
}
