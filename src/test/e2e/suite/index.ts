import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
    // Installing the CLI and TinyTeX from the internet takes minutes.
    const mocha = new Mocha({ ui: 'tdd', color: true, timeout: 25 * 60 * 1000 });
    const files = await glob('**/*.e2e.js', { cwd: __dirname });
    files.forEach((file) => mocha.addFile(path.resolve(__dirname, file)));

    return new Promise((resolve, reject) => {
        mocha.run((failures) => (failures > 0 ? reject(new Error(`${failures} tests failed.`)) : resolve()));
    });
}
