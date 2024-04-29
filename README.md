## Automatic cherry-picking

Cherry-picks commits from a merged PR, creating a new PR to a target branch.
Allows setting a name of a submodule and will automatically fast-forward it to
also match the `target-branch`.

Check [action.yml](action.yml) for a description of inputs and outputs. 

### Configuration sample:

```yaml
name: 'Cherry pick Release/candidate into develop'
on:
    pull_request:
        branches:
            - release/candidate # Branches where the original PRs will be merged
        types:
            - closed

jobs:
    test-cherry-pick:
        runs-on: ubuntu-latest
        name: Test the cherry-pick action
        steps:
            - name: Checkout
              uses: actions/checkout@v4
              with:
                  fetch-depth: 0

            - name: Cherry pick
              id: cherry-pick
              uses: ./
              with:
                  target-branch: 'develop' # Branch which will receive the automatic cherry-picks

            - name: Get the output
              run:
                  echo "The created PR number is ${{
                  steps.hello.outputs.pr-number }}"
```
