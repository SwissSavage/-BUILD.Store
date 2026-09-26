# Rich-text editor rollout

## Goal

Use the shared rich-text editor for reader-facing documents that need clear
headings, lists, links, and emphasis. Do not add it to short conversational or
internal-note fields.

## Current implementation

- Existing project and contract editing already uses the rich editor through
  `/admin/projects/[id]/edit`.
- Project and contract records share the `projects` table and description
  field.
- Project and contract detail pages use the shared `Brief` renderer, but some
  surrounding routes still render descriptions as plain text.

## First rollout: listings

1. Admin contract creation: `/admin/contracts/new`
2. Internal project proposal: `/projects/new`
3. Admin job creation and editing: `/admin/jobs`
4. Existing project and contract editing: already complete

Before rich descriptions are enabled across those creation paths, normalize
the remaining readers that still render raw text:

- Contract quote page: `/contracts/[id]/quote`
- Proposal token page: `/proposals/[token]`
- Case-study page: `/case-studies/[id]`
- Job JSON-LD metadata: extract plain text for search metadata

## Second rollout: editorial content

- Seller product descriptions
- Portfolio descriptions
- Long EPK biography
- Member profile biography
- Cohort/editorial narratives
- Admin-moderated portfolio descriptions

## Third rollout: proposal writing

- Contract bid pitches
- Job application pitches
- Project application and contribution pitches

This requires updating every admin, member, and client-facing reader of a
pitch—not just its form.

## Keep plain text

- Community chat and direct messages
- Admin notes, audit rationales, suspension reasons, and internal comments
- Feedback and review responses
- Invite, referral, payout, calendar, invoice, and support notes
- Structured lists such as skills, tags, deliverables, and capabilities

## Immediate focus

Make contract description presentation match the project detail presentation.
Projects are the visual reference. Start by comparing the project and contract
detail routes and reuse the shared brief layout where the contract route still
uses raw or differently structured description content.
