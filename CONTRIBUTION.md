# Contributing to Paykit
Thank you for your interest in contributing to PayKit! Any successful proposals you make for our Github project will be reflected on the project page.

The PayKit project is managed on the basis of an open contributor model: anyone is welcome to contribute in the form of peer review, documentation, testing, and patches.

Pull requests can generally be utilized for making suggestions with regards to the documentation and code. If you have suggestions that are too substantial for a pull request, please open up an issue or contact us directly.  

# Communication Channels
Communication about the development of PayKit happens primarily in our [telegram](https://t.me/synonym_to) channel.

Discussion about code base improvements are conducted within GitHub issues and pull requests.

# Getting Started
First and foremost, start small.

We’re not discouraging you from being ambitious with the breadth and depth of your contributions. But we do suggest you become familiar with the project culture before investing an asymmetric number of hours on development compared to your merged work.
Issues

Browsing through the [issues](https://github.com/slashtags/paykit/issues) is a good first step. You will learn who is working on what, how releases are drafted, what tasks are pending delivery, where you can contribute review capacities, and so on. 

Scan through our [existing issues](https://github.com/github/docs/issues) to find one that interests you. You can narrow down the search using `labels` as filters. If you find an issue to work on, you are welcome to open a PR with a fix.

If you spot a problem with PayKit, please first [search if an issue already exists](https://docs.github.com/en/github/searching-for-information-on-github/searching-on-github/searching-issues-and-pull-requests#search-by-the-title-body-or-comments). If a related issue doesn't exist, you can open a new issue using a relevant [issue form](https://github.com/github/docs/issues/new/choose).

# Review
Even if you have an extensive open source background or sound software engineering skills, please understand that a reviewer’s ability to comprehend your code is as important as its technical correctness.

You are welcome to ask for a review on our Telegram. For reviewers, it's nice to have timelines when you hope to fulfill the request, bearing in mind that for both sides this is a "soft" commitment.

If you're eager to increase the velocity of the development process, reviewing the work from other contributors is a great way to fill the time while awaiting reviews on your own.

# Contribution Workflow
The PayKit codebase is maintained using the "contributor workflow" where everyone without exception contributes patch proposals using "pull requests". This promotes transparency, facilitates social contribution, easy testing, and peer review.

To contribute a patch, the workflow is as follows:

1. Fork the repository
2. Install or upgrade the development environment
3. Read [DEVELOPMENT](./DEVELOPMENT.md) guideline
3. Create a topic branch
4. Commit patches
5. Create PR into our repository

In general, commits should be atomic and diffs should be easy to read. For this reason, please do not mix formatting fixes or code moves with actual code changes. Furthermore, each commit, individually, should compile and pass all tests, in order to ensure git bisect and other automated tools function properly.

When adding a new feature, thought must be given to the long term technical debt. Every new feature should be covered by functional tests.

When refactoring, structure your PR to make it easy to review and don't hesitate to split it into multiple small, more focused PRs.

Commit messages should cover both the issue fixed and the solution's rationale. These [guidelines](https://chris.beams.io/posts/git-commit/) should be kept in mind.

To facilitate communication with other contributors, the project is making use of the GitHub Issues "assignee" field. First check that no one is assigned and then comment suggesting that you're working on it. If someone is already assigned, don't hesitate to ask if the assigned party or previous commenters are still working on it if they have not been active in a while.

## Create a Feature
1. Describe the problem that the PR is solving in an issue first.
2. Fork the repo and create your feature branch. Avoid having multiple features in one branch. See [Separation of Concerns](https://nalexn.github.io/separation-of-concerns/).
3. Code your feature.
    - Commits do NOT need to follow any convention.
4. Create a PR when finished. Use [Conventional Commits format](https://www.conventionalcommits.org/) as the PR title.
    - PR title format: `type: Summary of the changes`. Possible types are:
        - `BREAKING CHANGE` For changes that break the API.
        - `feat` For new features.
        - `fix` For bug fixes
        - `chore` For everything that is not covered in the above types.
    - Use the [Draft feature](https://github.blog/2019-02-14-introducing-draft-pull-requests/) in case you need an early review.
    - Assign a reviewer. Every PR needs to be reviewed at least once. More reviews are possible on request.
5. Always squash the PR when merging. This helps in the release process. One commit == one feature/fix.

## Versioning
1. Merge all PRs in the master branch that you want to include in the next version.
2. Update versions in client and service by running `npm version -- <x.x.x|major|minor|patch>` from the repository root.
3. Update `CHANGELOG.md` with the given format. Use the commit history on the master to determine the changes.
4. Create a PR with the title: `chore: vx.x.x`.
5. Let the PR review and squash + merge.
6. Publish the client library with `cd client && npm publish`.
7. Create a [new Github release](https://github.com/slashtags/paykit/releases/new).
    - Tag: `vx.x.x`
    - Title: `vx.x.x`
    - Description: Changelog for the current version.

# Peer review
Anyone may participate in peer review which is expressed by comments in the pull request. Typically reviewers will review the code for obvious errors, as well as test out the patch set and opine on the technical merits of the patch. PRs should be reviewed on the conceptual level first, before focusing on code style or editorial issues.

# Coding Conventions
Generally we prefer to use CommonJS modules, rely on promises over callbacks, and use dependency injection. Testing consists of Brittle as a testing framework, Sinon.JS for mocks, stubs, and spies, and Proxyquire for dependency interception.

We use the https://standardjs.com/ style guide, and our CI enforces default linting and test coverage monitoring.

All methods should have typescript definitions for input, output, and thrown errors. Significant structures that users persist should always have their inspect method implemented  `[Symbol.for('nodejs.util.inspect.custom')]`.

Updates to the serialized format which has implications for backwards or forwards compatibility must be included in release notes.

# Testing
We think rigorous testing is extremely important. Due to the modular nature of the project, writing new functional tests is easy and good test coverage of the codebase is an important goal. Refactoring the project to enable fine-grained unit testing is also an ongoing effort.
