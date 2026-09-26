import { Brief } from "@/components/Brief";
import { parseRichText } from "@/lib/rich-text";

function separateLegacyParagraphs(text: string) {
  if (parseRichText(text) || text.includes("\n") || text.length < 420) return text;

  const sentences = text.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g);
  if (!sentences || sentences.length < 3) return text;

  const paragraphs: string[] = [];
  let paragraph = "";
  for (const sentence of sentences) {
    const next = `${paragraph}${sentence}`.trim();
    if (paragraph && next.length > 420) {
      paragraphs.push(paragraph);
      paragraph = sentence.trim();
    } else {
      paragraph = next;
    }
  }
  if (paragraph) paragraphs.push(paragraph);
  return paragraphs.join("\n\n");
}

/** Read rich content as authored; give older unstructured text sensible paragraphs. */
export function StructuredText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <Brief
      text={separateLegacyParagraphs(text)}
      className={`mt-2 text-sm ${className ?? ""}`}
    />
  );
}
