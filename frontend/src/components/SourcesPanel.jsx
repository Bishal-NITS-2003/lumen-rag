import React from 'react';
import {
  IconPlus, IconTrash, IconYoutube, IconGlobe, IconFileText,
  IconUpload, IconEye, IconAlertTriangle
} from './Icons';

export default function SourcesPanel({
  sources = [],
  onOpenAddModal,
  onDeleteSource,
  onSelectSourceDetail
}) {
  const getSourceIcon = (type) => {
    switch (type) {
      case 'youtube': return <IconYoutube size={15} />;
      case 'web': return <IconGlobe size={15} />;
      case 'pdf':
      case 'document': return <IconFileText size={15} />;
      default: return <IconFileText size={15} />;
    }
  };

  const handleDelete = (e, src) => {
    e.stopPropagation();
    if (window.confirm(`Delete "${src.title}" from this notebook and database?`)) {
      onDeleteSource(src.id);
    }
  };

  const isMaxReached = sources.length >= 5;

  return (
    <aside className="sources-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <h2 className="panel-heading">Sources</h2>
          <span className="panel-count-pill" title={`${sources.length} of 5 max sources attached`}>
            {sources.length}/5
          </span>
        </div>
        <button
          className="btn-primary btn-sm"
          onClick={onOpenAddModal}
          disabled={isMaxReached}
          title={isMaxReached ? "Maximum 5 sources attached. Delete a source to add new ones." : "Add new source"}
        >
          <IconPlus size={14} /> Add Source
        </button>
      </div>

      <div className="sources-scroll-list">
        {sources.length === 0 ? (
          <div className="empty-sources-container">
            <div className="empty-sources-icon">
              <IconUpload size={28} />
            </div>
            <div className="empty-sources-title">No sources added yet</div>
            <p className="empty-sources-sub">
              Upload PDFs, paste web/YouTube links, or discover live Google sources by topic to start your research (up to 5 sources).
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
                className={`source-card-item ${isFailed ? 'failed-extraction' : 'active-context'}`}
                onClick={() => onSelectSourceDetail(src.id)}
                title="Click to view full extracted content"
              >
                {/* Source Icon Column */}
                <div className="source-icon-badge-col">
                  <span className={`source-mini-type ${src.source_type}`}>
                    {getSourceIcon(src.source_type)}
                  </span>
                </div>

                {/* Source info column */}
                <div className="source-info-col">
                  <div className="source-title-row">
                    <span className="source-item-title" title={src.title}>
                      {src.title}
                    </span>

                    {/* Extraction error badge with hover tooltip */}
                    {isFailed && (
                      <span
                        className="extraction-error-badge"
                        title={src.extraction_error || "Failed to extract content or transcript."}
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
                    <span className="source-inspect-link">View content</span>
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
                    title="Delete source from database and notebook"
                    onClick={(e) => handleDelete(e, src)}
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
