/**
 * renderResults.ts
 *
 * Turns an ExtractionResult into HTML markup for the results panel.
 * This is the "MeetingResultCard" / "MeetingResult" piece of the UI,
 * implemented as plain string templates (no framework needed) so it can
 * be swapped for React/Vue/etc. later without touching the parser.
 */
import type { ExtractionResult } from "./meetingLinkExtractor.ts";

const PLATFORM_EMOJI: Record<string, string> = {
  "microsoft-teams": "\u{1F4BC}", // 💼
  zoom: "\u{1F4F9}", // 📹
  "google-meet": "\u{1F3A5}", // 🎥
  webex: "\u{1F5A5}\uFE0F", // 🖥️
};

function platformEmoji(id: string): string {
  return PLATFORM_EMOJI[id] ?? "\u{1F517}"; // 🔗 fallback
}

/** Escapes text before it is interpolated into an HTML template. Every
 * value rendered here comes from user-pasted text, so this is not optional. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resultCard(url: string, platformId: string, platformLabel: string, prominent: boolean): string {
  const safeUrl = escapeHtml(url);
  return `
    <article class="result-card${prominent ? " result-card--prominent" : ""}" data-platform="${platformId}">
      <div class="result-card__header">
        <span class="platform-dot" data-platform="${platformId}" aria-hidden="true">${platformEmoji(platformId)}</span>
        <span class="result-card__platform">${escapeHtml(platformLabel)}</span>
      </div>
      <p class="result-card__url"><code>${safeUrl}</code></p>
      <div class="result-card__actions">
        <button type="button" class="btn btn--primary" data-action="copy" data-url="${safeUrl}">
          Copy link
        </button>
        <button type="button" class="btn btn--ghost" data-action="open" data-url="${safeUrl}">
          Open meeting
        </button>
      </div>
    </article>
  `;
}

function otherLinksSection(otherLinks: string[]): string {
  if (otherLinks.length === 0) return "";
  const items = otherLinks
    .map((url) => {
      const safeUrl = escapeHtml(url);
      return `<li><a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a></li>`;
    })
    .join("");
  return `
    <section class="other-links" aria-label="Other links found">
      <h2 class="other-links__title">Other links found</h2>
      <ul class="other-links__list">${items}</ul>
    </section>
  `;
}

/** The very first state, before the user has typed or pasted anything. */
export function emptyStateHtml(): string {
  return `
    <div class="state-message" data-state="empty">
      <span class="state-message__icon" aria-hidden="true">📋</span>
      <p>Paste a meeting invitation to get started.</p>
    </div>
  `;
}

/** Renders the full results panel for a given extraction + raw input. */
export function renderResultsHtml(result: ExtractionResult, hasInput: boolean): string {
  const { meetingLinks, otherLinks } = result;

  if (!hasInput) {
    return emptyStateHtml();
  }

  if (meetingLinks.length === 0) {
    return `
      <div class="state-message" data-state="none">
        <span class="state-message__icon" aria-hidden="true">🔍</span>
        <p><strong>No meeting link found.</strong></p>
        <p class="state-message__hint">Make sure you've pasted the complete meeting invitation.</p>
      </div>
      ${otherLinksSection(otherLinks)}
    `;
  }

  if (meetingLinks.length === 1) {
    const link = meetingLinks[0]!;
    return resultCard(link.url, link.platform.id, link.platform.label, true);
  }

  const copyAll = `
    <button type="button" class="btn btn--ghost btn--copy-all" data-action="copy-all">
      Copy all links
    </button>
  `;
  const cards = meetingLinks.map((link) => resultCard(link.url, link.platform.id, link.platform.label, false)).join("");

  return `
    <div class="result-cards">
      <div class="result-cards__toolbar">
        <span class="result-cards__count">${meetingLinks.length} meeting links found</span>
        ${copyAll}
      </div>
      ${cards}
    </div>
  `;
}
