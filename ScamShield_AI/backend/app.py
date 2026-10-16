
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

    def flag(message, weight):
        nonlocal points
        findings.append({"message": message, "points": weight})
        points += weight

    if parsed.scheme.lower() == "http":
        flag("Uses HTTP instead of encrypted HTTPS.", 15)
    else:
        findings.append({
            "message": (
                "Uses HTTPS. Encryption does not prove that a website "
                "is legitimate."
            ),
            "points": 0,
        })

    if "xn--" in host:
        flag("Contains an internationalized domain label that deserves review.", 20)

    try:
        ipaddress.ip_address(host)
        is_ip = True
    except ValueError:
        is_ip = False

    if is_ip:
        flag("Uses an IP address instead of a conventional domain.", 20)

    if not is_ip and len(host.split(".")) > 4:
        flag("Contains many subdomain levels.", 10)

    if len(host) > 45:
        flag("Has an unusually long hostname.", 10)

    if re.search(
        r"login|verify|secure|account|update|wallet|banking|payment",
        host,
        re.IGNORECASE,
    ):
        flag(
            "Contains account- or security-related words in the hostname.",
            15,
        )

    if re.search(
        r"login|verify|password|wallet|payment|account|signin|confirm",
        parsed.path + "?" + parsed.query,
        re.IGNORECASE,
    ):
        flag(
            "The URL path or query references account access or payment.",
            10,
        )

    if len(candidate) > 120:
        flag("The complete URL is unusually long.", 10)

    score = min(points, 100)

    if score >= 60:
        level = "high"
        title = "High Risk Indicators"
        description = (
            "Several URL warning signals were detected. Treat this link "
            "with caution and verify it independently."
        )
        advice = (
            "Avoid entering passwords, OTPs, or payment details. Visit the "
            "organisation's verified website directly."
        )
    elif score >= 30:
        level = "warning"
        title = "Suspicious URL Indicators"
        description = (
            "This URL has warning signals that need review. These checks "
            "cannot confirm whether the website is fraudulent."
        )
        advice = (
            "Check the exact domain and verify the sender before interacting "
            "with the website."
        )
    else:
        level = "low"
        title = "Few Structural Warnings"
        description = (
            "The basic checks found relatively few warning signals. "
            "This does not establish that the website is safe."
        )
        advice = (
            "Verify the domain independently. Phishing websites can also "
            "use HTTPS."
        )

    if not findings:
        findings.append({
            "message": "No basic URL warning signals were detected.",
            "points": 0,
        })

    return {
        "level": level,
        "title": title,
        "description": description,
        "advice": advice,
        "findings": findings,
        "displayedURL": candidate,
        "score": score,
        "maxScore": 100,
        "disclaimer": (
            "Rule-based prototype. This score reflects URL characteristics, "
            "not a verified probability of phishing."
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
