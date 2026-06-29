/**
 * Buyer feedback section (Phase 2.7 sandbox).
 *
 * Renders on /orders/[id] for the buyer once status === "delivered".
 * Reuses the same 5-star rubric as the contract magic-link rail so
 * admin can compare apples to apples in the moderation queue.
 *
 * Visibility:
 *   - Hidden for sellers / admins / guests on this page (handled by caller).
 *   - Hidden once feedback is already on file — switches to a thank-you stub.
 */
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { hasFeedbackForContext } from "@/lib/mock-data/customer-feedback";
import { submitBuyerFeedback } from "@/lib/customer-feedback-actions";
import { StarPicker, ProseField, YesNoToggle } from "@/components/feedback-fields";

export function BuyerFeedbackSection({ orderId }: { orderId: string }) {
  const already = hasFeedbackForContext(orderId);

  if (already) {
    return (
      <Card className="mt-6 border-[#007048]/40">
        <CardEyebrow>Feedback received</CardEyebrow>
        <p className="mt-2 text-sm text-ink-muted">
          Thanks for the review — admin will pull the strongest line for
          the seller&apos;s public-to-members profile after a quick scrub.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mt-6 border-[#D828A0]/40">
      <CardEyebrow>How was this order?</CardEyebrow>
      <CardTitle className="mt-1 text-xl">
        Two minutes of feedback, please
      </CardTitle>
      <p className="mt-2 text-sm text-ink-muted">
        Your review helps the seller, and helps the next buyer pick well.
        Quotes only get published after admin pulls a clean line.
      </p>

      <form action={submitBuyerFeedback} className="mt-5 space-y-4">
        <input type="hidden" name="orderId" value={orderId} />

        <div className="grid gap-3 md:grid-cols-3">
          <StarPicker name="overallStars" label="Overall" autoFocus />
          <StarPicker name="metExpectations" label="Met expectations" />
          <StarPicker name="communication" label="Communication" />
        </div>

        <YesNoToggle name="wouldHireAgain" label="Would you order again?" />

        <ProseField
          name="prose"
          label="Tell us more (≥ 20 chars)"
          placeholder="Packaging, item quality, fulfillment speed — anything worth flagging."
        />

        <button
          type="submit"
          className="rounded-full px-5 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: "#D828A0" }}
        >
          Submit feedback
        </button>
      </form>
    </Card>
  );
}
