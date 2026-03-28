export default async function syncLabel({ github, context, label, marker }) {
  const owner = context.repo.owner
  const repo = context.repo.repo
  const issue_number = context.payload.pull_request.number
  const body = context.payload.pull_request.body || ''

  const { data: currentLabels } = await github.rest.issues.listLabelsOnIssue({
    owner,
    repo,
    issue_number,
  })

  const hasLabel = currentLabels.some(({ name }) => name === label)
  const wantsLabel = body.includes(marker)

  if (wantsLabel && !hasLabel) {
    await github.rest.issues.addLabels({
      owner,
      repo,
      issue_number,
      labels: [label],
    })
  }

  if (!wantsLabel && hasLabel) {
    await github.rest.issues.removeLabel({
      owner,
      repo,
      issue_number,
      name: label,
    })
  }
}
