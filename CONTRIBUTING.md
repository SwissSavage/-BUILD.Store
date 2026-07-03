# Contributing to $BUILD.Store

Thanks for reading this far.

$BUILD.Store is the operating system Future Modern Builderberg LLC uses to run our cooperative. The code is open — you can read it, fork it, run your own instance, learn from how we built the compliance layer or the trading-card mechanic. What you can't do is present a fork as Future Modern or use our brand assets. The Apache 2.0 license grants the code. The NOTICE file explains what it doesn't.

## Two paths to contribute

**As an outside contributor.** Open an issue describing what you want to change or add. Wait for a maintainer to acknowledge the direction before writing code — it saves your time and ours. Once the direction is agreed, open a pull request with the change.

**As a Member or Partner of the cooperative.** You already have covenant obligations that apply here — deliver what you agreed to, communicate weekly, give honest review, respect confidentiality. The same rules that govern your work on paid engagements govern your work in this repo.

## Sign-off

Every commit needs a Developer Certificate of Origin (DCO) sign-off. Add `-s` to your commit command:

```
git commit -s -m "your commit message"
```

This appends `Signed-off-by: Your Name <your.email@example.com>` to the commit. By doing so you confirm you have the right to submit the contribution under the Apache 2.0 license (full DCO text at https://developercertificate.org/). We use DCO instead of a Contributor License Agreement to keep the friction low — no clickwrap, no separate signing step.

## What we're likely to accept

- Bug fixes with a clear reproduction
- Documentation improvements
- Performance improvements with benchmarks
- New features that fit the operating-system framing (see `/governance` or the `deliverables/handoff/handoff-brief.md`)
- Compliance improvements — audit-log verbs, control coverage, better evidence trails

## What we're likely to decline

- Additions that turn $BUILD.Store into a general-purpose marketplace platform. That's not what this is.
- Changes to the compensation gate, comp structure math, or MVP scoring band thresholds without cooperative-level discussion.
- Anything that leaks admin data into public routes, or weakens the visibility matrix.
- Cosmetic-only rewrites of working code.

## Code style

TypeScript strict. Server Components + Server Actions. Tailwind against the locked FM palette (see `tailwind.config.ts`). No em-dashes in copy — that's a Jamar-style preference and it applies here. Prefer prose in code comments over aphorisms.

Every consequential mutation writes an audit-log entry via `logAuditEvent()` in `src/lib/mock-data/audit-log.ts`. If you add a new server action that changes state, wire it to an appropriate `AuditLogAction` verb (or add a new verb to the union in `src/lib/types.ts` if none fits).

## Testing

Run typecheck before submitting:

```
npx tsc -p tsconfig.check.json --noEmit
```

## Values screen

Future Modern vets contributors the same way it vets Members and Partners — values before craft. "The craft we can teach. The values we cannot." If you're contributing to shape a stronger cooperative model, welcome. If you're contributing to extract value from someone else's cooperative model, we'll notice.

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0. See `LICENSE`.

## Contact

For anything that shouldn't go on a public issue: `contributions@buildstore` (production) or the /contact form (sandbox).
