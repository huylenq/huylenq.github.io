const pads = import.meta.glob('../pads/*.mdx', { eager: true }) as Record<string, any>;

const padsBySlug = Object.fromEntries(
  Object.values(pads)
    .filter((m) => m.meta?.slug)
    .map((m) => [m.meta.slug, m])
);

export default function PadRenderer({ slug }: { slug: string }) {
  const pad = padsBySlug[slug];
  if (!pad) {
    throw new Error(`PadRenderer: no pad for slug "${slug}". Available: [${Object.keys(padsBySlug).join(', ')}]`);
  }
  const Content = pad.default;
  return <Content />;
}
