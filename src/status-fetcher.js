const STATUS_URL = "https://status.claude.com";
const STATUS_API = `${STATUS_URL}/api/v2`;

export { STATUS_URL };

/**
 * Fetch all components from status.claude.com (excludes group-level entries)
 */
export async function fetchAllComponents() {
  const res = await fetch(`${STATUS_API}/summary.json`);
  if (!res.ok) throw new Error(`Status API returned ${res.status}`);
  const data = await res.json();
  return data.components.filter((c) => !c.group);
}

/**
 * Fetch summary including overall status indicator
 */
export async function fetchSummary() {
  const res = await fetch(`${STATUS_API}/summary.json`);
  if (!res.ok) throw new Error(`Status API returned ${res.status}`);
  return res.json();
}

/**
 * Fetch recent incidents (most recent first, up to limit)
 */
export async function fetchIncidents(limit = 5) {
  const res = await fetch(`${STATUS_API}/incidents.json`);
  if (!res.ok) throw new Error(`Status API returned ${res.status}`);
  const data = await res.json();
  return data.incidents.slice(0, limit);
}

/**
 * Fuzzy match a component by name (case-insensitive includes)
 */
export async function fetchComponentByName(name) {
  const components = await fetchAllComponents();
  return components.find((c) =>
    c.name.toLowerCase().includes(name.toLowerCase())
  );
}

/**
 * Human-readable status label
 */
export function humanizeStatus(status) {
  const map = {
    operational: "Operational",
    degraded_performance: "Degraded Performance",
    partial_outage: "Partial Outage",
    major_outage: "Major Outage",
    under_maintenance: "Under Maintenance",
    investigating: "Investigating",
    identified: "Identified",
    monitoring: "Monitoring",
    resolved: "Resolved",
  };
  return map[status] || status;
}

/**
 * Escape HTML special chars for Telegram's HTML parse mode
 */
export function escapeHtml(s) {
  return s?.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") ?? "";
}

/**
 * Status indicator dot for visual formatting
 */
export function statusIndicator(status) {
  const indicators = {
    operational: "\u2705",          // green check
    degraded_performance: "\u26A0\uFE0F", // warning
    partial_outage: "\uD83D\uDFE0",       // orange circle
    major_outage: "\uD83D\uDD34",         // red circle
    under_maintenance: "\uD83D\uDD27",    // wrench
  };
  return indicators[status] || "\u2753";   // question mark fallback
}

/**
 * Format a single component as HTML line with indicator
 */
export function formatComponentLine(component) {
  return `${statusIndicator(component.status)} <b>${escapeHtml(component.name)}</b> — <code>${humanizeStatus(component.status)}</code>`;
}

/**
 * Overall status indicator text
 */
export function formatOverallStatus(indicator) {
  const map = {
    none: "\u2705 All Systems Operational",
    minor: "\u26A0\uFE0F Minor System Issues",
    major: "\uD83D\uDFE0 Major System Issues",
    critical: "\uD83D\uDD34 Critical System Outage",
    maintenance: "\uD83D\uDD27 Maintenance In Progress",
  };
  return map[indicator] || indicator;
}

/**
 * Format a single incident for /history display
 */
export function formatIncidentLine(incident) {
  const impact = incident.impact?.toUpperCase() || "UNKNOWN";
  const date = new Date(incident.created_at).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
  const status = humanizeStatus(incident.status);
  let line = `${statusIndicator(incident.status === "resolved" ? "operational" : "major_outage")} `;
  line += `<b>[${impact}]</b> ${escapeHtml(incident.name)}\n`;
  line += `   ${date} — <code>${status}</code>`;
  if (incident.shortlink) {
    line += ` — <a href="${incident.shortlink}">Details</a>`;
  }
  return line;
}
