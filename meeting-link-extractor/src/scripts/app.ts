import { extractMeetingLinks, type ExtractionResult } from "../lib/meetingLinkExtractor.ts";
import { renderResultsHtml } from "../lib/renderResults.ts";

const textarea = document.querySelector<HTMLTextAreaElement>("#meeting-input");
const resultContent = document.querySelector<HTMLDivElement>("#result-content");
const clearButton = document.querySelector<HTMLButtonElement>("#clear-button");

if (!textarea || !resultContent || !clearButton) {
  throw new Error("Meeting Link Extractor: required DOM elements are missing.");
}

// Keep the last parse result around so "Copy all" doesn't need to re-parse
// or re-read every card's dataset.
let lastResult: ExtractionResult = { meetingLinks: [], otherLinks: [] };

function render(): void {
  const rawText = textarea!.value;
  lastResult = extractMeetingLinks(rawText);
  resultContent!.innerHTML = renderResultsHtml(lastResult, rawText.trim().length > 0);
}

async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy fallback below
    }
  }

  // Fallback for browsers/contexts where the async Clipboard API is unavailable.
  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "");
  helper.style.position = "fixed";
  helper.style.top = "-1000px";
  helper.style.opacity = "0";
  document.body.appendChild(helper);
  helper.focus();
  helper.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(helper);
  return ok;
}

function flashButtonLabel(button: HTMLButtonElement, temporaryLabel: string): void {
  const originalLabel = button.dataset.originalLabel ?? button.textContent ?? "";
  button.dataset.originalLabel = originalLabel;
  button.textContent = temporaryLabel;
  button.classList.add("btn--success");
  button.disabled = true;

  window.setTimeout(() => {
    button.textContent = originalLabel;
    button.classList.remove("btn--success");
    button.disabled = false;
  }, 1500);
}

function openMeetingUrl(url: string): void {
  // Only ever open links our own parser produced (always http/https), and
  // do it the safe way: no window.opener access for the new tab.
  if (!/^https?:\/\//i.test(url)) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

resultContent.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const button = target.closest<HTMLButtonElement>("button[data-action]");
  if (!button) return;

  const action = button.dataset.action;

  if (action === "copy") {
    const url = button.dataset.url ?? "";
    void copyText(url).then((ok) => {
      if (ok) flashButtonLabel(button, "Copied ✓");
    });
    return;
  }

  if (action === "open") {
    openMeetingUrl(button.dataset.url ?? "");
    return;
  }

  if (action === "copy-all") {
    const allUrls = lastResult.meetingLinks.map((link) => link.url).join("\n");
    void copyText(allUrls).then((ok) => {
      if (ok) flashButtonLabel(button, "Copied ✓");
    });
  }
});

// Auto-parse: no "Extract" button required. Covers typing, paste, and
// programmatic value changes alike.
textarea.addEventListener("input", render);

// Manual re-run via Ctrl/Cmd+Enter, as requested — auto-parse already
// covers this in practice, but some users like an explicit action.
textarea.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    render();
  }
});

// Note: a Ctrl+Shift+V "paste as plain text" handler was intentionally not
// added. Regular paste already flows through the `input` listener above,
// and intercepting/reading the clipboard directly needs permissions that
// are inconsistent across browsers for little practical benefit here.

clearButton.addEventListener("click", () => {
  textarea!.value = "";
  textarea!.focus();
  render();
});

render();
