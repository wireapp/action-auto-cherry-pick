import { gitExec } from './git'

export async function getListOfChangedFilePaths(
    targetBranch: string,
    hasSubmodule: boolean,
    submoduleName: string
) {
    const diffResult = (
        await gitExec(['diff', `origin/${targetBranch}`, '--name-only'])
    ).stdout
    let changedFilePaths = diffResult.split('\n')
    if (diffResult === '') {
        return []
    }
    if (hasSubmodule) {
        // Ignore all changes in the submodule
        return changedFilePaths.filter(
            path => !path.startsWith(submoduleName + '/')
        )
    }
    return changedFilePaths
}
