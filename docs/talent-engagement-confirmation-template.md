# Talent Engagement Confirmation — template

**Drop-in source for Documenso.** Upload as `Talent Engagement Confirmation v1`. The template envelope id goes into `DOCUMENSO_TEMPLATE_TALENT_ENGAGEMENT_CONFIRMATION` in Dokploy + `.env.local`. Once set, approve-time dispatch on `/quotes/[token]` sends this envelope to the client-picked lead builder alongside the Client SOW.

**Signers**

1. Lead talent (SIGNER) — pre-filled from `users.email` for `selectedLeadUserId` on the quote.
2. Future Modern account owner (SIGNER) — countersigns.

**Placeholder fields for the PDF:**

- `{{engagement.title}}` — quote's project title
- `{{engagement.client_display_name}}` — quote.clientDisplayName
- `{{engagement.total_line}}` — same derivation the SOW uses
- `{{talent.first_name}}`, `{{talent.full_name}}` — from users table
- `{{talent.per_hour}}` — pricing.hourlyRate for the picked lead's ProposedBuilder row
- `{{engagement.deliverables}}` — scope.deliverables
- `{{engagement.timeline}}` — scope.timeline
- `{{talent.timeline}}` — the picked builder's own timeline field on ProposedBuilder

---

## ENGAGEMENT CONFIRMATION

**Between:** Future Modern LLC ("Future Modern")
**And:** `{{talent.full_name}}` ("Talent")

**Engagement:** `{{engagement.title}}` (Client: `{{engagement.client_display_name}}`)

**Effective Date:** date of full execution below.

This Engagement Confirmation ("Confirmation") is an addendum under the Talent Partner Agreement previously executed by Talent with Future Modern (the "Master Agreement"). All defined terms, IP allocation rules (Section 9), Conduct Standards (Section 17), and Confidentiality / Non-Compete / Non-Circumvention obligations of the Master Agreement apply to this engagement. Where a term conflicts between this Confirmation and the Master Agreement, the Master Agreement governs.

### 1. Engagement scope

Talent will contribute to the deliverables described below as the client-picked lead for this engagement.

**Deliverables:** `{{engagement.deliverables}}`
**Engagement timeline:** `{{engagement.timeline}}`
**Talent's own commitment:** `{{talent.timeline}}`

### 2. Compensation

Talent is compensated at `{{talent.per_hour}}` per hour under this engagement, invoiced against actual hours delivered. Compensation flows through the base-rate + bonus-margin split described in Section 6b of the Master Agreement.

Total engagement value across the full crew (for reference only — Talent's individual line is above): `{{engagement.total_line}}`.

### 3. Conduct

Talent reaffirms adherence to Section 17 (Conduct Standards) of the Master Agreement for the duration of this engagement, including:

- All client communication routes through Future Modern channels unless expressly directed otherwise.
- No solicitation of Client outside the engagement.
- Escalation of any Conduct-Standards-relevant concern to a Future Modern admin, in writing, at the earliest reasonable moment.

### 4. Term

The engagement runs from the Effective Date through completion of the deliverables in Section 1. Talent's obligations to Client end on the earlier of (a) delivery + acceptance of the deliverables, (b) Client's termination of the underlying Client SOW, or (c) Future Modern's rotation of Talent off the engagement in writing.

### 5. Governing agreement

This Confirmation is subordinate to and interpreted alongside the Master Agreement. Governing law and dispute-resolution provisions of the Master Agreement apply.

---

**Talent (SIGNER):**
Signature: _______________________
Printed name: `{{talent.full_name}}`
Date: _______________________

**Future Modern (SIGNER):**
Signature: _______________________
Printed name: _______________________
Title: Account Owner
Date: _______________________
