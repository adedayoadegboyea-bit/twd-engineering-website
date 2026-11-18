"""Deploy the Marketplace backend through the Apps Script API."""
import json
import os
import subprocess
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

SOURCE = "marketplace-backend/TWD_MARKETPLACE_CODE_EMAIL_VERIFICATION_LINK_READY.gs"
SCRIPT_FILE = "TW&D"


def request(url, *, method="GET", data=None, headers=None):
    try:
        with urlopen(Request(url, data=data, method=method, headers=headers or {}), timeout=60) as response:
            return json.load(response)
    except HTTPError as error:
        raise SystemExit(f"{method} to Google failed with HTTP {error.code}. Check Apps Script API access and OAuth permissions.")


def normalize(source):
    return source.replace("\r\n", "\n").rstrip("\n")


def project_files(project):
    return [
        {key: file[key] for key in ("name", "type", "source")}
        for file in project["files"]
    ]


def run():
    credentials = json.loads(os.environ["MARKETPLACE_GOOGLE_OAUTH"])
    token = request(
        "https://oauth2.googleapis.com/token",
        method="POST",
        data=urlencode({
            "grant_type": "refresh_token",
            **{key: credentials[key] for key in ("client_id", "client_secret", "refresh_token")},
        }).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )["access_token"]
    project_url = "https://script.googleapis.com/v1/projects/" + quote(os.environ["MARKETPLACE_SCRIPT_ID"], safe="")
    deployment_path = "/deployments/" + quote(os.environ["MARKETPLACE_DEPLOYMENT_ID"], safe="")

    def api(path, method="GET", body=None):
        return request(
            project_url + path,
            method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
        )

    deployment = api(deployment_path)["deploymentConfig"]
    published_files = project_files(api("/content?versionNumber=" + str(deployment["versionNumber"])))
    current_files = project_files(api("/content"))
    published_backend = next(file for file in published_files if file["name"] == SCRIPT_FILE and file["type"] == "SERVER_JS")
    current_backend = next(file for file in current_files if file["name"] == SCRIPT_FILE and file["type"] == "SERVER_JS")
    desired = Path(SOURCE).read_text(encoding="utf-8")
    current_other_files = sorted((file for file in current_files if file is not current_backend), key=lambda file: file["name"])
    published_other_files = sorted((file for file in published_files if file is not published_backend), key=lambda file: file["name"])
    current_source = normalize(current_backend["source"])
    published_source = normalize(published_backend["source"])
    if current_other_files != published_other_files or current_source not in (published_source, normalize(desired)):
        raise SystemExit("The Apps Script editor has unpublished changes. Reconcile them with the deployed version before continuing.")

    before = os.environ.get("GIT_BEFORE")
    if normalize(desired) == normalize(published_backend["source"]):
        print("The GitHub backend matches the existing Marketplace deployment.")
        return
    if not before:
        raise SystemExit("The GitHub backend differs from the live script. Import the live TW&D.gs as the baseline before enabling automatic deployment.")
    previous = subprocess.check_output(["git", "show", f"{before}:{SOURCE}"], text=True)
    if normalize(previous) != normalize(published_backend["source"]):
        raise SystemExit("The previous GitHub backend differs from the deployed script. Reconcile the baseline before deploying.")

    if current_source != normalize(desired):
        current_backend["source"] = desired
        api("/content", "PUT", {"files": current_files})
    sha = os.environ["GITHUB_SHA"]
    version = api("/versions", "POST", {"description": "GitHub " + sha})["versionNumber"]
    deployment["versionNumber"] = version
    api(deployment_path, "PUT", {"deploymentConfig": deployment})
    if api(deployment_path)["deploymentConfig"]["versionNumber"] != version:
        raise SystemExit("Google did not confirm the expected Marketplace version.")
    print(f"Updated the existing Marketplace web app to Apps Script version {version}.")


if __name__ == "__main__":
    run()
