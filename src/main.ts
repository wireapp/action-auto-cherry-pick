import * as core from '@actions/core'
import * as github from '@actions/github'
import { PullRequest } from '@octokit/webhooks-types'
import { createPullRequest } from './pr'
import {
    cherryPickChangesToNewBranch,
    configureGitUser,
    fastForwardSubmodule,
    gitExec
} from './git'
import { getListOfChangedFilePaths } from './diff'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
    try {
        const payload = JSON.stringify(github.context.payload, undefined, 2)
        console.debug(`Event Payload: ${payload}`)

        if (github.context.payload.pull_request == null) {
            core.setFailed(
                'Action not running in a merged-pr event! Make sure to run only on PR events'
            )
            return
        }
        const mergedPR = github.context.payload.pull_request as PullRequest

        if (mergedPR.merged != true) {
            core.setFailed(
                `Can't merge PR '${mergedPR.number}', as it was not merged.`
            )
            return
        }
        const targetBranch = core.getInput('target-branch')
        const githubToken = core.getInput('pr-creator-token')
        const submoduleName = core.getInput('submodule-name')
        let prAssignee = core.getInput('pr-assignee')
        if (prAssignee === '') {
            // Use the author of the original PR as the assignee of the cherry-pick
            prAssignee = mergedPR.user.login
        }
        let labelsInput = core.getInput('pr-labels')
        let prLabels: string[] = []
        if (labelsInput !== '') {
            prLabels = labelsInput.split(',')
        }

        // GH Actions bot email address
        // https://github.com/orgs/community/discussions/26560#discussioncomment-3252339
        const commitAuthorName = 'GitHub Actions'
        const commitAuthorEmail =
            '41898282+github-actions[bot]@users.noreply.github.com'

        const hasSubmodule = submoduleName !== ''
        const newBranchSuffix = '-cherry-pick'

        const originalBranch = mergedPR.head.ref
        const newBranchName = originalBranch + newBranchSuffix

        let changedFilePaths = await getListOfChangedFilePaths(
            targetBranch,
            hasSubmodule,
            submoduleName
        )

        await configureGitUser(commitAuthorName, commitAuthorEmail)

        if (changedFilePaths.length === 0) {
            // no changes
            console.log(
                `Skipping cherry-pick. No changes between current branch and target branch: ${targetBranch}}`
            )
            return
        }
        const tempBranchName = 'temp-branch-for-cherry-pick'
        if (hasSubmodule) {
            await fastForwardSubmodule(
                tempBranchName,
                submoduleName,
                targetBranch,
                mergedPR
            )
        }
        await cherryPickChangesToNewBranch(
            mergedPR,
            targetBranch,
            newBranchName,
            hasSubmodule,
            submoduleName
        )

        if (hasSubmodule) {
            // Delete submodule update temporary branch
            await gitExec(['branch', '-D', tempBranchName])
        }
        const resultPr = await createPullRequest(
            githubToken,
            mergedPR,
            newBranchName,
            targetBranch
        )
        core.setOutput('pr-number', resultPr.data.number)
    } catch (error) {
        // Fail the workflow run if an error occurs
        if (error instanceof Error) core.setFailed(error.message)
    }
}
