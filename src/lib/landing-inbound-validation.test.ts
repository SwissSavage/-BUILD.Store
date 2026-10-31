import { strict as assert } from "node:assert";
import { test } from "node:test";
import { File } from "node:buffer";
import { landingPayloadDigest, validateLandingFiles } from "./landing-inbound-validation";

test("accepts a PDF and retains private attachment data", async () => {
  const file = new File(["%PDF-1.7\nexample"], "sample.pdf", { type: "application/pdf" });
  const [saved] = await validateLandingFiles([file as unknown as globalThis.File]);
  assert.equal(saved.name, "sample.pdf");
  assert.equal(Buffer.from(saved.base64, "base64").toString(), "%PDF-1.7\nexample");
});

test("rejects fake PDFs and excessive attachment counts", async () => {
  const fake = new File(["not a PDF"], "fake.pdf", { type: "application/pdf" }) as unknown as globalThis.File;
  await assert.rejects(validateLandingFiles([fake]), /PDF/);
  await assert.rejects(validateLandingFiles(Array(6).fill(fake)), /Too many/);
});

test("rejects oversized files and combined attachments", async () => {
  const tooLarge = new File([Buffer.alloc(12 * 1024 * 1024 + 1)], "large.pdf", { type: "application/pdf" }) as unknown as globalThis.File;
  await assert.rejects(validateLandingFiles([tooLarge]), /size limit/);
  const bytes = Buffer.alloc(9 * 1024 * 1024);
  bytes.write("%PDF-");
  const file = new File([bytes], "large.pdf", { type: "application/pdf" }) as unknown as globalThis.File;
  await assert.rejects(validateLandingFiles([file, file, file]), /size limit/);
});

test("digest distinguishes changed content", () => {
  assert.equal(landingPayloadDigest({ value: "same" }), landingPayloadDigest({ value: "same" }));
  assert.notEqual(landingPayloadDigest({ value: "same" }), landingPayloadDigest({ value: "changed" }));
});
