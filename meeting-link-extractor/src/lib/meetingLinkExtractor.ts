/**
 * meetingLinkExtractor.ts
 *
 * Pure parsing logic for the Meeting Link Extractor.
 * No DOM access here — this module can run in the browser, in Node tests,
 * or anywhere else. All rendering/UI concerns live outside this file.
 */

/** A single platform detection rule. Add a new entry to PLATFORM_RULES to
 * support a new meeting provider — no other code needs to change. */
export interface PlatformRule {
  /** Stable machine-readable id, e.g. "microsoft-teams". Used for styling hooks. */
  id: string;
  /** Human-readable label shown in the UI, e.g. "Microsoft Teams". */
  label: string;
  /** Returns true when the given parsed URL belongs to this platform. */
  test: (url: URL) => boolean;
}

export interface ExtractedMeetingLink {
  url: string;
  platform: PlatformRule;
}

export interface ExtractionResult {
  /** Meeting links, in the order they first appeared, deduplicated. */
  meetingLinks: ExtractedMeetingLink[];
  /** Any other http(s) links found that did not match a known platform. */
  otherLinks: string[];
}

/**
 * Platform detection rules, ordered from most to least specific.
 * To support a new provider (GoTo Meeting, Whereby, Jitsi, RingCentral,
 * Slack Huddle, ...) just append a rule here.
 */
export const PLATFORM_RULES: PlatformRule[] = [
  {
    id: "microsoft-teams",
    label: "Microsoft Teams",
    test: (url) => isHost(url, "teams.microsoft.com") || isHost(url, "teams.live.com"),
  },
  {
    id: "zoom",
    label: "Zoom",
    test: (url) => isHost(url, "zoom.us"),
  },
  {
    id: "google-meet",
    label: "Google Meet",
    test: (url) => isHost(url, "meet.google.com"),
  },
  {
    id: "webex",
    label: "Cisco Webex",
    test: (url) => isHost(url, "webex.com"),
  },
];

/** True when `url`'s hostname is exactly `domain` or a subdomain of it. */
function isHost(url: URL, domain: string): boolean {
  const hostname = url.hostname.toLowerCase();
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/** Matches http(s) URLs, stopping at whitespace and characters that are
 * never part of a URL but commonly wrap one in prose (quotes, angle
 * brackets, backticks). Trailing punctuation is cleaned up separately. */
const URL_REGEX = /https?:\/\/[^\s<>"'“”‘’`]+/gi;

const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/** Decodes the small set of HTML entities that realistically show up when
 * someone pastes an HTML email or Outlook invite (e.g. "&amp;" in a Teams
 * deep link). Percent-encoding (%3F, %3D, ...) is left untouched. */
export function decodeHtmlEntities(input: string): string {
  let result = input.replace(
    /&amp;|&lt;|&gt;|&quot;|&#39;|&apos;|&nbsp;/gi,
    (match) => NAMED_ENTITIES[match.toLowerCase()] ?? match,
  );
  result = result.replace(/&#(\d+);/g, (_, dec: string) => safeFromCodePoint(Number(dec)));
  result = result.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => safeFromCodePoint(parseInt(hex, 16)));
  return result;
}

function safeFromCodePoint(codePoint: number): string {
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return "";
  }
}

const TRAILING_PUNCTUATION = new Set([".", ",", ";", ":", "!", "?", '"', "'", "*"]);
const BRACKET_CLOSERS: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

/**
 * Strips punctuation that belongs to the surrounding sentence rather than
 * the URL itself, e.g. "...meetup-join/abc123)." -> "...meetup-join/abc123".
 * Closing brackets are only stripped when they are unbalanced within the
 * URL, so query strings that legitimately contain "()" are left alone.
 */
export function cleanTrailingPunctuation(url: string): string {
  let result = url;
  let trimmed = true;

  while (trimmed && result.length > 0) {
    trimmed = false;
    const lastChar = result.charAt(result.length - 1);

    if (TRAILING_PUNCTUATION.has(lastChar)) {
      result = result.slice(0, -1);
      trimmed = true;
      continue;
    }

    const opener = BRACKET_CLOSERS[lastChar];
    if (opener && countOccurrences(result, lastChar) > countOccurrences(result, opener)) {
      result = result.slice(0, -1);
      trimmed = true;
    }
  }

  return result;
}

function countOccurrences(text: string, char: string): number {
  let count = 0;
  for (const c of text) {
    if (c === char) count++;
  }
  return count;
}

function matchPlatform(rawUrl: string): PlatformRule | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  return PLATFORM_RULES.find((rule) => rule.test(parsed)) ?? null;
}

/**
 * Extracts and classifies every URL found in `rawText`.
 *
 * - HTML entities are decoded first.
 * - Trailing sentence punctuation is stripped from every URL.
 * - URLs are deduplicated (exact match, order of first appearance kept).
 * - Each URL is classified as a known meeting platform or an "other" link.
 */
export function extractMeetingLinks(rawText: string): ExtractionResult {
  const text = decodeHtmlEntities(rawText);
  const rawMatches = text.match(URL_REGEX) ?? [];

  const seen = new Set<string>();
  const meetingLinks: ExtractedMeetingLink[] = [];
  const otherLinks: string[] = [];

  for (const rawUrl of rawMatches) {
    const url = cleanTrailingPunctuation(rawUrl);
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const platform = matchPlatform(url);
    if (platform) {
      meetingLinks.push({ url, platform });
    } else {
      otherLinks.push(url);
    }
  }

  return { meetingLinks, otherLinks };
}
