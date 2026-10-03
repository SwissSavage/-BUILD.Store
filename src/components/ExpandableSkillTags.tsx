export function ExpandableSkillTags({ skills }: { skills: string[] }) {
  const visible = skills.slice(0, 3);
  const hidden = skills.slice(3);
  const tagClass = "rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-xs text-ink-muted";

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {visible.map((skill) => <span key={skill} className={tagClass}>{skill}</span>)}
      </div>
      {hidden.length > 0 && (
        <details className="group">
          <summary className="inline-flex cursor-pointer list-none rounded-full border border-brand-magenta px-2 py-0.5 text-xs font-medium text-brand-magentaText hover:bg-[rgba(216,40,160,0.18)] [&::-webkit-details-marker]:hidden">
            +{hidden.length} more
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {hidden.map((skill) => <span key={skill} className={tagClass}>{skill}</span>)}
          </div>
        </details>
      )}
    </div>
  );
}
