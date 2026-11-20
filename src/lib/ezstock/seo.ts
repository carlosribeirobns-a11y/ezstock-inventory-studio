/** Per-route head() metadata for EzStock screens. */
export function ezHead(title: string, description: string) {
  const fullTitle = `${title} · EzStock`;
  return {
    meta: [
      { title: fullTitle },
      { name: "description", content: description },
      { property: "og:title", content: fullTitle },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}
