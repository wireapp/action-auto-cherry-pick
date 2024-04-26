import { PullRequest } from '@octokit/webhooks-types'
import * as github from '@actions/github'

export async function createPullRequest(
    githubToken: string,
    mergedPR: PullRequest,
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
    const prTitle = `${mergedPR.title} [Cherry-Pick]`
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
