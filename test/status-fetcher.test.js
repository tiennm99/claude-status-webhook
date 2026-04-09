import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  humanizeStatus,
  statusIndicator,
  formatComponentLine,
  formatOverallStatus,
} from "../src/status-fetcher.js";

describe("escapeHtml", () => {
  it("escapes HTML special chars", () => {
    expect(escapeHtml('<script>"alert&"</script>')).toBe(
      "&lt;script&gt;&quot;alert&amp;&quot;&lt;/script&gt;"
    );
  });

  it("returns empty string for null/undefined", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("humanizeStatus", () => {
  it("maps known statuses", () => {
    expect(humanizeStatus("operational")).toBe("Operational");
    expect(humanizeStatus("major_outage")).toBe("Major Outage");
    expect(humanizeStatus("resolved")).toBe("Resolved");
  });

  it("returns raw string for unknown status", () => {
    expect(humanizeStatus("custom_status")).toBe("custom_status");
  });
});

describe("statusIndicator", () => {
  it("returns green check for operational", () => {
    expect(statusIndicator("operational")).toBe("\u2705");
  });

  it("returns question mark for unknown", () => {
    expect(statusIndicator("unknown_status")).toBe("\u2753");
  });
});

describe("formatComponentLine", () => {
  it("formats component with indicator and escaped name", () => {
    const line = formatComponentLine({ name: "API", status: "operational" });
    expect(line).toContain("\u2705");
    expect(line).toContain("<b>API</b>");
    expect(line).toContain("Operational");
  });
});

describe("formatOverallStatus", () => {
  it("maps known indicators", () => {
    expect(formatOverallStatus("none")).toContain("All Systems Operational");
    expect(formatOverallStatus("critical")).toContain("Critical System Outage");
  });

  it("returns raw value for unknown indicator", () => {
    expect(formatOverallStatus("custom")).toBe("custom");
  });
});
