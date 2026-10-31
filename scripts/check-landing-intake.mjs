import assert from 'node:assert/strict'

const base = process.env.TEST_BASE_URL
const secret = process.env.LANDING_SUBMISSION_SECRET
const id = process.env.TEST_SUBMISSION_ID
if (!base || !secret || !id) throw new Error('Set TEST_BASE_URL, LANDING_SUBMISSION_SECRET, and TEST_SUBMISSION_ID for an isolated test')

function submission(summary = 'Integration test', fileContents = '%PDF-1.7\ntest') {
  const form = new FormData()
  for (const [key, value] of Object.entries({ submissionId: id, submissionType: 'talent', firstName: 'Integration', lastName: 'Test', email: 'codex-test@example.invalid', contributionSummary: summary, termsAccepted: 'true' })) form.append(key, value)
  form.append('files', new Blob([fileContents], { type: 'application/pdf' }), 'integration-test.pdf')
  return form
}

async function post(form, credential = secret) {
  const response = await fetch(`${base}/api/landing-submissions`, { method: 'POST', headers: { Authorization: `Bearer ${credential}` }, body: form })
  return { response, body: await response.json() }
}

const unauthorized = await post(submission(), 'invalid')
assert.equal(unauthorized.response.status, 401, 'invalid credential must be rejected')
const invalid = await post(submission('Integration test', 'not a PDF'))
assert.notEqual(invalid.response.status, 200, 'invalid PDF must be rejected')
const first = await post(submission())
assert.equal(first.response.status, 200, JSON.stringify(first.body))
assert.equal(first.body.duplicate, false)
assert.equal(first.body.id, `landing_${id}`)
const retry = await post(submission())
assert.equal(retry.response.status, 200)
assert.equal(retry.body.duplicate, true)
const conflict = await post(submission('Changed submission'))
assert.equal(conflict.response.status, 409)
for (const [prefix, path] of [['00000000', 'find-talent'], ['00000001', 'build-team']]) {
  const form = new FormData()
  const projectId = `${prefix}-${id.slice(9)}`
  const fields = { submissionId: projectId, submissionType: 'project', firstName: 'Integration', lastName: 'Test', email: 'codex-test@example.invalid', termsAccepted: 'true', company: 'Test company', path, [path === 'find-talent' ? 'requestSummary' : 'projectSummary']: 'Integration test' }
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  const result = await post(form)
  assert.equal(result.response.status, 200, JSON.stringify(result.body))
}
const visitorKey = id.replaceAll('-', '').repeat(2)
for (let attempt = 1; attempt <= 11; attempt++) {
  const response = await fetch(`${base}/api/landing-submissions/rate-limit`, { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'X-Visitor-Key': visitorKey } })
  assert.equal(response.status, attempt <= 10 ? 200 : 429, `rate limit attempt ${attempt}`)
}
const document = await fetch(`${base}/api/admin/inbound/landing_${id}/attachments/0`)
assert.equal(document.status, 404, 'unauthenticated attachment access must be rejected')
console.log('Passed: authentication, PDF validation, talent and project saves, retry, conflict, rate limit, and unauthenticated download')
