/**
 * State shape for the homepage question form.
 *
 * Split out of homepage-question-actions.ts on 2026-11-03. That file
 * carries a module-level "use server", which publishes every export as
 * a POST endpoint, so Next.js allows only async functions to be
 * exported from it. The type and its initial value are neither, and
 * check-use-server has been failing on main since the homepage revamp
 * landed, which took `npm run typecheck` down with it.
 *
 * A plain module is the fix the guard's own error message asks for.
 */
export type HomepageQuestionState = {
  status: "idle" | "error" | "success";
  message: string;
};

export const initialHomepageQuestionState: HomepageQuestionState = {
  status: "idle",
  message: "",
};
