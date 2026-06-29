/**
 * Shared form primitives for the customer feedback rails (Phase 2.7).
 *
 * Both the magic-link contract surface and the auth-gated buyer surface
 * use the same star scale and prose constraints. Keeping them in one
 * file means the admin queue compares like with like.
 */

export function StarPicker({
  name,
  label,
  autoFocus,
}: {
  name: string;
  label: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={`${name}-star`}
        className="block text-[11px] uppercase tracking-wider text-ink-muted"
      >
        {label}
      </label>
      <select
        id={`${name}-star`}
        name={name}
        required
        defaultValue=""
        autoFocus={autoFocus}
        className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
      >
        <option value="" disabled>
          Pick 1–5
        </option>
        <option value="5">★★★★★ Exceptional</option>
        <option value="4">★★★★ Strong</option>
        <option value="3">★★★ Solid</option>
        <option value="2">★★ Mixed</option>
        <option value="1">★ Did not work</option>
      </select>
    </div>
  );
}

export function YesNoToggle({
  name,
  label,
}: {
  name: string;
  label: string;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-4">
      <legend className="text-[11px] uppercase tracking-wider text-ink-muted">
        {label}
      </legend>
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" name={name} value="yes" required />
        Yes
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" name={name} value="no" />
        No
      </label>
    </fieldset>
  );
}

export function ProseField({
  name,
  label,
  placeholder,
}: {
  name: string;
  label: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label
        htmlFor={`${name}-textarea`}
        className="block text-[11px] uppercase tracking-wider text-ink-muted"
      >
        {label}
      </label>
      <textarea
        id={`${name}-textarea`}
        name={name}
        required
        minLength={20}
        rows={4}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
      />
    </div>
  );
}

export function ShortTextField({
  name,
  label,
  placeholder,
  required = false,
  maxLength = 200,
}: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <div>
      <label
        htmlFor={`${name}-text`}
        className="block text-[11px] uppercase tracking-wider text-ink-muted"
      >
        {label}
      </label>
      <input
        id={`${name}-text`}
        name={name}
        type="text"
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
      />
    </div>
  );
}

export function RadioChoice({
  name,
  label,
  options,
  required = true,
}: {
  name: string;
  label: string;
  options: ReadonlyArray<readonly [string, string]>;
  required?: boolean;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="block text-[11px] uppercase tracking-wider text-ink-muted">
        {label}
      </legend>
      <div className="space-y-1.5">
        {options.map(([value, optionLabel], index) => (
          <label
            key={value}
            className="flex items-start gap-2 text-sm leading-snug"
          >
            <input
              type="radio"
              name={name}
              value={value}
              required={required && index === 0}
              className="mt-1"
            />
            <span>{optionLabel}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function NameEmailFields({
  defaultName,
  defaultEmail,
}: {
  defaultName?: string;
  defaultEmail?: string;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <label
          htmlFor="customerName"
          className="block text-[11px] uppercase tracking-wider text-ink-muted"
        >
          Your name
        </label>
        <input
          id="customerName"
          name="customerName"
          type="text"
          required
          defaultValue={defaultName ?? ""}
          className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label
          htmlFor="customerEmail"
          className="block text-[11px] uppercase tracking-wider text-ink-muted"
        >
          Your email
        </label>
        <input
          id="customerEmail"
          name="customerEmail"
          type="email"
          required
          defaultValue={defaultEmail ?? ""}
          className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}
