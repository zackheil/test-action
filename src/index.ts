import * as core from '@actions/core'
import * as github from '@actions/github'
import { log } from './util/log';
import { createComment } from './util/comment';
(async () => {
    log.info('starting my custom action and testing logs');
    try {
        /**
         * We need to fetch all the inputs that were provided to our action
         * and store them in variables for us to use.
         **/
        const owner = core.getInput('owner', { required: true });
        const repo = core.getInput('repo', { required: true });
        const pr_number = parseInt(core.getInput('pr_number', { required: true }));
        const token = core.getInput('token', { required: true });
        const triggered_by = core.getInput('triggered_by', { required: true });

        log.info(`Running action in ${owner}/${repo}#${pr_number} that was triggered by: ${triggered_by}`);

        /**
         * Now we need to create an instance of Octokit which will use to call
         * GitHub's REST API endpoints.
         * We will pass the token as an argument to the constructor. This token
         * will be used to authenticate our requests.
         * You can find all the information about how to use Octokit here:
         * https://octokit.github.io/rest.js/v18
         **/
        const octokit = github.getOctokit(token);

        /**
         * We need to fetch the list of files that were changes in the Pull Request
         * and store them in a variable.
         * We use octokit.paginate() to automatically loop over all the pages of the
         * results.
         * Reference: https://octokit.github.io/rest.js/v18#pulls-list-files
         */
        const { data: changedFiles } = await octokit.rest.pulls.listFiles({
            owner,
            repo,
            pull_number: pr_number,
        });

        let today = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
        const latestComment = (await octokit.rest.issues.listComments({
            owner,
            repo,
            issue_number: pr_number,
            since: today
        })).data.slice(-1)[0];

        log.info(JSON.stringify(latestComment, null, 2))
        //     rest.issues.getComment({
        //     owner,
        //     repo,
        //     issue_number: pr_number
        // })


        /**
         * Contains the sum of all the additions, deletions, and changes
         * in all the files in the Pull Request.
         **/
        let diffData = {
            additions: 0,
            deletions: 0,
            changes: 0
        };

        // Reference for how to use Array.reduce():
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce
        diffData = changedFiles.reduce((acc, file) => {
            acc.additions += file.additions;
            acc.deletions += file.deletions;
            acc.changes += file.changes;
            return acc;
        }, diffData);

        /**
         * Loop over all the files changed in the PR and add labels according 
         * to files types.
         **/
        // for (const file of changedFiles) {
        //     /**
        //      * Add labels according to file types.
        //      */
        //     const fileExtension = file.filename.split('.').pop();
        //     switch (fileExtension) {
        //         case 'md':
        //             await octokit.rest.issues.addLabels({
        //                 owner,
        //                 repo,
        //                 issue_number: pr_number,
        //                 labels: ['markdown'],
        //             });
        //         case 'js':
        //             await octokit.rest.issues.addLabels({
        //                 owner,
        //                 repo,
        //                 issue_number: pr_number,
        //                 labels: ['javascript'],
        //             });
        //         case 'yml':
        //             await octokit.rest.issues.addLabels({
        //                 owner,
        //                 repo,
        //                 issue_number: pr_number,
        //                 labels: ['yaml'],
        //             });
        //         case 'yaml':
        //             await octokit.rest.issues.addLabels({
        //                 owner,
        //                 repo,
        //                 issue_number: pr_number,
        //                 labels: ['yaml'],
        //             });
        //     }
        // }

        /**
         * Create a comment on the PR with the information we compiled from the
         * list of changed files.
         */
        const botMadeLastComment = latestComment.user?.login === 'github-actions[bot]' && latestComment.body?.includes('This comment was made by')
        if (!botMadeLastComment)
            await octokit.rest.issues.createComment({
                owner,
                repo,
                issue_number: pr_number,
                body: createComment(
                    `This PR has been updated with: \n` +
                    ` - ${diffData.changes} changes \n` +
                    ` - ${diffData.additions} additions \n` +
                    ` - ${diffData.deletions} deletions \n\n\n`
                )
            });

    } catch (error) {
        core.setFailed(error.message);
    }
})();