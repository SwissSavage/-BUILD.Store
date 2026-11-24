/**
 * The homepage atmosphere, turned down for the listing boards
 * (contracts, jobs, projects, store) so they don't sit on flat black.
 *
 * Same two glows as the homepage hero (magenta top right, blue bottom
 * left) at half strength, and the turtle watermark from the homepage
 * body at 3% instead of 4.5%. It is texture only: the cards carry the page.
 */
import Image from "next/image";

const BACKGROUND =
  "radial-gradient(70% 55% at 88% 8%, rgba(216, 40, 160, 0.10) 0%, transparent 62%), radial-gradient(68% 55% at 8% 92%, rgba(80, 112, 240, 0.10) 0%, transparent 64%)";

export function BoardBackdrop({
  className,
  children,
}: {
  /** Classes for the inner content container (the page's own max-width wrapper). */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: BACKGROUND }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-64 top-24 -z-10 hidden h-[44rem] w-[44rem] opacity-[0.03] md:block"
      >
        <Image
          src="/brand/turtle.png"
          alt=""
          fill
          sizes="44rem"
          className="object-contain brightness-0 invert"
        />
      </div>
      <div className={className}>{children}</div>
    </div>
  );
}
