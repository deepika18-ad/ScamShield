const form = document.getElementById("scanForm");
const input = document.getElementById("urlInput");
const loading = document.getElementById("loadingPanel");
const results = document.getElementById("results");
const scanButton = document.getElementById("scanButton");
const buttonText = document.getElementById("buttonText");

document.querySelectorAll(".example-chip").forEach((button) => {
  button.addEventListener("click", () => {
    input.value = button.dataset.url || "";
    input.focus();
  });
});

async function scanWithBackend(value) {
  const response = await fetch("/api/scan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ url: value })
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

function displayReport(report) {
  document.getElementById("resultTitle").textContent = report.title;
  document.getElementById("resultDescription").textContent =
    report.description;
  document.getElementById("resultUrl").textContent = report.displayedURL;
  document.getElementById("safetyAdvice").textContent = report.advice;

  const badge = document.getElementById("riskBadge");
  badge.className = `risk-badge ${report.level}`;

  const badgeLabels = {
    high: "HIGH CAUTION",
    warning: "REVIEW URL",
    low: "FEW WARNINGS"
  };

  badge.textContent = badgeLabels[report.level] || "SCAN COMPLETE";

  const list = document.getElementById("findingList");
  list.replaceChildren();

  const findings = Array.isArray(report.findings)
    ? report.findings
    : ["No additional findings were returned."];

  findings.forEach((finding) => {
    const item = document.createElement("li");
    item.textContent = finding;
    list.appendChild(item);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

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
    results.hidden = true;
    alert(error.message || "Unable to inspect this URL.");
  } finally {
    scanButton.disabled = false;
    buttonText.textContent = "Analyse URL";
  }
});

document.getElementById("resetButton").addEventListener("click", () => {
  input.value = "";
  results.hidden = true;
  input.focus();

  document.getElementById("scanner").scrollIntoView({
    behavior: "smooth"
  });
});