import React, { useState, useEffect, useRef } from 'react';
import {
  IconX, IconYoutube, IconGlobe, IconFileText,
  IconExternalLink, IconLoader, IconDownload, IconCopy, IconCheck, IconAlertTriangle
} from './Icons';

export default function SourceViewerModal({
  notebookId,
  sourceId,
  isOpen,
  onClose,
  highlightSnippet = null
}) {
  const [sourceDetail, setSourceDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollTargetRef = useRef(null);

  useEffect(() => {
    if (isOpen && notebookId && sourceId) {
      fetchDetail();
    } else {
      setSourceDetail(null);
    }
  }, [isOpen, sourceId, notebookId]);

  // When source content finishes rendering and highlightSnippet is active, scroll to citation
  useEffect(() => {
    if (sourceDetail && highlightSnippet) {
      const timer = setTimeout(() => {
        const el = document.getElementById('citation-scroll-target');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [sourceDetail, highlightSnippet]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/sources/${sourceId}`);
      if (res.ok) {
        setSourceDetail(await res.json());
      }
    } catch (err) {
      console.error('Error fetching source detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!sourceDetail?.content) return;
    navigator.clipboard.writeText(sourceDetail.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!sourceDetail?.content) return;
    const cleanTitle = (sourceDetail.title || 'source').replace(/[^a-zA-Z0-9_-]/g, '_');
    const blob = new Blob([sourceDetail.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cleanTitle}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  // Highlight snippet text in content
  const renderHighlightedContent = (text, snippet) => {
    if (!text) return null;
    if (!snippet || typeof snippet !== 'string') {
      return text;
    }

    // Clean snippet for matching (first 80 chars)
    const cleanSnippet = snippet.replace(/\.{3}$/, '').trim();
    if (cleanSnippet.length < 15) return text;

    const lowerText = text.toLowerCase();
    const lowerSnippet = cleanSnippet.toLowerCase();
    const idx = lowerText.indexOf(lowerSnippet);

    if (idx === -1) {
      // Try matching by first sentence or first 40 chars
      const sub = cleanSnippet.slice(0, 45).toLowerCase();
      const subIdx = lowerText.indexOf(sub);
      if (subIdx !== -1) {
        const before = text.slice(0, subIdx);
        const match = text.slice(subIdx, subIdx + cleanSnippet.length);
        const after = text.slice(subIdx + cleanSnippet.length);
        return (
          <>
            {before}
            <mark id="citation-scroll-target" className="citation-highlight">
              {match}
            </mark>
            {after}
          </>
        );
      }
      return text;
    }

    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + cleanSnippet.length);
    const after = text.slice(idx + cleanSnippet.length);

    return (
      <>
        {before}
        <mark id="citation-scroll-target" className="citation-highlight">
          {match}
        </mark>
        {after}
      </>
    );
  };

  const isFailed = sourceDetail?.extraction_status === 'failed';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content source-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="source-meta-tag-row">
              <span className={`source-type-pill ${sourceDetail?.source_type || 'web'}`}>
                {sourceDetail?.source_type === 'youtube' && <IconYoutube size={14} />}
                {sourceDetail?.source_type === 'web' && <IconGlobe size={14} />}
                {(sourceDetail?.source_type === 'pdf' || sourceDetail?.source_type === 'document') && <IconFileText size={14} />}
                {sourceDetail?.source_type === 'youtube' ? 'YOUTUBE' : (sourceDetail?.source_type?.toUpperCase() || 'SOURCE')}
              </span>

              {isFailed ? (
                <span className="badge-extraction-failed">
                  <IconAlertTriangle size={12} /> Extraction Failed
                </span>
              ) : (
                sourceDetail?.word_count > 0 && (
                  <span className="source-word-pill">{sourceDetail.word_count.toLocaleString()} words</span>
                )
              )}

              {highlightSnippet && (
                <span className="source-citation-active-pill">
                  📍 Jumped to Cited Passage
                </span>
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

          <div className="modal-header-actions" style={{ display: "flex", flexDirection: "row", gap: 5 }}>
            {sourceDetail?.content && (
              <>
                <button className="btn-secondary btn-sm" onClick={handleCopy} title="Copy source text">
                  {copied ? <><IconCheck size={14} /> Copied</> : <><IconCopy size={14} /> Copy</>}
                </button>
                <button className="btn-secondary btn-sm" onClick={handleDownloadTxt} title="Download source as .txt">
                  <IconDownload size={14} /> Export .TXT
                </button>
              </>
            )}
            <button className="icon-btn" onClick={onClose} title="Close">
              <IconX size={18} />
            </button>
          </div>
        </div>

        <div className="modal-body source-viewer-body">
          {loading ? (
            <div className="loading-state-box">
              <IconLoader size={26} className="spin text-accent" />
              <span>Loading source content...</span>
            </div>
          ) : sourceDetail ? (
            <>
              {isFailed && (
                <div className="source-error-banner">
                  <IconAlertTriangle size={18} />
                  <div>
                    <div className="error-banner-title">Extraction Unsuccessful</div>
                    <div className="error-banner-msg">
                      {sourceDetail.extraction_error || "Could not retrieve full content or captions for this source."}
                    </div>
                  </div>
                </div>
              )}

              {sourceDetail.summary && !isFailed && (
                <div className="source-summary-callout">
                  <div className="summary-callout-title">Overview</div>
                  <p className="summary-callout-text">{sourceDetail.summary}</p>
                </div>
              )}

              <div className="source-raw-content">
                <div className="raw-content-title">
                  <span>Full Extracted Text</span>
                  {highlightSnippet && (
                    <span className="highlight-hint-tag">Highlighted passage scrolled into view</span>
                  )}
                </div>
                <div className="source-text-document">
                  {renderHighlightedContent(sourceDetail.content, highlightSnippet)}
                </div>
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
