const form = document.getElementById("scanForm");
const input = document.getElementById("urlInput");
const loading = document.getElementById("loadingPanel");
const results = document.getElementById("results");
const scanButton = document.getElementById("scanButton");
const buttonText = document.getElementById("buttonText");

// Add styling for the risk score display.
const scoreStyles = document.createElement("style");
scoreStyles.textContent = `
  .score-panel {
    margin: 24px 0;
    padding: 24px;
    border: 1px solid rgba(53, 255, 224, 0.22);
    border-radius: 18px;
    background: linear-gradient(135deg, rgba(12, 35, 55, .96), rgba(20, 22, 48, .96));
  }
  .score-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  .score-label {
    color: #b8c8da;
    font-size: 12px;
    letter-spacing: 1.5px;
    font-weight: 700;
  }
  .score-number {
    margin-top: 8px;
    color: #35ffe0;
    font-size: 38px;
    font-weight: 800;
    font-family: 'Space Grotesk', sans-serif;
  }
  .score-number small {
    color: #a5b4c8;
    font-size: 17px;
    font-weight: 500;
  }
  .score-level {
    display: inline-block;
    padding: 9px 13px;
    border-radius: 30px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: .7px;
  }
  .score-level.low {
    color: #62f5c5;
    background: rgba(30, 200, 140, .13);
  }
  .score-level.warning {
    color: #ffd166;
    background: rgba(255, 190, 50, .13);
  }
  .score-level.high {
    color: #ff8585;
    background: rgba(255, 70, 90, .14);
  }
  .score-track {
    width: 100%;
    height: 10px;
    margin-top: 18px;
    overflow: hidden;
    border-radius: 20px;
    background: rgba(255,255,255,.10);
  }
  .score-fill {
    height: 100%;
    width: 0;
    border-radius: inherit;
    transition: width .7s ease;
    background: #35ffe0;
  }
  .score-fill.warning {
    background: #ffd166;
  }
  .score-fill.high {
    background: #ff656f;
  }
  .score-caption {
    margin: 12px 0 0;
    color: #a5b4c8;
    font-size: 13px;
    line-height: 1.6;
  }
  .finding-points {
    display: inline-block;
    margin-left: 6px;
    color: #ffd166;
    font-size: 12px;
    font-weight: 700;
  }
  .finding-empty {
    color: #a5b4c8;
  }
`;
document.head.appendChild(scoreStyles);

// Create the score panel and place it in the existing results section.
const scorePanel = document.createElement("div");
scorePanel.className = "score-panel";
scorePanel.innerHTML = `
  <div class="score-top">
    <div>
      <div class="score-label">URL RISK SCORE</div>
      <div class="score-number" id="scoreNumber">--<small> / 100</small></div>
    </div>
    <div class="score-level low" id="scoreLevel">AWAITING SCAN</div>
  </div>
  <div
    class="score-track"
    role="progressbar"
    aria-label="URL risk score"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow="0"
    id="scoreProgress"
  >
    <div class="score-fill" id="scoreFill"></div>
  </div>
  <p class="score-caption" id="scoreCaption">
    Scan a URL to see its risk score.
  </p>
`;

const resultUrl = document.getElementById("resultUrl");
resultUrl.closest(".result-url").insertAdjacentElement("afterend", scorePanel);

// Fill example buttons when clicked.
document.querySelectorAll(".example-chip").forEach((button) => {
  button.addEventListener("click", () => {
    input.value = button.dataset.url || "";
    input.focus();
  });
});

// Send the URL to the Flask backend.
async function scanWithBackend(value) {
  const response = await fetch("/api/scan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ url: value.trim() })
  });

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("The server returned an unreadable response.");
  }

  if (!response.ok) {
    throw new Error(data.error || "The server could not scan this URL.");
  }

  return data;
}

// Display the score and risk level returned by the backend.
function displayScore(report) {
  const scoreNumber = document.getElementById("scoreNumber");
  const scoreLevel = document.getElementById("scoreLevel");
  const scoreFill = document.getElementById("scoreFill");
  const scoreProgress = document.getElementById("scoreProgress");
  const scoreCaption = document.getElementById("scoreCaption");

  const rawScore = Number(report.score);
  const score = Number.isFinite(rawScore)
    ? Math.max(0, Math.min(100, rawScore))
    : 0;

  const maxScore = Number(report.maxScore) || 100;
  const level = ["low", "warning", "high"].includes(report.level)
    ? report.level
    : score >= 60
      ? "high"
      : score >= 30
        ? "warning"
        : "low";

  const levelLabels = {
    low: "LOW RISK SIGNALS",
    warning: "CAUTION ADVISED",
    high: "HIGH CAUTION"
  };

  scoreNumber.textContent = String(score);

  const denominator = document.createElement("small");
  denominator.textContent = ` / ${maxScore}`;
  scoreNumber.appendChild(denominator);

  scoreLevel.className = `score-level ${level}`;
  scoreLevel.textContent = levelLabels[level];

  scoreFill.className = `score-fill ${level}`;
  scoreFill.style.width = `${score}%`;

  scoreProgress.setAttribute("aria-valuenow", String(score));
  scoreProgress.setAttribute(
    "aria-valuetext",
    `${score} out of ${maxScore}`
  );

  const captions = {
    low: "Few warning signals were detected. This does not guarantee that the website is safe.",
    warning: "Some warning signals were detected. Verify the website independently before proceeding.",
    high: "Multiple warning signals may indicate elevated risk. Avoid sharing sensitive information until verified."
  };

  scoreCaption.textContent = captions[level];
}

// Display the complete scan report.
function displayReport(report) {
  document.getElementById("resultTitle").textContent =
    report.title || "URL analysis";

  document.getElementById("resultDescription").textContent =
    report.description || "Review the findings below.";

  document.getElementById("resultUrl").textContent =
    report.displayedURL || input.value.trim();

  document.getElementById("safetyAdvice").textContent =
    report.advice || "Verify the domain independently before proceeding.";

  const badge = document.getElementById("riskBadge");
  badge.className = `risk-badge ${report.level || "low"}`;

  const badgeLabels = {
    high: "HIGH CAUTION",
    warning: "REVIEW URL",
    low: "FEW WARNINGS"
  };

  badge.textContent = badgeLabels[report.level] || "SCAN COMPLETE";

  // Show the numerical score and progress bar.
  displayScore(report);

  // Support both the new object format and the older string format.
  const list = document.getElementById("findingList");
  list.replaceChildren();

  const findings = Array.isArray(report.findings)
    ? report.findings
    : [];

  if (findings.length === 0) {
    const item = document.createElement("li");
    item.className = "finding-empty";
    item.textContent = "No additional findings were returned.";
    list.appendChild(item);
  } else {
    findings.forEach((finding) => {
      const item = document.createElement("li");

      if (typeof finding === "string") {
        item.textContent = finding;
      } else {
        item.appendChild(
          document.createTextNode(
            finding.message || "Warning signal detected"
          )
        );

        if (Number.isFinite(Number(finding.points))) {
          const points = document.createElement("span");
          points.className = "finding-points";
          points.textContent = `+${Number(finding.points)} points`;
          item.appendChild(points);
        }
      }

      list.appendChild(item);
    });
  }
}

// Handle URL scanning.
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!input.value.trim()) {
    input.focus();
    return;
  }

  results.hidden = true;
  loading.hidden = false;
  scanButton.disabled = true;
  buttonText.textContent = "Inspecting...";

  try {
    const report = await scanWithBackend(input.value);

    displayReport(report);

    loading.hidden = true;
    results.hidden = false;

    results.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  } catch (error) {
    loading.hidden = true;
    alert(error.message || "Unable to inspect this URL.");
  } finally {
    scanButton.disabled = false;
    buttonText.textContent = "Analyse URL";
  }
});

// Reset the scanner for another URL.
document.getElementById("resetButton").addEventListener("click", () => {
  input.value = "";
  results.hidden = true;
  input.focus();

  document.getElementById("scanner").scrollIntoView({
    behavior: "smooth"
  });
});
