import React, { useState, useEffect, useRef } from 'react';
import { IconCheck, IconLoader, IconDownload, IconTrash, IconFileText, IconSparkles } from './Icons';

export default function NotesPanel({
  notebookId,
  notebookTitle = 'Notebook',
  initialNote = null,
  onNoteUpdated
}) {
  const [content, setContent] = useState('');
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'unsaved' | 'error'
  const saveTimeoutRef = useRef(null);
  const isFirstLoad = useRef(true);

  // Sync initial note when notebook or note content changes
  useEffect(() => {
    if (initialNote && initialNote.notebook_id === notebookId) {
      setContent(initialNote.content || '');
      setSaveStatus('saved');
    } else if (notebookId) {
      fetchNote();
    }
  }, [notebookId, initialNote?.content, initialNote?.updated_at]);

  const fetchNote = async () => {
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/note`);
      if (res.ok) {
        const data = await res.json();
        setContent(data.content || '');
        setSaveStatus('saved');
        if (onNoteUpdated) onNoteUpdated(data);
      }
    } catch (err) {
      console.error('Failed to fetch note:', err);
    }
  };

  // Debounced auto-save when user types
  const handleContentChange = (e) => {
    const newText = e.target.value;
    setContent(newText);
    setSaveStatus('unsaved');

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      saveNoteToDb(newText);
    }, 700);
  };

  const saveNoteToDb = async (textToSave) => {
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/note`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: textToSave })
      });
      if (res.ok) {
        const updated = await res.json();
        setSaveStatus('saved');
        if (onNoteUpdated) onNoteUpdated(updated);
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error('Error saving note:', err);
      setSaveStatus('error');
    }
  };

  // Export note as .txt file
  const handleExportTxt = () => {
    if (!content.trim()) {
      alert('Your note is empty. Add or type some text before exporting.');
      return;
    }

    const cleanTitle = (notebookTitle || 'Research_Notes').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${cleanTitle}_notes.txt`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Clear note
  const handleClearNote = () => {
    if (!content.trim()) return;
    if (window.confirm('Are you sure you want to clear your manual notes for this notebook?')) {
      setContent('');
      saveNoteToDb('');
    }
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  return (
    <aside className="notes-panel">
      <div className="panel-header notes-panel-header">
        <div className="panel-title-group">
          <h2 className="panel-heading">
            <IconFileText size={18} /> Research Notes
          </h2>
          <span className="save-status-indicator">
            {saveStatus === 'saving' && (
              <span className="status-saving">
                <IconLoader size={12} className="spin" /> Saving...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="status-saved">
                <IconCheck size={12} /> Saved in DB
              </span>
            )}
            {saveStatus === 'unsaved' && (
              <span className="status-unsaved">● Unsaved changes</span>
            )}
            {saveStatus === 'error' && (
              <span className="status-error">⚠️ Save failed</span>
            )}
          </span>
        </div>

        <div className="notes-action-buttons">
          <button
            className="btn-secondary btn-sm"
            onClick={handleExportTxt}
            title="Download notes as .txt file"
            disabled={!content.trim()}
          >
            <IconDownload size={14} /> Export .TXT
          </button>
          {content.trim() && (
            <button
              className="icon-btn-danger btn-sm"
              onClick={handleClearNote}
              title="Clear all notes"
            >
              <IconTrash size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="notes-sub-banner">
        <span>💡 Highlight any text in Chat and click <b>➕ Add to Note</b> to append it automatically.</span>
      </div>

      <div className="notes-editor-container">
        <textarea
          className="notes-textarea"
          value={content}
          onChange={handleContentChange}
          placeholder="Start typing your research notes here, or highlight sentences in the chat to add them automatically..."
          spellCheck={false}
        />
      </div>

      <div className="notes-footer-bar">
        <span className="notes-stats">
          {wordCount.toLocaleString()} words · {charCount.toLocaleString()} characters
        </span>
        <button
          className="btn-save-note"
          onClick={() => saveNoteToDb(content)}
          disabled={saveStatus === 'saving' || saveStatus === 'saved'}
        >
          {saveStatus === 'saving' ? 'Saving...' : 'Save Now'}
        </button>
      </div>
    </aside>
  );
}
