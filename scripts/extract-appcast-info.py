#!/usr/bin/env python3
"""Extract publish fields from the newest item in a Sparkle appcast."""

from __future__ import annotations

import shlex
import sys
import xml.etree.ElementTree as ET


SPARKLE_NS = "http://www.andymatuschak.org/xml-namespaces/sparkle"


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def fail(message: str) -> None:
    raise SystemExit(message)


def main() -> int:
    if len(sys.argv) != 2:
        fail("usage: extract-appcast-info.py APPCAST_XML")

    root = ET.parse(sys.argv[1]).getroot()
    channel = next((child for child in root if local_name(child.tag) == "channel"), None)
    if channel is None:
        fail("missing appcast channel")

    item = next((child for child in channel if local_name(child.tag) == "item"), None)
    if item is None:
        fail("missing appcast item")

    def sparkle_text(name: str) -> str:
        node = next(
            (
                child
                for child in item
                if local_name(child.tag) == name
                and child.tag.startswith("{" + SPARKLE_NS + "}")
            ),
            None,
        )
        if node is None or not (node.text or "").strip():
            fail("missing sparkle:" + name)
        return node.text.strip()

    enclosure = next((child for child in item if local_name(child.tag) == "enclosure"), None)
    if enclosure is None:
        fail("missing enclosure")

    signature = enclosure.attrib.get("{" + SPARKLE_NS + "}edSignature", "")
    if not signature:
        fail("missing sparkle:edSignature")

    values = {
        "APPCAST_VERSION": sparkle_text("shortVersionString"),
        "APPCAST_BUILD": sparkle_text("version"),
        "APPCAST_SIGNATURE": signature,
    }
    for key, value in values.items():
        print(f"{key}={shlex.quote(value)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
