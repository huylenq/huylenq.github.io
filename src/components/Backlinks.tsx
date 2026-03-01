import { useState } from 'react';
import type { BacklinkEntry } from '../lib/types';

interface BacklinksProps {
  backlinks: BacklinkEntry[];
  onNavigate: (slug: string) => void;
}

export default function Backlinks({ backlinks, onNavigate }: BacklinksProps) {
  const [open, setOpen] = useState(false);

  if (backlinks.length === 0) return null;

  return (
    <div className="backlinks">
      <button
        className="backlinks-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {backlinks.length} backlink{backlinks.length !== 1 ? 's' : ''}
        <span className="backlinks-chevron" aria-hidden="true">
          {open ? '\u25B4' : '\u25BE'}
        </span>
      </button>
      {open && (
        <ul className="backlinks-list">
          {backlinks.map((bl) => (
            <li key={bl.slug} className="backlink-item">
              <a
                href={`/${bl.slug}`}
                className="backlink-title"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(bl.slug);
                }}
              >
                {bl.title}
              </a>
              {bl.context && (
                <p className="backlink-context">{bl.context}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <style>{`
        .backlinks {
          margin-top: var(--space-xl);
          padding-top: var(--space-md);
          border-top: 1px solid var(--ink-faint);
        }
        .backlinks-toggle {
          background: none;
          border: none;
          font-family: var(--font-sans);
          font-size: 0.7rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--ink-light);
          cursor: pointer;
          padding: 4px 0;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .backlinks-toggle:hover {
          color: var(--ink-dark);
        }
        .backlinks-chevron {
          font-size: 10px;
        }
        .backlinks-list {
          list-style: none;
          padding: 0;
          margin: var(--space-sm) 0 0;
        }
        .backlink-item {
          padding: var(--space-sm) 0;
          border-bottom: 1px solid var(--ink-faint);
        }
        .backlink-item:last-child {
          border-bottom: none;
        }
        .backlink-title {
          font-family: var(--font-serif);
          font-size: 0.9rem;
          color: var(--ink-dark);
          text-decoration: none;
        }
        .backlink-title:hover {
          color: var(--ink-black);
        }
        .backlink-context {
          font-size: 0.85rem;
          color: var(--ink-medium);
          margin-top: 4px;
          line-height: 1.6;
          font-family: var(--font-serif);
        }
      `}</style>
    </div>
  );
}
