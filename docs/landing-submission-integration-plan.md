# Landing-page submissions to $BUILD.Store

## Goal

Send Future Modern landing-page talent applications and project requests to the $BUILD.Store admin inbound queue. Preserve attachments, notify admins, retain the existing email notification, and prevent duplicate submissions on retry.

Tracking: [$BUILD.Store #293](https://github.com/SwissSavage/-BUILD.Store/issues/293) · [Landing page #7](https://github.com/yogabayusavira/afuturemodern-landing/issues/7).

## Branches and current state

- [x] Create a separate $BUILD.Store branch: `feat/landing-inbound-integration`.
- [x] Create a separate landing-page branch: `feat/build-store-inbound`.
- [x] Push the initial work-in-progress commits to their respective GitHub repositories.
- [ ] Finish and review the implementation. The current branches are drafts, not ready for deployment.
- [ ] Refresh both branches from their respective default branches before final review.

## Landing-page forms and server

- [x] Start forwarding talent and project form submissions from the landing server to $BUILD.Store.
- [x] Add a submission identifier intended to stay stable on an unchanged retry and change after an edit.
- [x] Preserve the existing honeypot and email notification path; avoid reporting a failed submission solely because the email notification failed after successful intake.
- [ ] Review and finish server-side field validation for both forms and both project paths.
- [ ] Enforce file count, per-file size, combined size, and actual PDF content consistently.
- [ ] Add reliable shared rate limiting and request-size limits; do not add a CAPTCHA.
- [ ] Verify that the visitor sees success only after $BUILD.Store confirms the complete submission is saved and that failed submissions retain their form content.
- [ ] Verify unchanged retries, edited submissions, concurrent retries, and lost responses do not create unwanted duplicates or mix data.
- [ ] Review email-failure and retry behavior, including duplicate-email handling.

## $BUILD.Store intake and private documents

- [x] Draft an authenticated server-to-server receiving endpoint with a private environment-variable credential.
- [x] Draft receiver-side field, attachment, and submission-ID validation.
- [x] Draft a separate database table for document content so inbox rows contain only attachment metadata.
- [x] Draft an admin-only attachment download route.
- [x] Draft a transaction that saves the inbox entry, document content, and admin notifications together.
- [ ] Complete a security and correctness review of authentication, request-size enforcement, validation, and error responses.
- [ ] Confirm the migration applies on the development database and document the resulting storage and retention implications.
- [ ] Verify document contents survive redeployment and are accessible only to authorized admins; verify safe downloads and handling of missing documents.
- [ ] Verify database-enforced deduplication, concurrent requests, transaction rollback, and retries with conflicting content.
- [ ] Verify the inbound entry presents every relevant field, identifies the landing page as its source, and links to the correct attachments.
- [ ] Verify admin notifications link to the correct entry and Admin → Inbound counts update as intended; confirm the actual refresh behavior.
- [ ] Review whether the navigation count should use a count query rather than loading all inbound records.

## Configuration and rollout

- [ ] Document the receiving URL and server credential environment variables, using distinct development and production values.
- [ ] Document credential rotation, deployment configuration, and request-size limits without recording secrets.
- [ ] Deploy the $BUILD.Store receiver and migration to development first, then configure and deploy the landing-page integration.
- [ ] Verify the existing email delivery remains useful and does not misreport accepted submissions.
- [ ] Review production configuration and deploy only after both changes have been reviewed and tested.

## Verification

- [ ] Run relevant type checks and production builds for both repositories.
- [ ] Test a talent application, a find-talent request, and a build-team request, with and without PDFs.
- [ ] Check missing and invalid credentials, malformed data, invalid PDF content, oversized files, and rate-limit behavior.
- [ ] Simulate app, database, notification, and email failures; confirm the visitor receives the correct outcome and submissions are not silently lost.
- [ ] Verify unauthorized and non-admin users cannot read inbox entries or download documents.
- [ ] Test keyboard and mobile access to the inbox attachment links.
- [ ] Review the diff, including excluding generated dependency files from commits.
- [ ] Create one detailed PR per repository after the changes are reviewed, linking the corresponding issue and documenting deployment order.

## Operational note

The landing-page repository tracks files under `node_modules`; the dependency installation in the isolated worktree changed those files. Do not include those generated changes in the integration commits.
