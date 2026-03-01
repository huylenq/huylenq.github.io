import type { BacklinkEntry } from '../lib/types';
import Backlinks from './Backlinks';

interface NotePaneProps {
  slug: string;
  title: string;
  html: string;
  backlinks: BacklinkEntry[];
  isFirst: boolean;
  index: number;
  onClose: () => void;
  onNavigateBacklink: (slug: string) => void;
}

export default function NotePane({
  title,
  html,
  backlinks,
  isFirst,
  onClose,
  onNavigateBacklink,
}: NotePaneProps) {
  return (
    <>
      <div className="note-pane-header">
        <span className="note-pane-title">{title}</span>
        {!isFirst && (
          <button
            className="note-pane-close"
            onClick={onClose}
            aria-label="Close pane"
          >
            &times;
          </button>
        )}
      </div>
      <div className="note-pane-body">
        <div
          className="note-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <Backlinks backlinks={backlinks} onNavigate={onNavigateBacklink} />
      </div>
    </>
  );
}
