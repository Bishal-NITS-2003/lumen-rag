import React from 'react';
import {
  IconPlus, IconTrash, IconYoutube, IconGlobe, IconFileText,
  IconCheck, IconUpload, IconEye, IconAlertTriangle
} from './Icons';

export default function SourcesPanel({
  sources = [],
  onOpenAddModal,
  onToggleSource,
  onDeleteSource,
  onSelectSourceDetail
}) {
  const activeCount = sources.filter(s => s.is_active && s.extraction_status !== 'failed').length;

  const handleToggleAll = (active) => {
    sources.forEach(s => {
      if (s.extraction_status !== 'failed' && s.is_active !== active) {
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
          <IconPlus size={14} /> Add Source
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
              Upload PDFs, paste web/YouTube links, or discover live Google sources by topic to start your research.
            </p>
            <button className="btn-primary" onClick={onOpenAddModal}>
              <IconPlus size={16} /> Add First Source
            </button>
          </div>
        ) : (
          sources.map((src) => {
            const isFailed = src.extraction_status === 'failed';
            return (
              <div
                key={src.id}
                className={`source-card-item ${
                  isFailed ? 'failed-extraction' : src.is_active ? 'active-context' : 'inactive-context'
                }`}
              >
                {/* Checkbox column */}
                <div
                  className="source-checkbox-col"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isFailed) onToggleSource(src.id, !src.is_active);
                  }}
                  title={isFailed ? "Cannot activate: extraction failed" : "Toggle source in context"}
                >
                  <div className={`custom-checkbox ${src.is_active && !isFailed ? 'checked' : ''} ${isFailed ? 'disabled' : ''}`}>
                    {src.is_active && !isFailed && <IconCheck size={12} />}
                    {isFailed && <span style={{ fontSize: '10px', color: '#ef4444' }}>✕</span>}
                  </div>
                </div>

                {/* Source info column */}
                <div
                  className="source-info-col"
                  onClick={() => onSelectSourceDetail(src.id)}
                  title="Click to view full extracted content"
                >
                  <div className="source-title-row">
                    <span className={`source-mini-type ${src.source_type}`}>
                      {getSourceIcon(src.source_type)}
                    </span>
                    <span className="source-item-title" title={src.title}>
                      {src.title}
                    </span>

                    {/* Extraction error badge with hover tooltip */}
                    {isFailed && (
                      <span
                        className="extraction-error-badge"
                        title={src.extraction_error || "Failed to extract content or transcript. Click View icon to check details."}
                      >
                        <IconAlertTriangle size={13} />
                        <span className="error-tooltip-text">
                          {src.extraction_error || "Extraction failed: Unable to extract content or transcript."}
                        </span>
                      </span>
                    )}
                  </div>

                  {src.summary && !isFailed && (
                    <p className="source-item-summary">{src.summary}</p>
                  )}

                  {isFailed && (
                    <p className="source-item-summary text-danger">
                      {src.extraction_error || "Failed to extract text or transcript from this source."}
                    </p>
                  )}

                  <div className="source-item-meta">
                    {!isFailed && src.word_count > 0 ? (
                      <span className="word-count-tag">{src.word_count.toLocaleString()} words</span>
                    ) : (
                      <span className="badge-extraction-failed">Extraction Failed</span>
                    )}
                    <span>·</span>
                    <span className="source-inspect-link">Click to view</span>
                  </div>
                </div>

                {/* Action buttons: View 👁️ & Delete 🗑️ */}
                <div className="source-actions-group">
                  <button
                    className="source-view-btn"
                    title="View entire extracted content"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSourceDetail(src.id);
                    }}
                  >
                    <IconEye size={15} />
                  </button>
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
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
