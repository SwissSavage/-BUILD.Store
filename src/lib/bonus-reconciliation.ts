/**
 * Base Rate and Bonus Margin reconciliation.
 *
 * ─────────────────────────────────────────────────────────────
 * WHAT THIS REPLACES (2026-11-24)
 *
 * evaluateBonusGate and CANONICAL_BONUS_GATE, both of which go away.
 *
 * That gate compared a single client star to a threshold of 4 and
 * returned release or reclaim, with nothing in between. When no client
 * rating arrived inside a 30-day window it fell back to a composite
 * weighted 0.6 toward the engagement admin's own rating — and the only
 * way to reach that branch was for that same admin not to have sent
 * the client a feedback link, which the settle page made a manual
 * button. Not sending it moved the decision from the client to
 * themselves, at dominant weight.
 *
 * The link is no longer a decision. It always goes out, on every
 * milestone, with no control to skip or defer it, so whether the
 * client was asked is not something any party to the outcome gets to
 * influence. The admin rating that remains is weighted 0.2.
 *
 * Its numbers were also attributed to a `future-modern.md` that is not
 * in this repository, so nothing about them could be checked against
 * anything. Treat any comment in this codebase citing that file as
 * unverified.
 *
 * ─────────────────────────────────────────────────────────────
 * THE MARGIN IS EARNED, NOT DOCKED
 *
 * Read the arithmetic that way round, because it changes what the copy
 * should say. A 3.5 earned 75% of the Bonus Margin. It did not lose
 * 25% of it. Nothing is deducted from anyone here: the Base Rate is
 * unconditional on delivery, and the margin is a variable amount that
 * resolves against performance. No surface built on this module should
 * describe a result as a penalty, a deduction, or a clawback.
 *
 * ─────────────────────────────────────────────────────────────
 * TIMING
 *
 * Payouts run throughout a contract, not once at the end. The Base
 * Rate is not contingent on performance signals, so it flows as
 * milestones and timesheets clear, and FM collects its share on each
 * of those payments as they go.
 *
 * The Bonus Margin is the contingent part, so it is the only thing
 * that waits. Client feedback is collected at every milestone, and the
 * blended rating at close is built from all of those readings rather
 * than one impression taken at the end. That is what makes a shortfall
 * visible at milestone two, while engaging a replacement is still
 * worth doing.
 *
 * ─────────────────────────────────────────────────────────────
 * FM IS PAID WHENEVER TALENT IS PAID
 *
 * Commission is struck on each disbursement at 15/85 of it, not
 * computed once against the contract. There is no path where money
 * reaches a contributor and FM collects nothing, and no path where FM
 * funds a contributor out of its own share. The rate never moves; the
 * dollars move with what was actually paid.
 *
 * ─────────────────────────────────────────────────────────────
 * THERE IS ONE UNCOMMITTED POT, NOT TWO
 *
 * An invariant check caught this, after I had already described it
 * wrongly in conversation. The unearned margin is NOT the pot.
 *
 * On a 3.5 against a $2,550 margin, $637.50 of margin goes unearned —
 * but had it been earned, FM would also have collected $112.50 of
 * commission on it. Both sit unspent, so the uncommitted amount is
 * $750.00, and the unearned margin is only part of it.
 *
 * The pleasant consequence: $750 uncommitted buys exactly $637.50 of
 * replacement labor, because that payment carries its own commission.
 * The pot always buys precisely the unearned margin's worth of work.
 * Spend it on a replacement and the contract lands whole, with FM at
 * 15% throughout and nothing rebated.
 *
 * So `uncommittedCents` is the single figure a disposition acts on,
 * and paid + commission + uncommitted always equals the contract
 * value. Anything reporting a separate "held" figure double-counts.
 *
 * ─────────────────────────────────────────────────────────────
 * A REBATE IS A LAST RESORT, NEVER AUTOMATIC
 *
 * Below a 4 this module recommends and never disburses. The unreleased
 * remainder is held, and the options are ordered: corrective or
 * replacement work first, redistribution to anyone who covered second,
 * and cash back to the client only as an explicit action somebody
 * takes and signs for. `uncommittedCents` is what a rebate could come
 * from; it is not a rebate.
 *
 * ─────────────────────────────────────────────────────────────
 * MONEY IS IN CENTS
 *
 * Integers throughout. Callers converting from numeric(12,2) columns
 * must remember those arrive as strings from node-postgres, which is
 * what broke three money pages in #94.
 *
 * NO DATABASE IMPORTS. Pure, so the arithmetic can be checked without
 * a connection. quote-pricing is pure too, and is imported rather than
 * mirrored so the floor and the hedge have exactly one definition.
 * ─────────────────────────────────────────────────────────────
 */
import { suggestedBuilderHourlyPayout } from "@/lib/quote-pricing";

// ── The scale ────────────────────────────────────────────────
//
// Ratings are half-stars on a 1.0–5.0 scale, stored as integer
// half-steps 2..10 rather than a decimal column. Doubling is lossless
// for every existing integer row, and it keeps money-adjacent
// arithmetic off numeric, which returns strings.

export const HALF_STEPS_MIN = 2; // 1.0 stars
export const HALF_STEPS_MAX = 10; // 5.0 stars

/** Integer half-steps to stars. 7 → 3.5 */
export function starsFromHalfSteps(halfSteps: number): number {
  return halfSteps / 2;
}

/** Stars to integer half-steps, for writes. 3.5 → 7 */
export function halfStepsFromStars(stars: number): number {
  return Math.round(stars * 2);
}

export function isValidHalfSteps(n: unknown): n is number {
  return (
    typeof n === "number" &&
    Number.isInteger(n) &&
    n >= HALF_STEPS_MIN &&
    n <= HALF_STEPS_MAX
  );
}

// ── The blend ────────────────────────────────────────────────

export const CLIENT_WEIGHT = 0.4;
export const PEER_WEIGHT = 0.4;
export const PM_WEIGHT = 0.2;

/**
 * The three slots, each holding every rating that landed in it.
 *
 * Slots are ASSIGNED per engagement, the same way delivery roles are.
 * Peer does not mean "the other contributors on the deal" — it means
 * somebody assigned to judge this work because they have the
 * experience to. On AWS that is Rob on a design deliverable: he
 * studied design, so his read on the craft is worth weighting, and he
 * sits in the peer slot rather than the PM slot even though he is an
 * admin on the engagement.
 *
 * Several people can hold one slot. Each slot averages within itself
 * first, then the three slot averages carry 0.4 / 0.4 / 0.2. So a
 * slot's weight is a property of the slot, not of how many people are
 * in it — two peers do not outvote one PM by being two.
 *
 * `client` holds every reading collected: several contacts at the
 * client, across every milestone. Plain mean over all of them is MY
 * default and not something I was told. A recency weighting, or
 * averaging per-contact before averaging contacts, would both be
 * defensible — this is the knob.
 *
 * `pm` sits at 0.2, down from the 0.6 the old gate gave it, because it
 * is the one slot filled by a party to the outcome.
 *
 * Values are stars (1.0–5.0). An empty array means the slot was never
 * filled, which renormalizes away rather than scoring as zero.
 */
export interface RatingSignals {
  client: number[];
  peer: number[];
  pm: number[];
}

/** Mean of a slot, or null when nobody filled it. */
export function slotMean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export interface Blend {
  /** 1.0–5.0, or null when no signal exists at all. */
  value: number | null;
  /** Which signals were present, for showing the work. */
  present: Array<"client" | "peer" | "pm">;
  /**
   * True when nothing was collected. Not a zero: see
   * NO_SIGNAL_PAYS_FULL_MARGIN below.
   */
  noSignal: boolean;
}

/**
 * Weighted mean over whichever signals exist, renormalized across the
 * weights actually present.
 *
 * Renormalizing rather than treating a missing signal as zero: absent
 * is not bad. A client who never answered has said nothing, and
 * scoring their silence as a 0 would zero the margin on an engagement
 * nobody complained about.
 */
export function blendRating(signals: RatingSignals): Blend {
  const parts: Array<{
    key: "client" | "peer" | "pm";
    value: number;
    weight: number;
  }> = [];
  // Each slot averages within itself before carrying its weight, so
  // filling a slot with more people does not buy that slot more
  // influence.
  const slots: Array<[("client" | "peer" | "pm"), number[], number]> = [
    ["client", signals.client, CLIENT_WEIGHT],
    ["peer", signals.peer, PEER_WEIGHT],
    ["pm", signals.pm, PM_WEIGHT],
  ];
  for (const [key, values, weight] of slots) {
    const mean = slotMean(values);
    if (mean !== null) parts.push({ key, value: mean, weight });
  }

  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  // Guarded rather than divided: the old code's equivalent branch
  // resolved a zero total to a composite of 0, which scores silence as
  // the worst possible result.
  if (parts.length === 0 || totalWeight === 0) {
    return { value: null, present: [], noSignal: true };
  }

  const weighted = parts.reduce((s, p) => s + p.value * p.weight, 0);
  return {
    value: weighted / totalWeight,
    present: parts.map((p) => p.key),
    noSignal: false,
  };
}

// ── Where the split comes from ───────────────────────────────
//
// I went looking for a stored base/bonus split, found no column, and
// told Jamar nothing held it. Wrong: quote-pricing.ts has computed it
// since October and its own docblock says the margin "funds the bonus
// gate without a renegotiation."
//
// A vendor applies with a rate or a range. suggestedBuilderHourlyPayout
// takes max(top of range, ask + $10 hedge, $50 floor). That payout is
// the ceiling, and the ask is the guaranteed part:
//
//   Base Rate     = what they asked for
//   Bonus Margin  = payout ceiling − what they asked for
//   Client rate   = ceil(payout / 0.85)
//
// Bayu asks $30. The floor lifts the payout to $50, so his base is the
// $30 he asked for and $20 is margin he earns on performance. The
// client is billed $59. Nobody is paid under the floor and nobody
// renegotiates.
//
// Against the three live bids in that docblock: $55 flat gives base
// $55 and $10 of margin, the hedge doing the work; $25 flat gives base
// $25 and $25 of margin, the floor doing it; $100–175 taken at the top
// gives base $100 and $75 of margin.
//
// Hourly only. The floor and hedge are deliberately not applied to a
// fixed or range project price, because adding $10 to a scoped quote
// means nothing — so a fixed-price engagement has no derived margin.

/**
 * An engagement run at a flat rate with no contingent portion.
 *
 * Two ways to get here. A fixed-price scope never had a derived margin
 * in the first place. Or an admin deliberately removes it, which is
 * what AWS needs: a known rate, agreed up front, nothing held back.
 *
 * Either way `reviewGate` stops blocking, because there is nothing for
 * a rating to resolve — and feedback is still collected, because
 * collection never depended on there being money at stake.
 */
export interface FixedRateElection {
  byUserId: string;
  reason: string;
  /**
   * The agreed rate, when it was negotiated rather than derived.
   *
   * Omit it and the derived payout stands as the guaranteed amount,
   * which still honors the floor — electing a flat rate is not a route
   * to paying someone under it.
   */
  rateCents?: number;
}

export interface DerivedSplit {
  /** Guaranteed. What the contributor asked for. */
  baseCents: number;
  /** Contingent. The lift from their ask to the payout ceiling. */
  bonusMarginCents: number;
  /** The ceiling: base + margin. */
  payoutCents: number;
}

/**
 * Split one contributor's payout into its guaranteed and contingent
 * parts, from what they asked for.
 *
 * Takes the ask and derives the rest by calling quote-pricing, rather
 * than accepting a payout the caller worked out. That is deliberate:
 * the first version of this function took `payoutCents` as a
 * parameter, which let this module be internally consistent while
 * knowing nothing about the one place the number is actually decided.
 * Two functions computing the same payout by different routes is how
 * the old gate ended up unaware of the hedge that funds it.
 *
 * So there is one derivation. If the floor or the hedge changes in
 * quote-pricing, this follows, and nothing has to be kept in step by
 * hand.
 *
 * A fixed-rate election collapses the margin to nothing and pays the
 * whole payout as base. So does an ask at or above the ceiling, which
 * needs no lift.
 */
export function deriveSplit(input: {
  /** Per hour for an hourly basis, total for a fixed one. Cents. */
  askCents: number;
  /** Top of a submitted range, when there was one. */
  askMaxCents?: number | null;
  /**
   * Hourly carries the floor and the hedge. A fixed price is quoted
   * against a scope, so neither applies — quote-pricing says so in as
   * many words, and I called the hourly rule unconditionally at first,
   * which would have added an hourly $10 hedge to a project total.
   *
   * A fixed basis with no range therefore has no margin at all. That
   * is the genuine flat scenario: bill the client a fixed price, pay
   * the contractor outright, nothing contingent. Ozy's AWS engagement
   * is this shape, and it needs no override to behave correctly.
   *
   * A fixed basis WITH a range still has a margin, because the spread
   * between what they would accept and what we bill at is real money
   * they can earn.
   */
  basis: "hourly" | "fixed";
  /**
   * The negotiated contract value, required on a fixed basis.
   *
   * The causation runs the other way on these, which I had backwards.
   * Hourly goes ask → payout → client price. A fixed range bid goes
   * negotiated price → payout, because FM prices what it believes it
   * can negotiate and the contributor takes 85% of that. Ozy's AWS
   * engagement settled at $442 on a $520 contract, which is exactly
   * 85%, not anything derived from his ask.
   *
   * So on a fixed basis the submitted range does not set the payout.
   * It sets the BASE: the low end is what they said they would accept,
   * so that much is guaranteed, and everything between it and their
   * 85% is margin they earn.
   *
   * ── DO NOT CAP THIS, AND DO NOT RAISE THE BASE ──
   *
   * FM can often negotiate two to three times a contributor's ask, so
   * the margin routinely exceeds the base. I read that as "43% of
   * their pay is at risk" and proposed capping it. Wrong: none of
   * their pay is at risk. The base IS their asking price. At the
   * bottom of the scale they receive exactly what they said they would
   * do the work for, which is the deal they proposed.
   *
   * The margin is money they never asked for, won by FM negotiating
   * above their number. Handing all of it over regardless of the work
   * serves nobody when we are already paying well above ask and the
   * job came back bad.
   *
   * A cap, or a base set as a floor percentage of payout, would move
   * unearned upside into the guaranteed column and break that. If this
   * looks unfair in a review, re-read which number is the ask.
   *
   * The one real obligation it creates is disclosure. A contributor
   * shown $442 who receives $250 will read a cut, even though $250 is
   * their own price. 6b requires the split be disclosed in the SOW at
   * acceptance for exactly this reason, so the acceptance surface has
   * to state both numbers plainly: guaranteed, and earnable.
   */
  contractValueCents?: number | null;
  fixedRate?: FixedRateElection | null;
}): DerivedSplit {
  const askMax =
    input.askMaxCents != null && input.askMaxCents > input.askCents
      ? input.askMaxCents
      : null;
  const payoutCents =
    input.basis === "hourly"
      ? Math.round(
          suggestedBuilderHourlyPayout(
            input.askCents / 100,
            askMax == null ? null : askMax / 100,
          ) * 100,
        )
      : // Fixed: 85% of what was negotiated. No floor, no hedge —
        // quote-pricing is explicit that neither belongs on a price
        // quoted against a scope.
        Math.round(
          (input.contractValueCents ?? askMax ?? input.askCents) *
            (input.contractValueCents != null
              ? COMMISSION_DENOMINATOR / 100
              : 1),
        );
  if (input.fixedRate) {
    // An agreed rate wins, but never below the derived payout, so the
    // floor cannot be undercut by electing a flat rate.
    const flat = Math.max(
      payoutCents,
      Math.round(input.fixedRate.rateCents ?? 0),
    );
    return { baseCents: flat, bonusMarginCents: 0, payoutCents: flat };
  }
  // Clamped: an ask above the ceiling would otherwise produce a
  // negative margin, and the ask is never reduced by this.
  const baseCents = Math.min(
    payoutCents,
    Math.max(0, Math.round(input.askCents)),
  );
  return {
    baseCents,
    bonusMarginCents: payoutCents - baseCents,
    payoutCents,
  };
}

// ── The curve ────────────────────────────────────────────────

/** At or above this blended rating the whole margin is earned. */
export const MARGIN_FULL_AT = 4.0;
/** At or below this, none of it is. No bonus on a two-star job. */
export const MARGIN_ZERO_AT = 2.0;

/**
 * When nothing was collected at all, the full margin is earned and
 * nothing is left uncommitted.
 *
 * The request always goes out — it is not a decision anyone makes, and
 * there is no control anywhere to skip or defer it. So reaching this
 * branch means the asking itself broke on our side: a bad address, a
 * bounce, a dispatch that never fired. That is our failure to
 * instrument, and it must not land on the Builder's pay.
 *
 * Named rather than inlined because it is a policy choice and not
 * arithmetic. Flip this if that judgement ever changes.
 */
export const NO_SIGNAL_PAYS_FULL_MARGIN = true;

/**
 * Share of the Bonus Margin earned at a given blended rating.
 *
 * Linear between the two breakpoints: full at 4.0, none at 2.0, so
 * each half-star across that span is worth a quarter of the margin.
 *
 * Note 4.0 earns all of it. The clause this implements only engages
 * where contribution falls materially short, and a four-star
 * engagement is not a shortfall.
 */
export function earnedMarginFraction(blendedRating: number): number {
  const span = MARGIN_FULL_AT - MARGIN_ZERO_AT;
  // A configuration where the breakpoints coincide is a step, not a
  // ramp, and must not divide by zero.
  if (span <= 0) return blendedRating >= MARGIN_FULL_AT ? 1 : 0;
  const raw = (blendedRating - MARGIN_ZERO_AT) / span;
  return Math.min(1, Math.max(0, raw));
}

// ── Commission ───────────────────────────────────────────────

export const COMMISSION_NUMERATOR = 15;
export const COMMISSION_DENOMINATOR = 85;

/**
 * FM's commission on one disbursement to a contributor.
 *
 * Struck per payment, so the 85/15 ratio holds against whatever was
 * actually paid out. Rounded half-up to the cent; the residual
 * absorbs the rounding, which is the only line nobody is owed.
 */
export function commissionOnCents(paidCents: number): number {
  return Math.round(
    (paidCents * COMMISSION_NUMERATOR) / COMMISSION_DENOMINATOR,
  );
}

/**
 * What an uncommitted amount buys in labor, once that payment's own
 * commission is carried out of the same pot. 85% of it.
 *
 * Lands on exactly the unearned margin, which is the check that the
 * single-pot model is right: $750 uncommitted buys $637.50 of work
 * against a $637.50 shortfall.
 */
export function labourAffordableFromCents(uncommittedCents: number): number {
  return Math.round(
    (uncommittedCents * COMMISSION_DENOMINATOR) /
      (COMMISSION_DENOMINATOR + COMMISSION_NUMERATOR),
  );
}

// ── Reconciliation ───────────────────────────────────────────

export type Disposition =
  /** Nothing held. The margin was earned in full. */
  | "settled"
  /** Held, and a decision is owed on it. */
  | "awaiting_disposition";

export interface ReconciliationInput {
  /** Total contract value for the WORK. */
  contractValueCents: number;
  /**
   * The guaranteed portion of the contributor's share. Paid on
   * acceptable delivery as milestones clear, so by close this is
   * normally already disbursed.
   */
  baseRateCents: number;
  /** The contingent remainder of the contributor's share. */
  bonusMarginCents: number;
  signals: RatingSignals;
}

export interface Reconciliation {
  blend: Blend;
  /** 0–1. */
  earnedFraction: number;
  /** Margin earned. Not a reduction of anything. */
  earnedMarginCents: number;
  /** Margin not earned. Reported for explanation only — it is NOT the
   *  pot, and nothing should disburse against it. See the header. */
  unearnedMarginCents: number;
  /** Base plus earned margin. */
  contributorPaidCents: number;
  /** FM's take on what has been paid. */
  commissionCents: number;
  /**
   * The single pot. Contract value not committed to a contributor and
   * not taken as commission. A disposition acts on this and nothing
   * else, and paid + commission + uncommitted always equals the
   * contract value.
   *
   * It is not a rebate. A rebate is one of the things it could become,
   * last and only by explicit decision.
   */
  uncommittedCents: number;
  /** What the pot buys in labor, its own commission carried. */
  buysLabourCents: number;
  disposition: Disposition;
  /** Ordered, most-preferred first. Empty when nothing is held. */
  recommendations: string[];
  explanation: string;
}

/**
 * Reconcile one WORK at close.
 *
 * Does not disburse, does not rebate, and does not decide anything
 * about the held remainder. It computes what was earned and reports
 * what is owed a decision.
 */
export function reconcileBonusMargin(
  input: ReconciliationInput,
): Reconciliation {
  const { contractValueCents, baseRateCents, bonusMarginCents } = input;
  const blend = blendRating(input.signals);

  const earnedFraction =
    blend.value === null
      ? NO_SIGNAL_PAYS_FULL_MARGIN
        ? 1
        : 0
      : earnedMarginFraction(blend.value);

  const earnedMarginCents = Math.round(bonusMarginCents * earnedFraction);
  const unearnedMarginCents = bonusMarginCents - earnedMarginCents;
  const contributorPaidCents = baseRateCents + earnedMarginCents;
  const commissionCents = commissionOnCents(contributorPaidCents);
  // The pot is what the contract has left, not the unearned margin.
  // Those differ by the commission FM would have taken had the margin
  // been earned, and conflating them double-counts.
  const uncommittedCents =
    contractValueCents - contributorPaidCents - commissionCents;

  const recommendations: string[] = [];
  if (uncommittedCents > 0) {
    recommendations.push(
      "Corrective or replacement work on this engagement, funded from the held amount.",
    );
    recommendations.push(
      "Redistribution to contributors who covered the shortfall, in proportion to the coverage they provided.",
    );
    recommendations.push(
      "Cash concession to the client. Last resort, and only by explicit decision.",
    );
  }

  const stars = (n: number) => n.toFixed(2).replace(/\.00$/, "");
  const explanation = blend.noSignal
    ? NO_SIGNAL_PAYS_FULL_MARGIN
      ? "No client, peer or PM rating was collected on this engagement. The full Bonus Margin is earned, because failing to ask is not something the contributor should pay for."
      : "No rating was collected, and policy withholds the margin in that case."
    : earnedFraction >= 1
      ? `Blended rating ${stars(blend.value ?? 0)} of 5, at or above ${stars(MARGIN_FULL_AT)}. The full Bonus Margin is earned.`
      : `Blended rating ${stars(blend.value ?? 0)} of 5. ${Math.round(earnedFraction * 100)}% of the Bonus Margin is earned on the ${stars(MARGIN_ZERO_AT)}-to-${stars(MARGIN_FULL_AT)} scale. The uncommitted balance on this WORK is awaiting a disposition decision.`;

  return {
    blend,
    earnedFraction,
    earnedMarginCents,
    unearnedMarginCents,
    contributorPaidCents,
    commissionCents,
    uncommittedCents,
    buysLabourCents: labourAffordableFromCents(uncommittedCents),
    disposition: uncommittedCents > 0 ? "awaiting_disposition" : "settled",
    recommendations,
    explanation,
  };
}

// ── Does collection block settlement? ────────────────────────
//
// Collection and gating are two different questions and must not be
// collapsed into one flag.
//
//   Collection ALWAYS happens. Reviews go out on every milestone, the
//   client request has no skip control, and nothing here can turn that
//   off. There is no parameter for it because there is no decision.
//
//   GATING — whether settlement waits on what came back — is the part
//   that bends. Two cases:
//
//   1. No Bonus Margin on the WORK. Derivable, not a decision: with
//      nothing contingent to resolve, B has no money to act on and
//      waiting for it is friction with no outcome attached.
//
//   2. An engagement that predates this rail, or was paid before it
//      existed. Grandfathered. Someone has to say so explicitly and it
//      has to be on the record, because it is an exception to a rule
//      about money.
//
// Same shape as separating "the amount is right" from "I received it"
// on remittance: either order is allowed, and a bypass is recorded
// rather than silent.

export interface ReviewGateDecision {
  /** Whether settlement should wait on collected feedback. */
  blocks: boolean;
  reason:
    | "fixed_rate_elected"
    | "no_bonus_margin"
    | "grandfathered_override"
    | "margin_awaiting_feedback";
  explanation: string;
}

export function reviewGate(input: {
  bonusMarginCents: number;
  /** Margin deliberately removed. See FixedRateElection. */
  fixedRate?: FixedRateElection | null;
  /**
   * An explicit, attributable grandfather exception. Never defaulted
   * true, and a caller that sets it must also be writing who and why
   * to the audit trail — a bypass nobody signed is indistinguishable
   * from a bug.
   */
  grandfatherOverride?: { byUserId: string; reason: string } | null;
}): ReviewGateDecision {
  if (input.fixedRate) {
    return {
      blocks: false,
      reason: "fixed_rate_elected",
      explanation:
        "This WORK runs at a flat rate with no contingent portion, by election. Feedback is still collected and still counts toward standing; it has no bearing on pay here.",
    };
  }
  if (input.bonusMarginCents <= 0) {
    return {
      blocks: false,
      reason: "no_bonus_margin",
      explanation:
        "No Bonus Margin on this WORK, so there is nothing for a rating to resolve. Reviews still go out; settlement does not wait on them.",
    };
  }
  if (input.grandfatherOverride) {
    return {
      blocks: false,
      reason: "grandfathered_override",
      explanation:
        "Settlement gating was waived for this engagement by explicit decision. Reviews still go out and still count toward standing.",
    };
  }
  return {
    blocks: true,
    reason: "margin_awaiting_feedback",
    explanation:
      "There is a Bonus Margin to resolve, so settlement waits on collected feedback.",
  };
}

/**
 * FM's commission as a share of what was brokered, for showing the
 * ratio held. Always 0.15 up to rounding.
 */
export function effectiveCommissionRate(r: Reconciliation): number {
  const brokered = r.contributorPaidCents + r.commissionCents;
  if (brokered === 0) return 0;
  return r.commissionCents / brokered;
}
