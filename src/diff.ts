import { gitExec } from './git'

export async function getListOfChangedFilePaths(
    targetBranch: string
): Promise<string[]> {
    // Ignores all changes in submodules
    await gitExec(['config', '--global', 'diff.ignoreSubmodules', 'dirty'])
    const diffResult = (
        await gitExec(['diff', `origin/${targetBranch}`, '--name-only'])
    ).stdout
    // Revert back the git config so this function doesn't leave a trace behind
    await gitExec(['config', '--global', '--unset', 'diff.ignoreSubmodules'])
    const changedFilePaths = diffResult.split('\n')
    if (diffResult === '') {
        return []
    }
    return changedFilePaths
}
