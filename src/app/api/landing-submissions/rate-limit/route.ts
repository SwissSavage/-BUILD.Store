import { timingSafeEqual } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.LANDING_SUBMISSION_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!secret || secret.length < 32) return Response.json({ error: "Service unavailable" }, { status: 503 });
  const expected = Buffer.from(secret), actual = Buffer.from(supplied);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const key = request.headers.get("x-visitor-key") ?? "";
  if (!/^[a-f0-9]{64}$/.test(key)) return Response.json({ error: "Invalid key" }, { status: 400 });
  try {
    const result = await db.execute(sql`
      INSERT INTO landing_submission_rate_limits (visitor_key, window_start, attempts)
      VALUES (${key}, now(), 1)
      ON CONFLICT (visitor_key) DO UPDATE SET
        window_start = CASE WHEN landing_submission_rate_limits.window_start < now() - interval '10 minutes' THEN now() ELSE landing_submission_rate_limits.window_start END,
        attempts = CASE WHEN landing_submission_rate_limits.window_start < now() - interval '10 minutes' THEN 1 ELSE landing_submission_rate_limits.attempts + 1 END
      RETURNING attempts
    `);
    const attempts = Number(result.rows[0]?.attempts);
    if (Math.random() < 0.01) {
      await db.execute(sql`DELETE FROM landing_submission_rate_limits WHERE window_start < now() - interval '1 day'`);
    }
    if (attempts > 10) return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "600" } });
    return Response.json({ allowed: true });
  } catch {
    return Response.json({ error: "Service unavailable" }, { status: 503 });
  }
}
