import React, { useState } from 'react';
import { IconX, IconCopy, IconCheck, IconTrash, IconRadio, IconBook, IconFileText, IconHelpCircle } from './Icons';

export default function NoteViewerModal({ note, isOpen, onClose, onDelete }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !note) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(note.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getNoteIcon = (type) => {
    switch (type) {
      case 'audio_overview': return <IconRadio size={16} />;
      case 'study_guide': return <IconBook size={16} />;
      case 'briefing_doc': return <IconFileText size={16} />;
      case 'faq': return <IconHelpCircle size={16} />;
      default: return <IconFileText size={16} />;
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content note-viewer-modal">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="source-type-pill studio">
              {getNoteIcon(note.note_type)}
              {note.note_type.replace('_', ' ').toUpperCase()}
            </span>
            <h3 className="modal-title">{note.title}</h3>
          </div>
          <div className="modal-actions-row">
            <button className="btn-secondary btn-sm" onClick={handleCopy}>
              {copied ? <><IconCheck size={14} /> Copied</> : <><IconCopy size={14} /> Copy</>}
            </button>
            {onDelete && (
              <button className="btn-danger-outline btn-sm" onClick={() => { onDelete(note.id); onClose(); }}>
                <IconTrash size={14} />
              </button>
            )}
            <button className="icon-btn" onClick={onClose}>
              <IconX size={18} />
            </button>
          </div>
        </div>

        <div className="modal-body note-body-scroll">
          <div className="note-formatted-text">
            {note.content}
          </div>
        </div>
      </div>
    </div>
  );
}
