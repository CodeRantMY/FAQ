#!/usr/bin/env python3
"""Build static JavaScript data for the GitHub Pages FAQ app."""

from __future__ import annotations

import json
import subprocess
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "content" / "faqs"
ASSETS = ROOT / "assets" / "js"
POPULAR_JSON = ROOT / "analytics" / "popular.json"


def parse_front_matter(path: Path) -> tuple[dict[str, str], str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError(f"{path} is missing front matter")
    _, meta_text, body = text.split("---\n", 2)
    meta: dict[str, str] = {}
    for line in meta_text.splitlines():
        if not line.strip():
            continue
        key, value = line.split(":", 1)
        meta[key.strip()] = value.strip().strip('"')
    return meta, body.strip()


def get_last_edited_by(path: Path) -> str:
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%an", "--", path.relative_to(ROOT).as_posix()],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError:
        return ""
    return result.stdout.strip()


def main() -> None:
    faqs = []
    category_counts: Counter[tuple[str, str]] = Counter()

    for path in sorted(CONTENT.glob("*/*.md")):
        if path.name == "README.md":
            continue
        meta, body = parse_front_matter(path)
        relative_path = path.relative_to(ROOT).as_posix()
        item = {
            "id": meta["id"],
            "title": meta["title"],
            "category": meta["category"],
            "categorySlug": meta["category_slug"],
            "status": meta["status"],
            "lastUpdated": meta.get("last_updated", ""),
            "lastEditedBy": get_last_edited_by(path),
            "source": meta.get("source", ""),
            "path": relative_path,
            "body": body,
        }
        faqs.append(item)
        category_counts[(item["categorySlug"], item["category"])] += 1

    categories = [
        {"slug": slug, "title": title, "count": count}
        for (slug, title), count in sorted(category_counts.items(), key=lambda pair: pair[0][1])
    ]

    popular = []
    if POPULAR_JSON.exists():
        popular_payload = json.loads(POPULAR_JSON.read_text(encoding="utf-8"))
        popular = popular_payload.get("items", [])

    ASSETS.mkdir(parents=True, exist_ok=True)
    (ASSETS / "faqs-data.js").write_text(
        "window.FAQ_DATA = "
        + json.dumps(faqs, ensure_ascii=False, indent=2)
        + ";\nwindow.CATEGORY_DATA = "
        + json.dumps(categories, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    (ASSETS / "popular-data.js").write_text(
        "window.POPULAR_FAQ_DATA = " + json.dumps(popular, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    build_markdown_indexes(faqs, categories)


def build_markdown_indexes(faqs: list[dict[str, str]], categories: list[dict[str, str]]) -> None:
    for category in categories:
        category_dir = CONTENT / category["slug"]
        items = [faq for faq in faqs if faq["categorySlug"] == category["slug"]]
        lines = [f"# {category['title']}", ""]
        lines.extend(f"- [{faq['title']}]({Path(faq['path']).name})" for faq in sorted(items, key=lambda item: item["title"].lower()))
        (category_dir / "README.md").write_text("\n".join(lines).strip() + "\n", encoding="utf-8")

    index_lines = ["# CodeRant FAQ Content", ""]
    for category in categories:
        index_lines.extend(
            [
                f"## {category['title']}",
                f"- [Browse {category['title']}](faqs/{category['slug']}/README.md)",
                "",
            ]
        )
    (ROOT / "content" / "README.md").write_text("\n".join(index_lines).strip() + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
