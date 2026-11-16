import assert from "node:assert/strict";
import { findSelfDisclosure } from "../src/lib/self-disclosure-guard";
import { serializeRichText } from "../src/lib/rich-text";

const author = { firstName: "Jane", lastName: "Doe" };
const rich = (content: object[]) => serializeRichText({ type: "doc", content });
const codes = (text: string) => findSelfDisclosure(text, author).map((finding) => finding.code);

assert.deepEqual(codes("Experienced engineer working across teams."), []);
assert.ok(codes("Contact jane@example.com").includes("email"));
assert.ok(codes(rich([{ type: "paragraph", content: [
  { type: "text", text: "Contact jane@" },
  { type: "text", text: "example.com", marks: [{ type: "bold" }] },
] }])).includes("email"));
assert.ok(codes(rich([{ type: "paragraph", content: [
  { type: "text", text: "Jane " }, { type: "text", text: "Doe", marks: [{ type: "italic" }] },
] }])).includes("full_name"));
assert.ok(codes(rich([{ type: "paragraph", content: [
  { type: "text", text: "Get in touch", marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
] }])).includes("external_url"));

console.log("Rich bio disclosure checks passed.");
