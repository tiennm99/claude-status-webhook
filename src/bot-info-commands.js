import {
  escapeHtml,
  fetchComponentByName,
  fetchSummary,
  fetchIncidents,
  formatComponentLine,
  formatOverallStatus,
  formatIncidentLine,
  statusIndicator,
  humanizeStatus,
  STATUS_URL,
} from "./status-fetcher.js";

/**
 * Register info commands: /help, /status, /history, /uptime
 */
export function registerInfoCommands(bot) {
  bot.command("help", async (ctx) => {
    await ctx.reply(
      `<b>Claude Status Bot — Help</b>\n\n` +
        `<b>/start</b>\n` +
        `Subscribe to Claude status notifications.\n` +
        `Default: incidents + component updates.\n\n` +
        `<b>/stop</b>\n` +
        `Unsubscribe from all notifications.\n\n` +
        `<b>/status</b> [component]\n` +
        `Show current status of all components.\n` +
        `Add a component name for a specific check.\n` +
        `Example: <code>/status api</code>\n\n` +
        `<b>/subscribe</b> &lt;type&gt; [component]\n` +
        `Set what notifications you receive.\n` +
        `Types: <code>incident</code>, <code>component</code>, <code>all</code>\n` +
        `Component filter: <code>/subscribe component api</code>\n` +
        `Clear filter: <code>/subscribe component all</code>\n` +
        `Example: <code>/subscribe incident</code>\n\n` +
        `<b>/history</b> [count]\n` +
        `Show recent incidents. Default: 5, max: 10.\n` +
        `Example: <code>/history 3</code>\n\n` +
        `<b>/uptime</b>\n` +
        `Show current component health overview.\n\n` +
        `<a href="${STATUS_URL}">status.claude.com</a>`,
      { parse_mode: "HTML", disable_web_page_preview: true }
    );
  });

  bot.command("status", async (ctx) => {
    const args = ctx.match?.trim();
    try {
      if (args) {
        const component = await fetchComponentByName(args);
        if (!component) {
          await ctx.reply(`Component "<code>${escapeHtml(args)}</code>" not found.`, { parse_mode: "HTML" });
          return;
        }
        await ctx.reply(formatComponentLine(component), { parse_mode: "HTML" });
      } else {
        const summary = await fetchSummary();
        const components = summary.components.filter((c) => !c.group);
        const overall = formatOverallStatus(summary.status.indicator);
        const lines = components.map(formatComponentLine);
        const updated = new Date(summary.page.updated_at).toLocaleString("en-US", {
          dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
        });
        await ctx.reply(
          `<b>${overall}</b>\n\n` +
            `${lines.join("\n")}\n\n` +
            `<i>Updated: ${updated} UTC</i>\n` +
            `<a href="${STATUS_URL}">View full status page</a>`,
          { parse_mode: "HTML", disable_web_page_preview: true }
        );
      }
    } catch (err) {
      console.error("status command error:", err);
      await ctx.reply("Unable to fetch status. Please try again later.");
    }
  });

  bot.command("history", async (ctx) => {
    const arg = ctx.match?.trim();
    const count = Math.min(Math.max(parseInt(arg, 10) || 5, 1), 10);
    try {
      const incidents = await fetchIncidents(count);
      if (incidents.length === 0) {
        await ctx.reply("No recent incidents found.", { parse_mode: "HTML" });
        return;
      }
      const lines = incidents.map(formatIncidentLine);
      await ctx.reply(
        `<b>Recent Incidents</b>\n\n` +
          `${lines.join("\n\n")}\n\n` +
          `<a href="${STATUS_URL}/history">View full history</a>`,
        { parse_mode: "HTML", disable_web_page_preview: true }
      );
    } catch (err) {
      console.error("history command error:", err);
      await ctx.reply("Unable to fetch incident history. Please try again later.");
    }
  });

  bot.command("uptime", async (ctx) => {
    try {
      const summary = await fetchSummary();
      const components = summary.components.filter((c) => !c.group);
      const overall = formatOverallStatus(summary.status.indicator);
      const lines = components.map((c) => {
        const indicator = statusIndicator(c.status);
        const upSince = new Date(c.updated_at).toLocaleString("en-US", {
          dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
        });
        return `${indicator} <b>${c.name}</b>\n   Status: <code>${humanizeStatus(c.status)}</code>\n   Last change: ${upSince} UTC`;
      });
      await ctx.reply(
        `<b>${overall}</b>\n\n` +
          `${lines.join("\n\n")}\n\n` +
          `<i>Uptime % not available via public API.</i>\n` +
          `<a href="${STATUS_URL}">View uptime on status page</a>`,
        { parse_mode: "HTML", disable_web_page_preview: true }
      );
    } catch (err) {
      console.error("uptime command error:", err);
      await ctx.reply("Unable to fetch uptime data. Please try again later.");
    }
  });
}
