# Client Statement of Work — template

**Drop-in source for Documenso.** Upload as `Client SOW v1`. The template envelope id goes into the `DOCUMENSO_TEMPLATE_CLIENT_SOW` env var in Dokploy and locally in `.env.local`. Once set, the approve-time dispatch on `/quotes/[token]` fires this envelope to the client automatically (task #45).

**Signers**

1. Client contact (SIGNER) — pre-filled from `clientContactEmail` + `clientContactName` collected on approve.
2. Future Modern account owner (SIGNER) — countersigns after the client to close the envelope.

**Fields to place in the PDF (left as `{{placeholder}}` in the draft below — Documenso admin dashboard converts these to fillable / templated fields):**

- `{{engagement.title}}` — quote's project title
- `{{engagement.scope_summary}}` — quote.scope.summary
- `{{engagement.deliverables}}` — quote.scope.deliverables joined with newlines
- `{{engagement.timeline}}` — quote.scope.timeline
- `{{engagement.total_line}}` — derived from proposedBuilders (fixed / range / hourly aggregate)
- `{{lead.first_name}}` — first name of the client-picked lead builder
- `{{client.contact_name}}` — clientContactName from approve
- `{{client.display_name}}` — clientDisplayName on the quote row

---

## STATEMENT OF WORK

**Between:** Future Modern LLC ("Future Modern")
**And:** `{{client.display_name}}` (the "Client"), c/o `{{client.contact_name}}`

**Engagement:** `{{engagement.title}}`

**Effective Date:** date of full execution below.

### 1. Scope

Future Modern will deliver the engagement described below, coordinating a hand of builders selected from the Future Modern cooperative. The lead builder for this engagement is `{{lead.first_name}}`.

**Scope summary:**

`{{engagement.scope_summary}}`

**Deliverables:**

`{{engagement.deliverables}}`

**Timeline:** `{{engagement.timeline}}`

### 2. Compensation

`{{engagement.total_line}}`

Future Modern operates on a base-rate + bonus-margin split (85% to builders / 15% to cooperative operations) per Section 6b of the Talent Partner Agreement executed with each contributor. This SOW is the engagement-level Statement of Work; the split mechanics are internal to Future Modern and not passed through to Client.

Payment terms: net-15 from invoice receipt unless otherwise agreed in writing. Invoices are issued from the Future Modern billing entity through the platform's invoicing surface.

### 3. Change requests

Scope changes (additions or subtractions) require written acknowledgement from both parties (email is written for this purpose). Substantive changes will be re-priced.

### 4. Confidentiality

Both parties agree to keep confidential any non-public information disclosed in the course of this engagement. Client information disclosed to builders is scoped by their engagement necessity. Future Modern's mutual NCNDA (executed separately) governs the treatment of confidential material.

### 5. IP allocation

Deliverables produced for Client under this engagement are Client's property upon Client's full payment of the compensation described in Section 2, subject to Section 9 of the underlying Talent Partner Agreement executed with each contributor (which distinguishes client-paid, internal FM, and talent-development engagements — this is the client-paid configuration).

### 6. Term & termination

The engagement runs from the Effective Date through completion of the deliverables in Section 1. Either party may terminate the engagement with fourteen (14) days written notice; Client will pay for work performed through the termination date. Payment obligations for completed work survive termination.

### 7. Governing law

State of California, USA. Any dispute is resolved by binding arbitration in San Francisco County unless the parties mutually agree to litigate.

---

**Client (SIGNER):**
Signature: _______________________
Printed name: `{{client.contact_name}}`
Title: _______________________
Date: _______________________

**Future Modern (SIGNER):**
Signature: _______________________
Printed name: _______________________
Title: Account Owner
Date: _______________________
