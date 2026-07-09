# Security policy

## Reporting a vulnerability

If you find a security issue in $BUILD.Store, please **do not open a public issue**. Instead, email:

- **Production**: `security@buildstore`
- **Sandbox / pre-launch**: use the [contact form](https://github.com/SwissSavage/-BUILD.Store/blob/main/src/app/contact/page.tsx) or open a private security advisory on GitHub

We will acknowledge receipt within 3 business days and provide a remediation timeline within 10 business days.

## Scope

- Any surface reachable via the public routes (`/`, `/about`, `/showcase`, `/policies/*`, `/trust`, `/governance`, `/signup`, `/whitelist`)
- Authentication flows (production) and access-control gating on `/admin/*` + `/profile/*` routes
- Data handling on any surface that touches Member records, contract records, or financial data
- Audit log integrity + persistence
- Anything covered under the compliance readiness controls documented at `deliverables/compliance/soc2-iso27001-readiness.md`

## Out of scope

- Findings that require physical access to a Member's device
- Vulnerabilities in third-party dependencies unless they materially affect $BUILD.Store's behavior
- Social engineering attacks against Members or admins
- Anything that requires bypassing our documented cooperative-covenant enforcement layer without a technical exploit

## Recognition

We publicly credit reporters (with permission) in the release notes for the version that ships the fix. Recognition is one of the cooperative's core rails — this includes contributors who help us stay honest about our security posture.
