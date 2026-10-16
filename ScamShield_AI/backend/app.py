from pathlib import Path
from urllib.parse import urlsplit
import ipaddress
import re

from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

app = Flask(__name__)


@app.route("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:filename>")
def frontend_files(filename):
    return send_from_directory(FRONTEND_DIR, filename)


def inspect_url(value):
    if not isinstance(value, str):
        return {"error": "Please enter a website address."}

    raw = value.strip()

    if not raw:
        return {"error": "Please enter a website address."}
    if len(raw) > 2048:
        return {"error": "The URL is too long."}
    if re.search(r"\s", raw):
        return {"error": "The URL cannot contain spaces."}

    candidate = (
        raw if re.match(r"^https?://", raw, re.IGNORECASE)
        else "https://" + raw
    )

    try:
        parsed = urlsplit(candidate)
        hostname = parsed.hostname
        _ = parsed.port
    except ValueError:
        return {"error": "That URL format is not valid."}

    if parsed.scheme.lower() not in ("http", "https"):
        return {"error": "Use a URL beginning with HTTP or HTTPS."}
    if not hostname or "." not in hostname:
        return {"error": "Enter a complete domain, such as example.com."}
    if parsed.username is not None or parsed.password is not None:
        return {"error": "URLs containing embedded credentials are not allowed."}

    host = hostname.lower().rstrip(".")
    findings = []
    points = 0

    if parsed.scheme.lower() == "http":
        findings.append("Uses HTTP rather than encrypted HTTPS.")
        points += 2
    else:
        findings.append(
            "Uses HTTPS. Encryption does not prove that a website is legitimate."
        )

    if "xn--" in host:
        findings.append("Contains an internationalized domain label.")
        points += 2

    try:
        ipaddress.ip_address(host)
        is_ip = True
    except ValueError:
        is_ip = False

    if is_ip:
        findings.append("Uses an IP address instead of a conventional domain.")
        points += 2

    if not is_ip and len(host.split(".")) > 4:
        findings.append("Contains many subdomain levels.")
        points += 1

    if len(host) > 45:
        findings.append("Has an unusually long hostname.")
        points += 1

    if re.search(
        r"login|verify|secure|account|update|wallet|banking|payment",
        host,
        re.IGNORECASE,
    ):
        findings.append("Contains security- or account-related words in the hostname.")
        points += 1

    if re.search(
        r"login|verify|password|wallet|payment|account|signin|confirm",
        parsed.path + "?" + parsed.query,
        re.IGNORECASE,
    ):
        findings.append("The URL path or query references account access or payment.")
        points += 1

    if len(candidate) > 120:
        findings.append("The complete URL is unusually long.")
        points += 1

    if points >= 4:
        level = "high"
        title = "Multiple warning signals detected"
        description = (
            "This URL has several characteristics that deserve caution. "
            "Verify it independently before sharing sensitive information."
        )
        advice = (
            "Avoid signing in or making payments through this link. Visit the "
            "organisation's independently verified official website."
        )
    elif points >= 2:
        level = "warning"
        title = "Use caution with this URL"
        description = (
            "Some URL characteristics warrant a closer look. These signals "
            "alone cannot establish whether a website is fraudulent."
        )
        advice = (
            "Check the exact domain. Never share passwords, OTPs, or payment "
            "details with an unverified website."
        )
    else:
        level = "low"
        title = "Few structural warnings detected"
        description = (
            "The basic checks found few warning signals. This does not prove "
            "that the website is safe or trustworthy."
        )
        advice = (
            "Verify the domain independently. Phishing websites can also use HTTPS."
        )

    if not findings:
        findings.append("No basic URL warning signals were detected.")

    return {
        "level": level,
        "title": title,
        "description": description,
        "advice": advice,
        "findings": findings,
        "displayedURL": candidate,
        "score": points,
        "disclaimer": (
            "Rule-based prototype only; not a definitive phishing verdict."
        ),
    }


@app.route("/api/scan", methods=["POST"])
def scan_url():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Please send the URL as JSON."}), 400

    result = inspect_url(data.get("url", ""))

    if "error" in result:
        return jsonify(result), 400

    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True)