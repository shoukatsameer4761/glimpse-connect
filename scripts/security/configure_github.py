#!/usr/bin/env python3
"""Apply the reviewed rulesets using the repository owner's GitHub login."""
import json
from pathlib import Path
import subprocess
import sys

REPO = "Sameer447/glimpse-connect"
OWNER_ID = 83346009
ROOT = Path(__file__).resolve().parents[2]


def api(endpoint, method="GET", payload=None):
    command = ["gh", "api", "--method", method, endpoint]
    if payload is not None:
        command += ["--input", "-"]
    result = subprocess.run(command, input=json.dumps(payload) if payload is not None else None,
                            text=True, capture_output=True, check=True)
    return json.loads(result.stdout) if result.stdout.strip() else None


def main():
    user = api("user")
    repo = api("repos/" + REPO)
    if (user["id"] != OWNER_ID or repo["owner"]["id"] != OWNER_ID
            or repo["owner"]["type"] != "User" or not repo["permissions"]["admin"]):
        raise RuntimeError("Authenticate gh as repository owner Sameer447 with Administration write permission.")
    endpoint = f"repos/{REPO}/rulesets"
    existing = api(endpoint + "?per_page=100")
    for filename in ["main-owner.json", "main-checks.json"]:
        desired = json.loads((ROOT / ".github/rulesets" / filename).read_text())
        matches = [rule for rule in existing if rule["name"] == desired["name"]]
        if len(matches) > 1:
            raise RuntimeError("Duplicate named rulesets; review them in GitHub settings first.")
        target = endpoint + f'/{matches[0]["id"]}' if matches else endpoint
        result = api(target, "PUT" if matches else "POST", desired)
        # Read back the server state; a local JSON file does not enable protection.
        actual = api(endpoint + f'/{result["id"]}')
        if actual["enforcement"] != "active" or actual["conditions"] != desired["conditions"]:
            raise RuntimeError("Ruleset verification failed: " + desired["name"])
        if actual.get("bypass_actors", []) != desired["bypass_actors"]:
            raise RuntimeError("Unexpected bypass actors: " + desired["name"])
        for rule in desired["rules"]:
            match = next((item for item in actual["rules"] if item["type"] == rule["type"]), None)
            if match is None or any(match.get("parameters", {}).get(key) != value
                                    for key, value in rule.get("parameters", {}).items()):
                raise RuntimeError("Rule verification failed: " + rule["type"])
        print("Active:", actual["name"], result.get("_links", {}).get("html", {}).get("href", ""))
    api(f"repos/{REPO}/actions/permissions/workflow", "PUT", {
        "default_workflow_permissions": "read", "can_approve_pull_request_reviews": False,
    })
    api(f"repos/{REPO}/actions/permissions/fork-pr-contributor-approval", "PUT", {
        "approval_policy": "all_external_contributors",
    })
    api(f"repos/{REPO}", "PATCH", {"security_and_analysis": {
        "secret_scanning": {"status": "enabled"},
        "secret_scanning_push_protection": {"status": "enabled"},
    }})
    api(f"repos/{REPO}/vulnerability-alerts", "PUT")
    api(f"repos/{REPO}/automated-security-fixes", "PUT")
    print("Verified owner exception and active main rules. Actions tokens default to read-only.")


if __name__ == "__main__":
    try:
        main()
    except (subprocess.CalledProcessError, RuntimeError) as error:
        print(getattr(error, "stderr", None) or str(error), file=sys.stderr)
        sys.exit(1)
