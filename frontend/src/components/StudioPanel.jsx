import React, { useState } from 'react';
import {
  IconRadio, IconBook, IconFileText, IconHelpCircle,
  IconSparkles, IconLoader, IconPlus, IconTrash
} from './Icons';

export default function StudioPanel({
  notebookId,
  notes = [],
  sourcesCount = 0,
  onNoteGenerated,
  onSelectNote,
  onDeleteNote
}) {
  const [generatingType, setGeneratingType] = useState(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGeneratingCustom, setIsGeneratingCustom] = useState(false);

  const handleGenerate = async (noteType, customText = null) => {
    if (sourcesCount === 0) {
      alert("Please add at least one source to your notebook before generating studio artifacts.");
      return;
    }

    setGeneratingType(noteType);
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/studio/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note_type: noteType,
          custom_prompt: customText || undefined
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Generation failed');
      }
      const data = await res.json();
      onNoteGenerated(data);
      if (customText) setCustomPrompt('');
    } catch (err) {
      alert(`Generation failed: ${err.message}`);
    } finally {
      setGeneratingType(null);
      setIsGeneratingCustom(false);
    }
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
    <aside className="studio-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <h2 className="panel-heading">Studio</h2>
          <span className="panel-badge-studio">Notebook Guide</span>
        </div>
      </div>

      <div className="studio-scroll-area">
        {/* Artifact Quick Action Cards */}
        <div className="studio-cards-grid">
          {/* Audio Overview */}
          <button
            className="studio-generator-card audio"
            disabled={generatingType !== null || sourcesCount === 0}
            onClick={() => handleGenerate('audio_overview')}
          >
            <div className="studio-card-icon-wrap">
              {generatingType === 'audio_overview' ? (
                <IconLoader size={20} className="spin" />
              ) : (
                <IconRadio size={20} />
              )}
            </div>
            <div className="studio-card-info">
              <span className="studio-card-title">Audio Overview</span>
              <span className="studio-card-sub">Deep-dive podcast discussion between 2 hosts</span>
            </div>
          </button>

          {/* Study Guide */}
          <button
            className="studio-generator-card study"
            disabled={generatingType !== null || sourcesCount === 0}
            onClick={() => handleGenerate('study_guide')}
          >
            <div className="studio-card-icon-wrap">
              {generatingType === 'study_guide' ? (
                <IconLoader size={20} className="spin" />
              ) : (
                <IconBook size={20} />
              )}
            </div>
            <div className="studio-card-info">
              <span className="studio-card-title">Study Guide</span>
              <span className="studio-card-sub">Core concepts, glossary, and practice quiz</span>
            </div>
          </button>

          {/* Briefing Doc */}
          <button
            className="studio-generator-card briefing"
            disabled={generatingType !== null || sourcesCount === 0}
            onClick={() => handleGenerate('briefing_doc')}
          >
            <div className="studio-card-icon-wrap">
              {generatingType === 'briefing_doc' ? (
                <IconLoader size={20} className="spin" />
              ) : (
                <IconFileText size={20} />
              )}
            </div>
            <div className="studio-card-info">
              <span className="studio-card-title">Briefing Doc</span>
              <span className="studio-card-sub">Executive summary & strategic takeaways</span>
            </div>
          </button>

          {/* FAQ */}
          <button
            className="studio-generator-card faq"
            disabled={generatingType !== null || sourcesCount === 0}
            onClick={() => handleGenerate('faq')}
          >
            <div className="studio-card-icon-wrap">
              {generatingType === 'faq' ? (
                <IconLoader size={20} className="spin" />
              ) : (
                <IconHelpCircle size={20} />
              )}
            </div>
            <div className="studio-card-info">
              <span className="studio-card-title">FAQ</span>
              <span className="studio-card-sub">Common questions synthesized from sources</span>
            </div>
          </button>
        </div>

        {/* Custom Studio Note Input */}
        <div className="studio-custom-box">
          <div className="custom-box-title">Custom Synthesis</div>
          <div className="custom-input-row">
            <input
              type="text"
              className="custom-note-input"
              placeholder="e.g. Create a timeline of key milestones..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              disabled={generatingType !== null || sourcesCount === 0}
            />
            <button
              className="btn-primary btn-sm"
              disabled={!customPrompt.trim() || generatingType !== null || sourcesCount === 0}
              onClick={() => handleGenerate('custom', customPrompt.trim())}
            >
              {generatingType === 'custom' ? <IconLoader size={14} className="spin" /> : <IconSparkles size={14} />}
            </button>
          </div>
        </div>

        {/* Saved Studio Notes List */}
        <div className="studio-saved-notes-section">
          <div className="saved-notes-header">
            <span>Generated Notes</span>
            <span className="notes-count">{notes.length}</span>
          </div>

          {notes.length === 0 ? (
            <div className="empty-notes-hint">
              Click any of the cards above to generate study guides, podcast scripts, or briefings from your sources.
            </div>
          ) : (
            <div className="saved-notes-list">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="saved-note-item"
                  onClick={() => onSelectNote(note)}
                >
                  <div className="saved-note-icon-col">
                    {getNoteIcon(note.note_type)}
                  </div>
                  <div className="saved-note-info-col">
                    <div className="saved-note-title">{note.title}</div>
                    <div className="saved-note-date">
                      {new Date(note.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <button
                    className="source-delete-btn"
                    title="Delete note"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNote(note.id);
                    }}
                  >
                    <IconTrash size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
