// Source attribution helper. Turns the canonical `source_url` an event was
// parsed from into a short "via …" handle (host without scheme / leading www.),
// e.g. https://www.drugstore.rs/events/x → "drugstore.rs". Plain regex so it
// works under Hermes without relying on a global URL polyfill.
export function sourceHandle(url: string): string {
  const match = url.match(/^[a-z]+:\/\/([^/?#]+)/i);
  const host = match ? match[1] : url;
  return host.replace(/^www\./i, '');
}
