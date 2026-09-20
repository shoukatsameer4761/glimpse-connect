#!/usr/bin/env python3
"""Static tripwires for this repository; never import or execute scanned files.

This is not an antivirus engine. Review executable changes and run the other CI
checks too. Historical incident blobs remain in Git as evidence; CI scans the
proposed tree, while --ref allows read-only inspection of older trees.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

KNOWN_BAD = {
    "e99edcfa4e4190c92e77870ff2a93aa11d866c6806931fbf5d31995384bfb4bb",
    "c98f2703db7e8b73b296e686cc8dee89d1b1643a90c3e89ef90b6a75805421aa",
    "e090e83de497d1f553643b004ec6afa9bde0dedf96a64ef7062cac513017ab7c",
    "c5543cb8492b2121efc6c53920612678463a582c516dc352f7ddb3f7762afafa",
    "800b4a091d2259e76f144d28bc008efe9d53ef7a4c41557e25c8237c01e32509",
    "11915bd04afa9bd30b81c5ea8b933d4853bb9d3c0ef2278cb9ee72b41154f6e1",
    "0e66363bf151d3abcfe055c8d041741da77e0312635d68d1469a5bde8fd8017b",
    "9a91da5ef1b4bdcde45ba70d7b209ca644f5910cf739769c0e750597537f2750",
}
SOURCE = {".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx", ".html", ".svg"}
MAGIC = {".woff2": (b"wOF2",), ".woff": (b"wOFF",),
         ".ttf": (b"\x00\x01\x00\x00", b"true"), ".otf": (b"OTTO",)}
PATTERNS = {
    "hex-obfuscated JavaScript": rb"\b_0x[0-9a-fA-F]{4,}\b",
    "private key": rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    "GitHub token": rb"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{60,})\b",
    "AWS access key": rb"\bAKIA[0-9A-Z]{16}\b",
}


def inspect_file(name, data):
    findings = []
    suffix = Path(name).suffix.lower()
    if hashlib.sha256(data).hexdigest() in KNOWN_BAD:
        findings.append("known incident payload")
    for label, pattern in PATTERNS.items():
        if re.search(pattern, data):
            findings.append(label)
    for token in re.findall(rb"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", data):
        try:
            payload = token.split(b".")[1]
            claims = json.loads(base64.urlsafe_b64decode(payload + b"=" * (-len(payload) % 4)))
            if isinstance(claims, dict) and claims.get("role") == "service_role":
                findings.append("privileged Supabase service-role token")
        except (ValueError, UnicodeDecodeError):
            pass
    if suffix in MAGIC and not data.startswith(MAGIC[suffix]):
        findings.append("font extension does not match file signature")
    if suffix in SOURCE:
        if re.search(rb"\beval\s*\(|\bnew\s+Function\s*\(", data):
            findings.append("dynamic code execution requires security review")
        if re.search(rb"(?:node:)?child_process|\bcreateRequire\b", data):
            findings.append("process/module loader requires security review")
        if any(len(line) > 4000 for line in data.splitlines()) and suffix != ".svg":
            findings.append("unexpected minified/hidden code in source")
    if name == "package.json":
        manifest = json.loads(data)
        for script in manifest.get("scripts", {}):
            if script in {"preinstall", "install", "postinstall", "prepare", "prepublish", "prepublishOnly"}:
                findings.append("unapproved root lifecycle script: " + script)
    if name == "package-lock.json":
        lock = json.loads(data)
        for package, spec in lock.get("packages", {}).items():
            if not package:
                continue
            url = spec.get("resolved", "")
            if not url.startswith("https://registry.npmjs.org/") or not spec.get("integrity"):
                findings.append("dependency must have npm registry URL and integrity: " + package)
    return findings


def files_at_ref(ref):
    tree = subprocess.check_output(["git", "ls-tree", "-rz", ref])
    for entry in tree.split(b"\0"):
        if not entry:
            continue
        metadata, name = entry.split(b"\t", 1)
        mode, kind, oid = metadata.split()
        if kind != b"blob" or mode == b"120000":
            raise ValueError("Unreviewed symlink/submodule: " + name.decode())
        yield name.decode(), subprocess.check_output(["git", "cat-file", "blob", oid.decode()])


def working_files(root):
    names = subprocess.check_output(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], cwd=root)
    for name in sorted(set(names.decode().split("\0")) - {""}):
        path = root / name
        if path.is_symlink():
            raise ValueError("Unreviewed symlink: " + name)
        if path.is_file():
            yield name, path.read_bytes()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ref", help="Inspect a Git tree without checking it out")
    args = parser.parse_args()
    root = Path(subprocess.check_output(["git", "rev-parse", "--show-toplevel"]).decode().strip())
    failed = False
    count = 0
    try:
        files = files_at_ref(args.ref) if args.ref else working_files(root)
        for name, data in files:
            count += 1
            for finding in inspect_file(name, data):
                # Report locations/categories only, never matching secret contents.
                print(f"{name}: {finding}")
                failed = True
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f"Scan failed: {error}", file=sys.stderr)
        return 1
    print(f"Scanned {count} files; {'FAIL' if failed else 'PASS'} (static tripwires only)")
    return int(failed)


if __name__ == "__main__":
    sys.exit(main())
