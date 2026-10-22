import React from 'react';
import {
  IconPlus, IconTrash, IconYoutube, IconGlobe, IconFileText,
  IconCheck, IconUpload, IconSparkles, IconLayers
} from './Icons';

export default function SourcesPanel({
  sources = [],
  onOpenAddModal,
  onToggleSource,
  onDeleteSource,
  onSelectSourceDetail
}) {
  const activeCount = sources.filter(s => s.is_active).length;

  const handleToggleAll = (active) => {
    sources.forEach(s => {
      if (s.is_active !== active) {
        onToggleSource(s.id, active);
      }
    });
  };

  const getSourceIcon = (type) => {
    switch (type) {
      case 'youtube': return <IconYoutube size={15} />;
      case 'web': return <IconGlobe size={15} />;
      case 'pdf':
      case 'document': return <IconFileText size={15} />;
      default: return <IconFileText size={15} />;
    }
  };

  return (
    <aside className="sources-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <h2 className="panel-heading">Sources</h2>
          <span className="panel-count-pill">{sources.length}</span>
        </div>
        <button className="btn-primary btn-sm" onClick={onOpenAddModal}>
          <IconPlus size={14} /> Add
        </button>
      </div>

      {sources.length > 0 && (
        <div className="sources-sub-bar">
          <span className="sources-active-info">
            {activeCount} of {sources.length} active in context
          </span>
          <div className="sources-toggle-actions">
            <button className="text-action-btn" onClick={() => handleToggleAll(true)}>All</button>
            <span>·</span>
            <button className="text-action-btn" onClick={() => handleToggleAll(false)}>None</button>
          </div>
        </div>
      )}

      <div className="sources-scroll-list">
        {sources.length === 0 ? (
          <div className="empty-sources-container">
            <div className="empty-sources-icon">
              <IconUpload size={28} />
            </div>
            <div className="empty-sources-title">No sources added yet</div>
            <p className="empty-sources-sub">
              Upload PDFs, paste web/YouTube links, or discover sources by topic to start your research.
            </p>
            <button className="btn-primary" onClick={onOpenAddModal}>
              <IconPlus size={16} /> Add First Source
            </button>
          </div>
        ) : (
          sources.map((src) => (
            <div
              key={src.id}
              className={`source-card-item ${src.is_active ? 'active-context' : 'inactive-context'}`}
            >
              <div
                className="source-checkbox-col"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSource(src.id, !src.is_active);
                }}
              >
                <div className={`custom-checkbox ${src.is_active ? 'checked' : ''}`}>
                  {src.is_active && <IconCheck size={12} />}
                </div>
              </div>

              <div
                className="source-info-col"
                onClick={() => onSelectSourceDetail(src.id)}
              >
                <div className="source-title-row">
                  <span className={`source-mini-type ${src.source_type}`}>
                    {getSourceIcon(src.source_type)}
                  </span>
                  <span className="source-item-title" title={src.title}>
                    {src.title}
                  </span>
                </div>
                {src.summary && (
                  <p className="source-item-summary">{src.summary}</p>
                )}
                <div className="source-item-meta">
                  {src.word_count > 0 && <span>{src.word_count.toLocaleString()} words</span>}
                  <span>·</span>
                  <span className="source-inspect-link">View text</span>
                </div>
              </div>

              <button
                className="source-delete-btn"
                title="Delete source"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSource(src.id);
                }}
              >
                <IconTrash size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
