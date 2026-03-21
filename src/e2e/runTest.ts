import * as path from 'node:path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, './index.js');

    // Use the project root as workspace so SessionManager can write .vscode/
    const workspacePath = extensionDevelopmentPath;

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        workspacePath,
        '--disable-extensions',
        '--disable-gpu',
      ],
    });
  } catch (err) {
    console.error('E2E tests failed:', err);
    process.exit(1);
  }
}

main();
