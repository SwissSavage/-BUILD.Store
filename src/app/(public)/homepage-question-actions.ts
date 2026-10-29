"use server";

import { revalidatePath } from "next/cache";
import { extractKeywords } from "@/lib/talent-match";
import { insertInboundSubmission } from "@/lib/writers/inbound-submissions";

export type HomepageQuestionState = {
  status: "idle" | "error" | "success";
  message: string;
};

export const initialHomepageQuestionState: HomepageQuestionState = {
  status: "idle",
  message: "",
};

/** Writes homepage questions to the same admin inbox as every other public lead. */
export async function submitHomepageQuestion(
  _previousState: HomepageQuestionState,
  formData: FormData,
): Promise<HomepageQuestionState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const question = String(formData.get("question") ?? "").trim();

  if (!name || !email || !phone || !question) {
    return { status: "error", message: "Please complete every field." };
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { status: "error", message: "Enter a valid email address." };
  }
  if (question.length > 4000) {
    return {
      status: "error",
      message: "Keep your question to 4,000 characters or fewer.",
    };
  }

  try {
    const body = `Phone: ${phone}\n\n${question}`;
    await insertInboundSubmission({
      kind: "other",
      status: "new",
      title: `Homepage question · ${name}`,
      submitter: name,
      submitterEmail: email,
      submitterCompany: null,
      pillarTags: [],
      keywordTags: extractKeywords(question).slice(0, 50),
      body,
      attachments: [],
      assignedAdminId: null,
      triageNote: null,
      deepLinkHref: null,
      linkedResourceId: null,
      derived: false,
    });
  } catch {
    return {
      status: "error",
      message: "Your question was not sent. Please try again.",
    };
  }

  revalidatePath("/");
  return {
    status: "success",
    message: "Thanks — the Future Modern team will get back to you.",
  };
}
