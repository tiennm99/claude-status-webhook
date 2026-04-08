const STATUS_API = "https://status.claude.com/api/v2/summary.json";

/**
 * Fetch all components from status.claude.com (excludes group-level entries)
 */
export async function fetchAllComponents() {
  const res = await fetch(STATUS_API);
  if (!res.ok) throw new Error(`Status API returned ${res.status}`);
  const data = await res.json();
  return data.components.filter((c) => !c.group);
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
 * Format a single component as HTML line
 */
export function formatComponentLine(component) {
  return `<b>${escapeHtml(component.name)}</b>: <code>${humanizeStatus(component.status)}</code>`;
}
