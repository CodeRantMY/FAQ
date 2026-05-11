#!/usr/bin/env python3
"""Build static video data from the public CodeRant YouTube RSS feed."""

from __future__ import annotations

import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "js"
CACHE = ROOT / "scripts" / ".cache" / "coderant-youtube.xml"
CHANNEL_ID = "UCooQSxf0Bn5hm5K4lvFEVHw"
FEED_URL = f"https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}"

ATOM = "{http://www.w3.org/2005/Atom}"
YT = "{http://www.youtube.com/xml/schemas/2015}"
MEDIA = "{http://search.yahoo.com/mrss/}"


def text_or_empty(element: ET.Element | None) -> str:
    return (element.text or "").strip() if element is not None else ""


def clean_description(value: str) -> str:
    value = re.sub(r"\s+", " ", value).strip()
    return value[:220] + "..." if len(value) > 220 else value


def fetch_feed() -> bytes:
    request = urllib.request.Request(
        FEED_URL,
        headers={"User-Agent": "CodeRant FAQ video builder"},
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.read()
    except OSError:
        if CACHE.exists():
            return CACHE.read_bytes()
        raise


def main() -> None:
    try:
        root = ET.fromstring(fetch_feed())
    except OSError:
        if (ASSETS / "videos-data.js").exists():
            print("Could not refresh YouTube feed; keeping existing videos-data.js.")
            return
        raise
    videos = []

    for entry in root.findall(f"{ATOM}entry"):
        video_id = text_or_empty(entry.find(f"{YT}videoId"))
        media_group = entry.find(f"{MEDIA}group")
        thumbnail = ""
        description = ""
        views = ""

        if media_group is not None:
            thumb_el = media_group.find(f"{MEDIA}thumbnail")
            if thumb_el is not None:
                thumbnail = thumb_el.attrib.get("url", "")
            description = clean_description(text_or_empty(media_group.find(f"{MEDIA}description")))
            stats = media_group.find(f"{MEDIA}community/{MEDIA}statistics")
            if stats is not None:
                views = stats.attrib.get("views", "")

        videos.append(
            {
                "id": video_id,
                "title": text_or_empty(entry.find(f"{ATOM}title")),
                "url": f"https://www.youtube.com/watch?v={video_id}",
                "published": text_or_empty(entry.find(f"{ATOM}published"))[:10],
                "updated": text_or_empty(entry.find(f"{ATOM}updated"))[:10],
                "thumbnail": thumbnail,
                "description": description,
                "views": views,
            }
        )

    ASSETS.mkdir(parents=True, exist_ok=True)
    (ASSETS / "videos-data.js").write_text(
        "window.VIDEO_DATA = " + json.dumps(videos, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
