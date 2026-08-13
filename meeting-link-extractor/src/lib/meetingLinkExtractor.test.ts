import { test } from "node:test";
import assert from "node:assert/strict";
import { extractMeetingLinks, cleanTrailingPunctuation } from "./meetingLinkExtractor.ts";

test("1. Teams URL terdeteksi sebagai Microsoft Teams", () => {
  const input = `
    Microsoft Teams meeting
    Join: https://teams.microsoft.com/l/meetup-join/19%3ameeting_xxxxx
    Meeting ID: 495 714 468 461 758
  `;
  const { meetingLinks } = extractMeetingLinks(input);
  assert.equal(meetingLinks.length, 1);
  assert.equal(meetingLinks[0]?.platform.label, "Microsoft Teams");
  assert.equal(meetingLinks[0]?.url, "https://teams.microsoft.com/l/meetup-join/19%3ameeting_xxxxx");
});

test("2. Zoom URL terdeteksi sebagai Zoom", () => {
  const input = "Join Zoom Meeting https://zoom.us/j/123456789?pwd=abcXYZ";
  const { meetingLinks } = extractMeetingLinks(input);
  assert.equal(meetingLinks.length, 1);
  assert.equal(meetingLinks[0]?.platform.label, "Zoom");
});

test("3. Google Meet URL terdeteksi sebagai Google Meet", () => {
  const input = "Join with Google Meet: https://meet.google.com/abc-defg-hij";
  const { meetingLinks } = extractMeetingLinks(input);
  assert.equal(meetingLinks.length, 1);
  assert.equal(meetingLinks[0]?.platform.label, "Google Meet");
});

test("4. Webex URL terdeteksi sebagai Cisco Webex", () => {
  const input = "Join: https://company.webex.com/meet/john.doe";
  const { meetingLinks } = extractMeetingLinks(input);
  assert.equal(meetingLinks.length, 1);
  assert.equal(meetingLinks[0]?.platform.label, "Cisco Webex");
});

test("5. Multiple meeting URLs semuanya ditemukan", () => {
  const input = `
    Backup Teams link: https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc
    Backup Zoom link: https://zoom.us/j/987654321
  `;
  const { meetingLinks } = extractMeetingLinks(input);
  assert.equal(meetingLinks.length, 2);
  assert.deepEqual(
    meetingLinks.map((m) => m.platform.label),
    ["Microsoft Teams", "Zoom"],
  );
});

test("6. Duplicate URL hanya tampil satu kali", () => {
  const url = "https://zoom.us/j/123456789";
  const input = `${url}\n\nSame link again: ${url}\nAnd once more: ${url}`;
  const { meetingLinks } = extractMeetingLinks(input);
  assert.equal(meetingLinks.length, 1);
  assert.equal(meetingLinks[0]?.url, url);
});

test("7. URL dengan trailing punctuation dibersihkan", () => {
  const input = "Join here: https://teams.microsoft.com/l/meetup-join/abc123).";
  const { meetingLinks } = extractMeetingLinks(input);
  assert.equal(meetingLinks.length, 1);
  assert.equal(meetingLinks[0]?.url, "https://teams.microsoft.com/l/meetup-join/abc123");
});

test("7b. cleanTrailingPunctuation tidak merusak tanda kurung yang seimbang", () => {
  assert.equal(cleanTrailingPunctuation("https://example.com/wiki/Foo_(bar)"), "https://example.com/wiki/Foo_(bar)");
  assert.equal(cleanTrailingPunctuation("https://example.com/path),"), "https://example.com/path");
});

test("8. Meeting URL + unrelated URL: meeting link diprioritaskan, other link disembunyikan", () => {
  const input = `
    Agenda doc: https://example.com/agenda.pdf
    Join Teams: https://teams.microsoft.com/l/meetup-join/19%3ameeting_xyz
  `;
  const { meetingLinks, otherLinks } = extractMeetingLinks(input);
  assert.equal(meetingLinks.length, 1);
  assert.equal(meetingLinks[0]?.platform.label, "Microsoft Teams");
  assert.equal(otherLinks.length, 1);
  assert.equal(otherLinks[0], "https://example.com/agenda.pdf");
});

test("9. Tidak ada URL sama sekali", () => {
  const input = "UOB jam 13:30 bahas escrow. Tidak ada link sama sekali di sini.";
  const { meetingLinks, otherLinks } = extractMeetingLinks(input);
  assert.equal(meetingLinks.length, 0);
  assert.equal(otherLinks.length, 0);
});

test("10. Tidak ada meeting URL, tapi ada generic URL", () => {
  const input = "Baca dulu dokumennya di https://example.com/notes.pdf sebelum meeting.";
  const { meetingLinks, otherLinks } = extractMeetingLinks(input);
  assert.equal(meetingLinks.length, 0);
  assert.equal(otherLinks.length, 1);
  assert.equal(otherLinks[0], "https://example.com/notes.pdf");
});

test("HTML entity (&amp;) di dalam URL di-decode dengan benar", () => {
  const input = "https://teams.microsoft.com/l/meetup-join/19?context=abc&amp;anon=true";
  const { meetingLinks } = extractMeetingLinks(input);
  assert.equal(meetingLinks.length, 1);
  assert.equal(meetingLinks[0]?.url, "https://teams.microsoft.com/l/meetup-join/19?context=abc&anon=true");
});

test("Percent-encoded URL tidak dirusak", () => {
  const input = "https://teams.microsoft.com/l/meetup-join/abc%3Ffoo%3Dbar";
  const { meetingLinks } = extractMeetingLinks(input);
  assert.equal(meetingLinks.length, 1);
  assert.equal(meetingLinks[0]?.url, "https://teams.microsoft.com/l/meetup-join/abc%3Ffoo%3Dbar");
});

test("Contoh lengkap dari spesifikasi (studi kasus UOB)", () => {
  const input = `
UOB jam 13:30 bahas escrow

Dear UOBI and ICR team,

Please join to discuss Escrow source code ICR

Microsoft Teams meeting
Join: https://teams.microsoft.com/l/meetup-join/19%3ameeting_xxxxx

Meeting ID: 495 714 468 461 758
Passcode: nP2sZ37R
  `;
  const { meetingLinks, otherLinks } = extractMeetingLinks(input);
  assert.equal(meetingLinks.length, 1);
  assert.equal(meetingLinks[0]?.platform.label, "Microsoft Teams");
  assert.equal(meetingLinks[0]?.url, "https://teams.microsoft.com/l/meetup-join/19%3ameeting_xxxxx");
  assert.equal(otherLinks.length, 0);
});
