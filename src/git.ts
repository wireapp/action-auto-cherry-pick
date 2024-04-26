import * as io from '@actions/io'
import * as exec from '@actions/exec'
import { PullRequest } from '@octokit/webhooks-types'

/**
 * Asynchronously executes a git command, returning a promise containing its cmd output.
 * Errors and Outputs are logged in the console.
 * The result ExecOutput has its stderr and stdout trimmed for easier consumption
 * @param params
 * @return Promise<CommandResult>
 */
export async function gitExec(params: string[]) {
    const stdout: string[] = []
    const stderr: string[] = []
    const options = {
        listeners: {
            stdout: (data: Buffer) => {
                stdout.push(data.toString())
            },
            stderr: (data: Buffer) => {
                stderr.push(data.toString())
            }
        },
        ignoreReturnCode: true
    }
    const gitPath = await io.which('git')
    const exitCode = await exec.exec(gitPath, params, options)
    let result = new CommandResult()
    result.exitCode = exitCode
    result.stdout = stdout.join('')
    result.stderr = stdout.join('')
    if (result.exitCode !== 0) {
        console.error(
            `Git command error. ExitCode: ${result.exitCode}. Error: ${result.stderr}`
        )
    }
    console.log(
        `Git command exitCode: ${result.exitCode} output: ${result.stdout}`
    )
    result.stdout = result.stdout.trim()
    result.stderr = result.stderr.trim()
    return result
}

export class CommandResult {
    stdout = ''
    stderr = ''
    exitCode = 0
}

export async function fastForwardSubmodule(
    tempBranchName: string,
    submoduleName: string,
    targetBranch: string,
    mergedPR: PullRequest
) {
    await gitExec(['checkout', '-b', tempBranchName])
    await exec.exec('cd', [submoduleName])
    await exec.exec('ls', ['-l'])
    await gitExec(['checkout', targetBranch])
    await gitExec(['pull', 'origin', targetBranch])
    await gitExec([
        'commit',
        '-m',
        `Update submodule ${submoduleName} to latest from ${targetBranch}`
    ])
    const lastCommitMessage = (
        await gitExec([
            'log',
            '--format=%B',
            '-n',
            '1',
            mergedPR.merge_commit_sha!
        ])
    ).stdout
    await exec.exec('cd', ['..'])
    await exec.exec('ls', ['-l'])
    await gitExec(['commit', '-m', lastCommitMessage])
}

export async function configureGitUser(
    commitAuthorName: string,
    commitAuthorEmail: string
) {
    await gitExec(['config', 'user.name', `"${commitAuthorName}"`])
    await gitExec(['config', 'user.email', `"${commitAuthorEmail}"`])
}

export async function cherryPickChangesToNewBranch(
    mergedPR: PullRequest,
    targetBranch: string,
    newBranchName: string,
    hasSubmodule: boolean,
    submoduleName: string
) {
    const originalAuthor = (
        await gitExec([
            'log',
            '-1',
            "--pretty=format:'%an <%ae>'",
            mergedPR.merge_commit_sha!
        ])
    ).stdout

    const cherryPickCommit = (await gitExec(['rev-parse', 'HEAD'])).stdout
    await gitExec(['checkout', targetBranch])
    await gitExec(['checkout', '-b', newBranchName])
    const cherryPickResult = (await gitExec(['cherry-pick', cherryPickCommit]))
        .stdout
    const hasConflicts = cherryPickResult.includes('Merge conflict in')
    if (hasConflicts) {
        await gitExec(['add', '.'])
        let message = 'Commit with unresolved merge conflicts'
        if (hasSubmodule) {
            message = message + ` outside of submodule '${submoduleName}'`
        }
        await gitExec(['commit', '--author', originalAuthor, '-am', message])
    } else {
        await gitExec([
            'commit',
            '--author',
            originalAuthor,
            '--amend',
            '--no-edit'
        ])
    }
    // Push new branch - TODO: Check for failure and abort early
    const result = await gitExec(['push', 'origin', newBranchName])
    if (result.exitCode !== 0) {
        throw new Error(
            `Failure to push changes to ${newBranchName}. Exit code: ${result.exitCode}; Message: ${result.stderr}`
        )
    }
}
