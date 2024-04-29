import { PullRequest } from '@octokit/webhooks-types'
import * as github from '@actions/github'

export async function createPullRequest(
    githubToken: string,
    mergedPR: PullRequest,
    prTitle: string,
    newBranchName: string,
    targetBranch: string
): Promise<number> {
    const octokit = github.getOctokit(githubToken)
    const repoOwner = github.context.repo.owner
    const repoName = github.context.repo.repo
    let originalPrBodyMessage = ''
    if (mergedPR.body != null && mergedPR.body.trim() !== '') {
        originalPrBodyMessage = `Original PR description:\n
            \n
            -----\n
            ${mergedPR.body}
        `
    } else {
        originalPrBodyMessage = ''
    }
    const prBody = `This PR was automatically cherry-picked based on the following PR:\n
             - #${mergedPR.number}\n
            ${originalPrBodyMessage}
            `
    const resultPr = await octokit.rest.pulls.create({
        owner: repoOwner,
        repo: repoName,
        title: prTitle,
        head: newBranchName,
        base: targetBranch,
        body: prBody
    })
    return resultPr.data.number
}

export async function addLabels(
    githubToken: string,
    issueNumber: number,
    labelsToAdd: string[]
): Promise<void> {
    if (labelsToAdd.length === 0) {
        console.info('Skipping addition of labels, as none are needed')
        return
    }
    const octokit = github.getOctokit(githubToken)
    const repoOwner = github.context.repo.owner
    const repoName = github.context.repo.repo
    await octokit.rest.issues.addLabels({
        owner: repoOwner,
        repo: repoName,
        issue_number: issueNumber,
        labels: labelsToAdd
    })
}

export async function addAssignee(
    githubToken: string,
    issueNumber: number,
    assigneeUserName: string
): Promise<void> {
    if (assigneeUserName.length === 0) {
        console.info('Skipping addition of assignee, as passed value is empty')
        return
    }
    const octokit = github.getOctokit(githubToken)
    const repoOwner = github.context.repo.owner
    const repoName = github.context.repo.repo
    await octokit.rest.issues.addAssignees({
        owner: repoOwner,
        repo: repoName,
        issue_number: issueNumber,
        assignees: [assigneeUserName]
    })
}
