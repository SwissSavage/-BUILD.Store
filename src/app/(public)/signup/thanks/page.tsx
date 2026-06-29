import Link from "next/link";

export default function ThanksPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="font-display text-4xl font-semibold md:text-5xl">
        You&apos;re in the room.
      </h1>
      <p className="mt-4 text-ink-muted">
        We&apos;ll reach out shortly. In the meantime, take a look at what the
        cooperative is building.
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/signin"
          className="rounded-full bg-ink px-8 py-3 font-medium text-[var(--surface)] transition-colors hover:bg-brand-magenta hover:text-brand-white"
        >
          Preview the app
        </Link>
        <Link
          href="/"
          className="rounded-full border border-[var(--surface-border)] px-8 py-3 font-medium transition-colors hover:border-brand-magenta hover:text-brand-magenta"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
