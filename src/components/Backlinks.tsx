import type { BacklinkEntry } from '../lib/types';

interface BacklinksProps {
  backlinks: BacklinkEntry[];
  onNavigate: (slug: string) => void;
}

export default function Backlinks({ backlinks, onNavigate }: BacklinksProps) {
  if (backlinks.length === 0) return null;

  return (
    <div className="backlinks">
      <h2 className="backlinks-heading">Links to this thought</h2>
      <div className="backlinks-grid">
        {backlinks.map((bl) => (
          <a
            key={bl.slug}
            href={`/thoughts/${bl.slug}`}
            className="backlink-card"
            onClick={(e) => {
              e.preventDefault();
              onNavigate(bl.slug);
            }}
          >
            <span className="backlink-title">{bl.title}</span>
            {bl.context && (
              <div
                className="backlink-context"
                dangerouslySetInnerHTML={{ __html: bl.context }}
              />
            )}
          </a>
        ))}
      </div>
      <style>{`
        .backlinks {
          margin-top: var(--space-xl);
          padding: var(--space-md) var(--space-md) var(--space-sm);
          background-color: var(--paper-aged);
          border-radius: 8px;
          border: 1px solid var(--paper-shadow);
        }
        .backlinks-heading {
          font-family: var(--font-serif);
          font-size: 1rem;
          font-weight: 400;
          color: var(--ink-medium);
          margin: 0 0 var(--space-xs);
          text-transform: none;
          letter-spacing: normal;
          border: none;
          padding: 0;
        }
        .backlinks-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: var(--space-sm);
        }
        @media (max-width: 768px) {
          .backlinks-grid {
            grid-template-columns: 1fr;
          }
        }
        .backlink-card {
          display: block;
          padding: var(--space-sm);
          text-decoration: none;
          border-radius: 4px;
          transition: background-color 0.15s ease;
        }
        .backlink-card:hover {
          background-color: var(--paper);
        }
        .backlink-title {
          display: block;
          font-family: var(--font-serif);
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--ink-dark);
          line-height: 1.4;
        }
        .backlink-context {
          font-size: 0.8rem;
          color: var(--ink-light);
          margin-top: 4px;
          line-height: 1.5;
          font-family: var(--font-serif);
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .backlink-context a {
          text-decoration: none;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
