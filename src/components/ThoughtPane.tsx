import type { BacklinkEntry } from '../lib/types';
import Backlinks from './Backlinks';

interface ThoughtPaneProps {
  slug: string;
  title: string;
  html: string;
  backlinks: BacklinkEntry[];
  isFirst: boolean;
  index: number;
  onClose: () => void;
  onNavigateBacklink: (slug: string) => void;
}

export default function ThoughtPane({
  title,
  html,
  backlinks,
  isFirst,
  onClose,
  onNavigateBacklink,
}: ThoughtPaneProps) {
  return (
    <>
      <div className="thought-pane-header">
        <span className="thought-pane-title">{title}</span>
        {!isFirst && (
          <button
            className="thought-pane-close"
            onClick={onClose}
            aria-label="Close pane"
          >
            &times;
          </button>
        )}
      </div>
      <div className="thought-pane-body">
        <div
          className="thought-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <Backlinks backlinks={backlinks} onNavigate={onNavigateBacklink} />
      </div>
    </>
  );
}
