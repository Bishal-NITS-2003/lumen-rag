import React, { useState, useEffect } from 'react';
import { IconX, IconYoutube, IconGlobe, IconFileText, IconExternalLink, IconLoader } from './Icons';

export default function SourceViewerModal({ notebookId, sourceId, isOpen, onClose }) {
  const [sourceDetail, setSourceDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && notebookId && sourceId) {
      fetchDetail();
    } else {
      setSourceDetail(null);
    }
  }, [isOpen, sourceId, notebookId]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/sources/${sourceId}`);
      if (res.ok) {
        setSourceDetail(await res.json());
      }
    } catch {}
    finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content source-detail-modal">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="source-meta-tag-row">
              <span className={`source-type-pill ${sourceDetail?.source_type || 'web'}`}>
                {sourceDetail?.source_type === 'youtube' && <IconYoutube size={14} />}
                {sourceDetail?.source_type === 'web' && <IconGlobe size={14} />}
                {(sourceDetail?.source_type === 'pdf' || sourceDetail?.source_type === 'document') && <IconFileText size={14} />}
                {sourceDetail?.source_type?.toUpperCase() || 'SOURCE'}
              </span>
              {sourceDetail?.word_count > 0 && (
                <span className="source-word-pill">{sourceDetail.word_count.toLocaleString()} words</span>
              )}
            </div>
            <h3 className="modal-title">{sourceDetail?.title || 'Source Detail'}</h3>
            {sourceDetail?.original_url && (
              <a
                href={sourceDetail.original_url}
                target="_blank"
                rel="noreferrer"
                className="source-external-link"
              >
                <span>{sourceDetail.original_url}</span>
                <IconExternalLink size={14} />
              </a>
            )}
          </div>
          <button className="icon-btn" onClick={onClose}>
            <IconX size={18} />
          </button>
        </div>

        <div className="modal-body source-viewer-body">
          {loading ? (
            <div className="loading-state-box">
              <IconLoader size={24} className="spin" />
              <span>Loading source content...</span>
            </div>
          ) : sourceDetail ? (
            <>
              {sourceDetail.summary && (
                <div className="source-summary-callout">
                  <div className="summary-callout-title">AI Source Summary</div>
                  <p className="summary-callout-text">{sourceDetail.summary}</p>
                </div>
              )}
              <div className="source-raw-content">
                <div className="raw-content-title">Extracted Text Content</div>
                <pre className="source-text-pre">{sourceDetail.content}</pre>
              </div>
            </>
          ) : (
            <div className="error-text">Could not load source details.</div>
          )}
        </div>
      </div>
    </div>
  );
}
