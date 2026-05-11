#!/usr/bin/env python3
"""Import the original FAQ draft into one Markdown file per FAQ."""

from __future__ import annotations

import re
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DRAFT = ROOT / "FAQs_ CodeRant [Draft].md"
OUT = ROOT / "content" / "faqs"

CATEGORY_TITLES = {
    "Birth/Certificates": ("birth-certificates", "Birth / Certificates"),
    "Jobs/Taxes": ("jobs-taxes", "Jobs / Taxes"),
    "Food / Living": ("food-living", "Food / Living"),
    "Passport/VISA/ Travel": ("passport-visa-travel", "Passport, Visa & Travel"),
    "Unanswered": ("unanswered", "Unanswered"),
}

GROUPING_HEADINGS = {"Bank / Money"}


def slugify(value: str) -> str:
    value = value.lower()
    value = value.replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    return value or "faq"


def clean_title(value: str) -> str:
    value = re.sub(r"^#+\s*", "", value.strip())
    return re.sub(r"\s+", " ", value).replace("\\", "")


def extract_last_updated(body: str) -> str:
    match = re.search(r"Last Updated:\s*(\d{2})\.(\d{2})\.(\d{4})", body, re.IGNORECASE)
    if not match:
        return "2026-05-11"
    day, month, year = match.groups()
    return f"{year}-{month}-{day}"


def write_faq(
    *,
    title: str,
    body_lines: list[str],
    category_slug: str,
    category: str,
    used_ids: set[str],
    source: str = DRAFT.name,
) -> None:
    title = clean_title(title)
    if not title:
        return

    body = "\n".join(body_lines).strip()
    last_updated = extract_last_updated(body)
    status = "answered" if body else "needs-answer"
    if category_slug == "unanswered":
        status = "needs-review" if body else "needs-answer"

    base_id = f"{category_slug}-{slugify(title)}"
    faq_id = base_id
    suffix = 2
    while faq_id in used_ids:
        faq_id = f"{base_id}-{suffix}"
        suffix += 1
    used_ids.add(faq_id)

    target_dir = OUT / category_slug
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{slugify(title)}.md"

    target.write_text(
        "\n".join(
            [
                "---",
                f'id: "{faq_id}"',
                f'title: "{title.replace(chr(34), chr(39))}"',
                f'category: "{category}"',
                f'category_slug: "{category_slug}"',
                f'status: "{status}"',
                f'last_updated: "{last_updated}"',
                f'source: "{source}"',
                "---",
                "",
                body or "_This FAQ needs an answer._",
                "",
            ]
        ),
        encoding="utf-8",
    )


def build_category_indexes() -> None:
    for category_dir in sorted(OUT.iterdir()):
        if not category_dir.is_dir():
            continue
        files = sorted(path for path in category_dir.glob("*.md") if path.name != "README.md")
        title = files[0].read_text(encoding="utf-8").split('category: "', 1)[1].split('"', 1)[0] if files else category_dir.name
        links = []
        for path in files:
            text = path.read_text(encoding="utf-8")
            faq_title = text.split('title: "', 1)[1].split('"', 1)[0]
            links.append(f"- [{faq_title}]({path.name})")
        (category_dir / "README.md").write_text(
            f"# {title}\n\n" + "\n".join(links) + "\n",
            encoding="utf-8",
        )


def build_content_index() -> None:
    sections = ["# CodeRant FAQ Content", ""]
    for category_dir in sorted(OUT.iterdir()):
        if not category_dir.is_dir():
            continue
        readme = category_dir / "README.md"
        title = readme.read_text(encoding="utf-8").splitlines()[0].removeprefix("# ")
        sections.extend([f"## {title}", f"- [Browse {title}](faqs/{category_dir.name}/README.md)", ""])
    (ROOT / "content" / "README.md").write_text("\n".join(sections).strip() + "\n", encoding="utf-8")


def main() -> None:
    text = DRAFT.read_text(encoding="utf-8")
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True, exist_ok=True)

    current_category_slug = ""
    current_category = ""
    current_title = ""
    current_body: list[str] = []
    used_ids: set[str] = set()
    preamble: list[str] = []

    def flush_current() -> None:
        nonlocal current_title, current_body
        if current_title:
            write_faq(
                title=current_title,
                body_lines=current_body,
                category_slug=current_category_slug,
                category=current_category,
                used_ids=used_ids,
            )
        current_title = ""
        current_body = []

    def flush_preamble() -> None:
        nonlocal preamble
        if preamble and current_category_slug:
            meaningful = [line for line in preamble if line.strip()]
            if meaningful:
                title = "Passport validity" if current_category_slug == "passport-visa-travel" else f"{current_category} overview"
                write_faq(
                    title=title,
                    body_lines=meaningful,
                    category_slug=current_category_slug,
                    category=current_category,
                    used_ids=used_ids,
                )
        preamble = []

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        top = re.match(r"^#\s+(.+)$", line)
        if top:
            flush_current()
            flush_preamble()
            current_category_slug, current_category = CATEGORY_TITLES[clean_title(top.group(1))]
            continue

        second = re.match(r"^##\s*(.*)$", line)
        if second:
            heading = clean_title(second.group(1))
            if heading in GROUPING_HEADINGS:
                flush_current()
                continue
            flush_preamble()
            flush_current()
            current_title = heading
            continue

        if current_title:
            current_body.append(line)
        elif current_category_slug:
            preamble.append(line)

    flush_current()
    flush_preamble()
    build_category_indexes()
    build_content_index()


if __name__ == "__main__":
    main()
