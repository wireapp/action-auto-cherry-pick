import * as core from '@actions/core'
import * as github from '@actions/github'
import { Label, PullRequest } from '@octokit/webhooks-types'
import { addAssignee, addLabels, createPullRequest } from './pr'
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
        // const payload = JSON.stringify(github.context.payload, undefined, 2)
        // console.debug(`Event Payload: ${payload}`)

        if (github.context.payload.pull_request == null) {
            core.setFailed(
                'Action not running in a merged-pr event! Make sure to run only on PR events'
            )
            return
        }
        const mergedPR = github.context.payload.pull_request as PullRequest

        if (mergedPR.merged !== true) {
            core.setFailed(
                `Can't merge PR '${mergedPR.number}', as it was not merged.`
            )
            return
        }
        const targetBranch = core.getInput('target-branch')
        const githubToken = core.getInput('pr-creator-token')
        const submoduleName = core.getInput('submodule-name')
        const prTitleSuffix = core.getInput('pr-title-suffix')
        let prAssignee = core.getInput('pr-assignee')
        if (prAssignee === '' && mergedPR.assignee != null) {
            // Use the assignee of the original PR as the assignee of the cherry-pick
            prAssignee = mergedPR.assignee.login
        }
        const labelsInput = core.getInput('pr-labels')
        let addedLabels: string[] = []
        if (labelsInput !== '') {
            addedLabels = labelsInput.split(',')
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

        const changedFilePaths = await getListOfChangedFilePaths(
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
        const prTitle = `${mergedPR.title} ${prTitleSuffix}`
        const resultPrNumber = await createPullRequest(
            githubToken,
            mergedPR,
            prTitle,
            newBranchName,
            targetBranch
        )

        const inheritedLabels = mergedPR.labels.map(
            (label: Label) => label.name
        )

        await addLabels(
            githubToken,
            resultPrNumber,
            inheritedLabels.concat(addedLabels)
        )

        await addAssignee(githubToken, resultPrNumber, prAssignee)

        core.setOutput('pr-number', resultPrNumber)
    } catch (error) {
        // Fail the workflow run if an error occurs
        if (error instanceof Error) core.setFailed(error.message)
    }
}
