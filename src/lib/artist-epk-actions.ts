/**
 * Artist EPK lifecycle server actions.
 *
 * Same self-managed-then-curated pattern as memberships, project apps,
 * sellers. Artist edits a draft → submits for review → admin approves
 * (and User.profileMode flips to "epk" if not already) OR sends back
 * with notes.
 *
 * Visibility rules:
 *   - "draft" / "submitted" — never renders publicly. If a previously
 *     published version exists in another row, it stays live. (Sandbox
 *     keeps one row per user, so submission of a previously-published
 *     EPK keeps the old `publishedAt` until admin re-approves.)
 *   - "published" — renders on /u/[handle] when User.profileMode === "epk".
 *   - "needs_revision" — keeps any prior `publishedAt` live; artist
 *     iterates and re-submits.
 *
 * REPLACE WITH: Drizzle inserts/updates against `artist_epks`. Featured
 * work and press become 1-to-many tables when we move off mock data.
 */
"use server";

import { notify } from "@/lib/writers/notifications";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { artistEpks } from "@/db/schema";
import { getEpk } from "@/lib/readers";
import { getCurrentUser, requireAdmin } from "@/lib/auth-stub";
import {
  MOCK_ARTIST_EPKS,
  epkForUser,
} from "@/lib/mock-data/artist-epk";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_NOTIFICATIONS } from "@/lib/mock-data/notifications";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import type {
  ArtistEpk,
  ArtistMetricSnapshot,
  ArtistSocialHandle,
  FeaturedWorkEntry,
  Notification,
  PressClip,
  Web3MarketplaceProfile,
} from "@/lib/types";

async function pushNotification(
  partial: Omit<Notification, "id" | "createdAt" | "readAt">,
): Promise<void> {
  // Writer swap 2026-08-28: delegates to the shared Postgres writer.
  // Was an in-memory push, so these notifications never survived a
  // deploy and the bell icon was effectively decorative.
  await notify(partial);
}

/**
 * Load a member's EPK, creating the draft row on first touch.
 *
 * Writer swap 2026-08-28: this used to push onto an in-memory array,
 * so an artist could fill out their entire press kit and have it
 * disappear before an admin ever saw it in the curation queue.
 */
async function upsertEpk(userId: string): Promise<ArtistEpk> {
  const existing = await getEpk(userId);
  if (existing) return existing;
  const fresh: ArtistEpk = {
    userId,
    status: "draft",
    heroImageUrl: null,
    tagline: null,
    bioShort: "",
    bioLong: null,
    featuredWork: [],
    press: [],
    trackRecord: [],
    socialHandles: [],
    web3Profiles: [],
    metrics: [],
    bookingNote: null,
    submittedAt: null,
    publishedAt: null,
    adminRevisionNote: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.insert(artistEpks).values(fresh);
  return fresh;
}

/**
 * Stamp updatedAt and persist the whole row.
 *
 * Every EPK mutation ends by calling this, which makes it the single
 * write point for the domain. The actions above still mutate the
 * in-memory object first — that keeps their logic readable — and this
 * flushes the result in one UPDATE.
 */
async function bumpUpdated(epk: ArtistEpk): Promise<void> {
  epk.updatedAt = new Date().toISOString();
  await db
    .update(artistEpks)
    .set({
      status: epk.status,
      heroImageUrl: epk.heroImageUrl,
      tagline: epk.tagline,
      bioShort: epk.bioShort,
      bioLong: epk.bioLong,
      featuredWork: epk.featuredWork,
      press: epk.press,
      trackRecord: epk.trackRecord,
      socialHandles: epk.socialHandles,
      web3Profiles: epk.web3Profiles,
      metrics: epk.metrics,
      bookingNote: epk.bookingNote,
      submittedAt: epk.submittedAt,
      publishedAt: epk.publishedAt,
      adminRevisionNote: epk.adminRevisionNote,
      updatedAt: epk.updatedAt,
    })
    .where(eq(artistEpks.userId, epk.userId));
}

function parseTrackRecord(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function newEntryId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

/* ------------------------------------------------------------------ */
/*  Artist actions                                                     */
/* ------------------------------------------------------------------ */

/**
 * Artist saves changes to the core EPK fields (hero, tagline, bios,
 * track record, booking note). Featured work and press get their own
 * actions because they're list-shaped.
 */
export async function saveEpkCore(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");
  const epk = await upsertEpk(user.id);

  epk.heroImageUrl = nullable(formData.get("heroImageUrl"));
  epk.tagline = nullable(formData.get("tagline"));
  epk.bioShort = String(formData.get("bioShort") ?? "").trim();
  epk.bioLong = nullable(formData.get("bioLong"));
  epk.bookingNote = nullable(formData.get("bookingNote"));
  epk.trackRecord = parseTrackRecord(formData.get("trackRecord"));

  // Saving content alone keeps the row in draft / needs_revision; it
  // does NOT auto-resubmit. The submit action is explicit.
  if (epk.status === "needs_revision") {
    // Editing after a revision request keeps it as needs_revision until
    // the artist explicitly re-submits.
  } else if (epk.status !== "submitted" && epk.status !== "published") {
    epk.status = "draft";
  }

  await bumpUpdated(epk);
  revalidatePath("/profile/epk");
}

export async function addFeaturedWork(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");
  const epk = await upsertEpk(user.id);

  const entry: FeaturedWorkEntry = {
    id: newEntryId("fw"),
    title: String(formData.get("title") ?? "").trim(),
    embedUrl: String(formData.get("embedUrl") ?? "").trim(),
    platform: detectPlatform(String(formData.get("embedUrl") ?? "")),
    releaseDate: nullable(formData.get("releaseDate")),
    contractAddress: nullable(formData.get("contractAddress")),
    context: nullable(formData.get("context")),
  };
  if (entry.title.length === 0) throw new Error("Title is required");
  if (entry.embedUrl.length === 0) {
    throw new Error("Embed URL is required");
  }

  epk.featuredWork.push(entry);
  await bumpUpdated(epk);
  revalidatePath("/profile/epk");
}

export async function removeFeaturedWork(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");
  const epk = epkForUser(user.id);
  if (!epk) return;
  const id = String(formData.get("id") ?? "");
  epk.featuredWork = epk.featuredWork.filter((e) => e.id !== id);
  await bumpUpdated(epk);
  revalidatePath("/profile/epk");
}

export async function addPressClip(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");
  const epk = await upsertEpk(user.id);

  const clip: PressClip = {
    id: newEntryId("pr"),
    outlet: String(formData.get("outlet") ?? "").trim(),
    quote: String(formData.get("quote") ?? "").trim(),
    url: String(formData.get("url") ?? "").trim(),
    date: nullable(formData.get("date")),
  };
  if (clip.outlet.length === 0) throw new Error("Outlet is required");
  if (clip.quote.length === 0) throw new Error("Quote is required");

  epk.press.push(clip);
  await bumpUpdated(epk);
  revalidatePath("/profile/epk");
}

export async function removePressClip(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");
  const epk = epkForUser(user.id);
  if (!epk) return;
  const id = String(formData.get("id") ?? "");
  epk.press = epk.press.filter((p) => p.id !== id);
  await bumpUpdated(epk);
  revalidatePath("/profile/epk");
}

/* ------------------------------------------------------------------ */
/*  Onesheet additions: socials, web3 marketplaces, metrics             */
/* ------------------------------------------------------------------ */

const SOCIAL_PLATFORMS = new Set<ArtistSocialHandle["platform"]>([
  "instagram",
  "twitter",
  "tiktok",
  "youtube",
  "twitch",
  "discord",
  "audius",
  "spotify",
  "soundcloud",
  "apple_music",
  "bandcamp",
  "linktree",
  "personal_site",
  "other",
]);

const WEB3_PLATFORMS = new Set<Web3MarketplaceProfile["platform"]>([
  "opensea",
  "zora",
  "catalog",
  "sound_xyz",
  "foundation",
  "rarible",
  "manifold",
  "objkt",
  "other",
]);

const METRIC_PLATFORMS = new Set<ArtistMetricSnapshot["platform"]>([
  "spotify",
  "audius",
  "apple_music",
  "soundcloud",
  "bandcamp",
  "youtube",
  "tiktok",
  "instagram",
  "twitter",
  "twitch",
  "discord",
  "opensea",
  "zora",
  "catalog",
  "sound_xyz",
  "foundation",
  "rarible",
  "other",
]);

function coerceSocialPlatform(raw: FormDataEntryValue | null): ArtistSocialHandle["platform"] {
  const v = String(raw ?? "") as ArtistSocialHandle["platform"];
  return SOCIAL_PLATFORMS.has(v) ? v : "other";
}

function coerceWeb3Platform(raw: FormDataEntryValue | null): Web3MarketplaceProfile["platform"] {
  const v = String(raw ?? "") as Web3MarketplaceProfile["platform"];
  return WEB3_PLATFORMS.has(v) ? v : "other";
}

function coerceMetricPlatform(raw: FormDataEntryValue | null): ArtistMetricSnapshot["platform"] {
  const v = String(raw ?? "") as ArtistMetricSnapshot["platform"];
  return METRIC_PLATFORMS.has(v) ? v : "other";
}

export async function addSocialHandle(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");
  const epk = await upsertEpk(user.id);
  const url = String(formData.get("url") ?? "").trim();
  if (url.length === 0) throw new Error("URL is required");
  epk.socialHandles.push({
    platform: coerceSocialPlatform(formData.get("platform")),
    url,
    handle: nullable(formData.get("handle")),
  });
  await bumpUpdated(epk);
  revalidatePath("/profile/epk");
}

export async function removeSocialHandle(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");
  const epk = epkForUser(user.id);
  if (!epk) return;
  const index = Number(formData.get("index") ?? -1);
  if (Number.isInteger(index) && index >= 0 && index < epk.socialHandles.length) {
    epk.socialHandles.splice(index, 1);
    await bumpUpdated(epk);
    revalidatePath("/profile/epk");
  }
}

export async function addWeb3Profile(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");
  const epk = await upsertEpk(user.id);
  const url = String(formData.get("url") ?? "").trim();
  if (url.length === 0) throw new Error("Marketplace URL is required");
  epk.web3Profiles.push({
    platform: coerceWeb3Platform(formData.get("platform")),
    url,
    handle: nullable(formData.get("handle")),
    contractAddress: nullable(formData.get("contractAddress")),
    context: nullable(formData.get("context")),
  });
  await bumpUpdated(epk);
  revalidatePath("/profile/epk");
}

export async function removeWeb3Profile(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");
  const epk = epkForUser(user.id);
  if (!epk) return;
  const index = Number(formData.get("index") ?? -1);
  if (Number.isInteger(index) && index >= 0 && index < epk.web3Profiles.length) {
    epk.web3Profiles.splice(index, 1);
    await bumpUpdated(epk);
    revalidatePath("/profile/epk");
  }
}

export async function addMetric(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");
  const epk = await upsertEpk(user.id);
  const metric = String(formData.get("metric") ?? "").trim();
  const value = String(formData.get("value") ?? "").trim();
  if (metric.length === 0 || value.length === 0) {
    throw new Error("Metric label and value are required");
  }
  epk.metrics.push({
    platform: coerceMetricPlatform(formData.get("platform")),
    metric,
    value,
    capturedAt: new Date().toISOString(),
  });
  await bumpUpdated(epk);
  revalidatePath("/profile/epk");
}

export async function removeMetric(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");
  const epk = epkForUser(user.id);
  if (!epk) return;
  const index = Number(formData.get("index") ?? -1);
  if (Number.isInteger(index) && index >= 0 && index < epk.metrics.length) {
    epk.metrics.splice(index, 1);
    await bumpUpdated(epk);
    revalidatePath("/profile/epk");
  }
}

/**
 * Artist explicitly submits the current EPK for admin review. Fans out
 * a notification to all admins. Idempotent — re-submitting a row that
 * is already submitted just refreshes the timestamp.
 */
export async function submitEpkForReview() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");
  const epk = epkForUser(user.id);
  if (!epk) throw new Error("No EPK to submit — save a draft first");
  if (epk.bioShort.trim().length < 20) {
    throw new Error("Short bio is required (≥ 20 chars) before submission");
  }

  epk.status = "submitted";
  epk.submittedAt = new Date().toISOString();
  // Clear any prior revision note now that the artist has re-submitted.
  epk.adminRevisionNote = null;
  await bumpUpdated(epk);

  for (const u of MOCK_USERS) {
    if (!u.isAdmin) continue;
    await pushNotification({
      userId: u.id,
      kind: "epk_submitted",
      title: `EPK submitted — ${user.firstName ?? user.handle}`,
      body: `${user.firstName ?? user.handle} submitted their Electronic Press Kit for review. Open the queue to approve or send back with notes.`,
      href: "/admin/epk",
    });
  }

  revalidatePath("/profile/epk");
  revalidatePath("/admin/epk");
}

/* ------------------------------------------------------------------ */
/*  Admin actions                                                      */
/* ------------------------------------------------------------------ */

/**
 * Admin approves a submitted EPK. Flips status to "published", flips
 * User.profileMode to "epk" if not already, sets publishedAt, notifies
 * the artist.
 */
export async function approveEpk(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const epk = epkForUser(userId);
  if (!epk) throw new Error("EPK not found");
  if (epk.status !== "submitted") {
    throw new Error("EPK must be submitted before it can be approved");
  }

  const target = MOCK_USERS.find((u) => u.id === userId);
  if (!target) throw new Error("Target user not found");

  const now = new Date().toISOString();
  epk.status = "published";
  epk.publishedAt = now;
  epk.adminRevisionNote = null;
  await bumpUpdated(epk);

  if (target.profileMode !== "epk") {
    target.profileMode = "epk";
  }

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "epk.approved",
    resourceKind: "user",
    resourceId: target.id,
    before: { status: "submitted" },
    after: { status: "published", publishedAt: now },
  });

  await pushNotification({
    userId: target.id,
    kind: "epk_published",
    title: "Your EPK is live",
    body: `Your Electronic Press Kit is now visible on /u/${target.handle}. Public viewers see the EPK shell first, members see the cooperative depth below.`,
    href: `/u/${target.handle}`,
  });

  revalidatePath("/admin/epk");
  revalidatePath(`/u/${target.handle}`);
  revalidatePath("/profile/epk");
}

/**
 * Admin sends a submitted EPK back with revision notes. Status flips
 * to "needs_revision". If a prior `publishedAt` exists, the previously
 * published version stays live until the artist re-submits and admin
 * re-approves.
 */
export async function requestEpkRevision(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const note = String(formData.get("adminRevisionNote") ?? "").trim();
  if (note.length < 10) {
    throw new Error(
      "Revision note must be at least 10 characters — be specific.",
    );
  }
  const epk = epkForUser(userId);
  if (!epk) throw new Error("EPK not found");
  if (epk.status !== "submitted") {
    throw new Error(
      "Only submitted EPKs can be sent back for revision",
    );
  }

  const target = MOCK_USERS.find((u) => u.id === userId);
  if (!target) throw new Error("Target user not found");

  epk.status = "needs_revision";
  epk.adminRevisionNote = note;
  await bumpUpdated(epk);

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "epk.revision_requested",
    resourceKind: "user",
    resourceId: target.id,
    before: { status: "submitted" },
    after: { status: "needs_revision" },
    reason: note,
  });

  await pushNotification({
    userId: target.id,
    kind: "epk_revision_requested",
    title: "EPK needs revision",
    body: `An admin sent your EPK back with notes. Open /profile/epk to read the feedback and resubmit.`,
    href: "/profile/epk",
  });

  revalidatePath("/admin/epk");
  revalidatePath("/profile/epk");
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function nullable(raw: FormDataEntryValue | null): string | null {
  const v = String(raw ?? "").trim();
  return v.length === 0 ? null : v;
}

function detectPlatform(url: string): FeaturedWorkEntry["platform"] {
  const u = url.toLowerCase();
  if (u.includes("audius.co")) return "audius";
  if (u.includes("catalog.works") || u.includes("notes.catalog.works")) {
    return "catalog";
  }
  if (u.includes("zora.co") || u.includes("market.zora.co")) return "zora";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("bandcamp.com")) return "bandcamp";
  if (u.includes("glass.xyz")) return "glass";
  if (u.includes("soundcloud.com")) return "soundcloud";
  if (u.includes("spotify.com")) return "spotify";
  if (u.includes("vimeo.com")) return "vimeo";
  return "other";
}
