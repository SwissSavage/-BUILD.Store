"use server";

/**
 * Server actions for the Mux content locker. Sandbox: mutates the
 * in-memory MOCK_MEDIA_ASSETS array. Real impl will write to the
 * `media_assets` Postgres table and call into the Mux upload API.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_MEDIA_ASSETS } from "@/lib/mock-data/media-assets";
import type {
  Industry,
  MediaAssetKind,
  MediaAssetStatus,
  MembershipTier,
} from "@/lib/types";

const VALID_KINDS: MediaAssetKind[] = ["video", "audio"];
const VALID_INDUSTRIES: Industry[] = [
  "stem",
  "creative-media",
  "professional-services",
];
const VALID_GATES: MembershipTier[] = [
  "viewer",
  "prospect",
  "partner",
  "member",
];
const VALID_STATUSES: MediaAssetStatus[] = [
  "draft",
  "pending_review",
  "published",
  "rejected",
  "archived",
];

/**
 * Member-side: submit a new asset to the locker. In production the
 * upload form would mint a Mux direct-upload URL; in sandbox we just
 * accept a URL placeholder. The new asset lands as `pending_review`
 * unless the uploader explicitly saved it as a draft.
 */
export async function submitMediaAsset(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const kindRaw = String(formData.get("kind") ?? "");
  const industryRaw = String(formData.get("industry") ?? "");
  const tierGateRaw = String(formData.get("tierGate") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const playbackUrl = String(formData.get("playbackUrl") ?? "").trim();
  const duration = String(formData.get("duration") ?? "").trim() || null;
  const posterUrl = String(formData.get("posterUrl") ?? "").trim() || null;
  const saveAsDraft = formData.get("draft") === "1";

  if (!VALID_KINDS.includes(kindRaw as MediaAssetKind)) return;
  if (!VALID_INDUSTRIES.includes(industryRaw as Industry)) return;
  if (!VALID_GATES.includes(tierGateRaw as MembershipTier)) return;
  if (!title || !description || !playbackUrl) return;

  const now = new Date().toISOString();
  MOCK_MEDIA_ASSETS.push({
    id: `ma_${Date.now()}`,
    uploaderId: user.id,
    kind: kindRaw as MediaAssetKind,
    title,
    description,
    industry: industryRaw as Industry,
    tierGate: tierGateRaw as MembershipTier,
    playbackUrl,
    posterUrl,
    duration,
    status: saveAsDraft ? "draft" : "pending_review",
    adminNote: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/locker");
  revalidatePath("/admin/locker");
  redirect("/locker");
}

/**
 * Admin-only: moderate an asset. Status can move to published / rejected
 * / archived; the admin note is stored either way (members see it on
 * rejection). No-op if caller isn't admin.
 */
export async function moderateMediaAsset(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) return;

  const id = String(formData.get("id") ?? "");
  const statusRaw = String(formData.get("status") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "").trim() || null;

  if (!VALID_STATUSES.includes(statusRaw as MediaAssetStatus)) return;
  const row = MOCK_MEDIA_ASSETS.find((a) => a.id === id);
  if (!row) return;

  row.status = statusRaw as MediaAssetStatus;
  row.adminNote = adminNote;
  row.reviewedBy = user.id;
  row.reviewedAt = new Date().toISOString();
  row.updatedAt = row.reviewedAt;

  revalidatePath("/locker");
  revalidatePath("/admin/locker");
}
