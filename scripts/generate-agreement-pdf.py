"""
Generate the Talent Partner Agreement v2 PDF from the markdown source.

Strips the editorial front-matter (everything before the first '---'
divider, which is drafting notes for Jamar) and renders the agreement
body in a v1-matching visual style:
  - Small "FUTURE MODERN" header top-left
  - Pink/magenta title
  - Serif-free body, comfortable line-height
  - "FUTURE modern" wordmark footer

Output: docs/talent-partner-agreement-v2.pdf
"""
from pathlib import Path
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, black
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, KeepTogether,
)
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "docs" / "loi-talent-partner-v2.md"
OUT = ROOT / "docs" / "talent-partner-agreement-v2.pdf"

PINK = HexColor("#E91E63")   # Approximates the v1 magenta title
FM_BLUE = HexColor("#3A2D82")  # Backup accent

styles = getSampleStyleSheet()

TITLE = ParagraphStyle(
    "AgreementTitle",
    parent=styles["Title"],
    fontName="Helvetica-Bold",
    fontSize=28,
    leading=32,
    textColor=PINK,
    alignment=TA_LEFT,
    spaceAfter=14,
)
EYEBROW = ParagraphStyle(
    "Eyebrow",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=9,
    textColor=black,
    spaceAfter=6,
    letterSpacing=1,
)
BODY = ParagraphStyle(
    "Body",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=10.5,
    leading=15,
    textColor=black,
    spaceAfter=10,
)
BODY_BOLD = ParagraphStyle(
    "BodyBold",
    parent=BODY,
    fontName="Helvetica-Bold",
)
SECTION_HEAD = ParagraphStyle(
    "SectionHead",
    parent=styles["Heading2"],
    fontName="Helvetica-Bold",
    fontSize=13,
    leading=16,
    textColor=black,
    spaceBefore=14,
    spaceAfter=8,
)
BULLET = ParagraphStyle(
    "Bullet",
    parent=BODY,
    leftIndent=18,
    bulletIndent=6,
    spaceAfter=6,
)
SIG_LABEL = ParagraphStyle(
    "SigLabel",
    parent=BODY,
    fontName="Helvetica-Bold",
    spaceAfter=4,
)


def load_agreement_body(src: Path) -> str:
    """Return only the contract body — everything after the first
    horizontal-rule divider in the markdown source.
    """
    raw = src.read_text(encoding="utf-8")
    # First '---' on its own line marks the end of the editorial front
    # matter and the start of the actual agreement text.
    parts = raw.split("\n---\n", 1)
    if len(parts) < 2:
        return raw
    return parts[1].strip()


def inline_bold(text: str) -> str:
    """Convert markdown **bold** to reportlab <b> tags. Leaves other
    markdown untouched — the agreement body is plain prose with only
    bold emphasis.
    """
    out, in_bold, i = [], False, 0
    while i < len(text):
        if text.startswith("**", i):
            out.append("</b>" if in_bold else "<b>")
            in_bold = not in_bold
            i += 2
        else:
            ch = text[i]
            if ch == "&":
                out.append("&amp;")
            elif ch == "<":
                out.append("&lt;")
            elif ch == ">":
                out.append("&gt;")
            else:
                out.append(ch)
            i += 1
    if in_bold:
        out.append("</b>")
    return "".join(out)


def render_blocks(body_md: str):
    """Split markdown into logical blocks and yield Platypus flowables.
    Handles headings (#), bullet lists (- ), and paragraphs.
    """
    lines = body_md.split("\n")
    i, n = 0, len(lines)
    while i < n:
        line = lines[i].rstrip()

        # Skip blank lines
        if not line.strip():
            i += 1
            continue

        # H1 — top title (FUTURE MODERN + title on next line)
        if line.startswith("# ") and not line.startswith("## "):
            heading = line[2:].strip()
            if heading == "FUTURE MODERN":
                yield Paragraph(inline_bold(heading), EYEBROW)
            else:
                yield Paragraph(inline_bold(heading), TITLE)
            i += 1
            continue

        # H2 — big section title
        if line.startswith("## "):
            yield Paragraph(inline_bold(line[3:].strip()), TITLE)
            i += 1
            continue

        # H3 — section head (e.g. "### 17. Conduct Standards")
        if line.startswith("### "):
            yield Paragraph(inline_bold(line[4:].strip()), SECTION_HEAD)
            i += 1
            continue

        # Bullet list — collect consecutive '- ' lines, joining
        # continuation lines that are indented.
        if line.startswith("- "):
            items = []
            while i < n and (
                lines[i].startswith("- ")
                or (lines[i].startswith("  ") and items)
            ):
                if lines[i].startswith("- "):
                    items.append(lines[i][2:].rstrip())
                else:
                    items[-1] += " " + lines[i].strip()
                i += 1
            for item in items:
                yield Paragraph(
                    "• " + inline_bold(item),
                    BULLET,
                )
            continue

        # Paragraph — collect until blank line or block boundary
        para = [line]
        i += 1
        while i < n and lines[i].strip() and not (
            lines[i].startswith("#")
            or lines[i].startswith("- ")
            or lines[i].startswith("## ")
            or lines[i].startswith("### ")
        ):
            para.append(lines[i].rstrip())
            i += 1
        para_text = " ".join(para).strip()
        if para_text:
            yield Paragraph(inline_bold(para_text), BODY)


def draw_footer(canvas_obj: canvas.Canvas, doc):
    """Simple centered 'FUTURE modern' wordmark on every page."""
    canvas_obj.saveState()
    canvas_obj.setFont("Helvetica-Bold", 9)
    canvas_obj.setFillColor(PINK)
    canvas_obj.drawCentredString(
        LETTER[0] / 2, 0.5 * inch, "FUTURE"
    )
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.setFillColor(black)
    canvas_obj.drawCentredString(
        LETTER[0] / 2, 0.35 * inch, "modern"
    )
    # Page number, right side
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.setFillColor(HexColor("#888888"))
    canvas_obj.drawRightString(
        LETTER[0] - 0.6 * inch, 0.5 * inch,
        f"Page {doc.page}",
    )
    canvas_obj.restoreState()


def main():
    body_md = load_agreement_body(SRC)
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=LETTER,
        leftMargin=0.9 * inch,
        rightMargin=0.9 * inch,
        topMargin=0.9 * inch,
        bottomMargin=0.9 * inch,
        title="Talent Partner Agreement v2 — Future Modern",
        author="Future Modern",
    )
    flowables = list(render_blocks(body_md))
    doc.build(
        flowables,
        onFirstPage=draw_footer,
        onLaterPages=draw_footer,
    )
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
