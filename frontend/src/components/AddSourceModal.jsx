import React, { useState, useEffect } from 'react';
import {
  IconX, IconUpload, IconUploadCloud, IconFileUp, IconFileText,
  IconLink, IconSparkles, IconLoader, IconCheck, IconCheckCircle,
  IconYoutube, IconGlobe, IconSearch, IconAlertTriangle, IconTrash
} from './Icons';

export default function AddSourceModal({ notebookId, isOpen, onClose, onSourceAdded, currentSourcesCount = 0 }) {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'discover' | 'link'

  const MAX_SOURCES = 5;
  const remainingSlots = Math.max(0, MAX_SOURCES - currentSourcesCount);
  const maxSelectable = Math.min(5, remainingSlots);
  const isLimitReached = remainingSlots <= 0;

  // File Upload State
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Link State
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [isAddingLink, setIsAddingLink] = useState(false);

  // Discover / Google Search State
  const [prompt, setPrompt] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [candidateResults, setCandidateResults] = useState(null);
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [isAddingCandidates, setIsAddingCandidates] = useState(false);
  const [candidateFilter, setCandidateFilter] = useState('all'); // 'all' | 'youtube' | 'web'

  const [errorMsg, setErrorMsg] = useState('');

  // Automatically reset error message and active upload state when modal is opened
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSelectedFiles([]);
      setIsUploading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileBadge = (filename) => {
    const ext = (filename || '').split('.').pop().toLowerCase();
    if (ext === 'pdf') return { label: 'PDF', bg: '#fef3c7', text: '#b45309' };
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return { label: 'IMAGE', bg: '#ede9fe', text: '#7c3aed' };
    if (['txt', 'md', 'csv', 'json'].includes(ext)) return { label: ext.toUpperCase(), bg: '#dbeafe', text: '#1d4ed8' };
    return { label: ext.toUpperCase() || 'DOC', bg: 'var(--bg-subtle)', text: 'var(--text-2)' };
  };

  const handleFilesSelected = (filesList) => {
    const incoming = Array.from(filesList || []);
    if (!incoming.length) return;

    const current = [...selectedFiles];
    let overflow = false;

    for (const f of incoming) {
      if (current.some(existing => existing.name === f.name && existing.size === f.size)) continue;
      if (current.length >= maxSelectable) {
        overflow = true;
        break;
      }
      current.push(f);
    }

    if (overflow || incoming.length + selectedFiles.length > maxSelectable) {
      setErrorMsg(`Notebook limit: You can add at most ${maxSelectable} file${maxSelectable > 1 ? 's' : ''} (${MAX_SOURCES} total per notebook).`);
    } else {
      setErrorMsg('');
    }
    setSelectedFiles(current);
  };

  const handleRemoveSelectedFile = (indexToRemove, e) => {
    if (e) e.stopPropagation();
    setSelectedFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleClearAllFiles = (e) => {
    if (e) e.stopPropagation();
    setSelectedFiles([]);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLimitReached && !isUploading) setIsDragging(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!isLimitReached && !isUploading && e.dataTransfer.files) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return;
    if (isLimitReached) {
      setErrorMsg(`Notebook limit reached: Maximum ${MAX_SOURCES} sources allowed. Remove an existing source first.`);
      return;
    }
    setIsUploading(true);
    setErrorMsg('');

    const formData = new FormData();
    selectedFiles.forEach(f => {
      formData.append('files', f);
    });

    try {
      const res = await fetch(`/api/notebooks/${notebookId}/sources/upload-batch`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Upload failed. Please check the file and try again.');
      }
      const data = await res.json();
      setErrorMsg('');
      setSelectedFiles([]);
      onSourceAdded(data);
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddLink = async (e) => {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    if (isLimitReached) {
      setErrorMsg(`Notebook limit reached: Maximum ${MAX_SOURCES} sources allowed. Remove an existing source first.`);
      return;
    }
    setIsAddingLink(true);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/notebooks/${notebookId}/sources/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkUrl.trim(), title: linkTitle.trim() || undefined })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Unable to import this link. Please verify the URL.');
      }
      const data = await res.json();
      onSourceAdded(data);
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsAddingLink(false);
    }
  };

  const handleDiscoverPrompt = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setIsSearching(true);
    setErrorMsg('');
    setCandidateResults(null);
    setSelectedCandidates([]);

    try {
      const res = await fetch(`/api/notebooks/${notebookId}/sources/generate-candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Search failed. Please try a different query.');
      }
      const data = await res.json();
      setCandidateResults(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleCandidateSelection = (item) => {
    const exists = selectedCandidates.some(c => c.url === item.url);
    if (exists) {
      setSelectedCandidates(prev => prev.filter(c => c.url !== item.url));
    } else {
      if (selectedCandidates.length >= maxSelectable) {
        alert(`You can select at most ${maxSelectable} sources (${MAX_SOURCES} maximum per notebook).`);
        return;
      }
      setSelectedCandidates(prev => [...prev, item]);
    }
  };

  const handleSelectAll = (items) => {
    const newItems = items.slice(0, maxSelectable);
    setSelectedCandidates(newItems);
  };

  const handleDeselectAll = () => {
    setSelectedCandidates([]);
  };

  const handleImportCandidates = async () => {
    if (selectedCandidates.length === 0) return;
    setIsAddingCandidates(true);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/notebooks/${notebookId}/sources/add-candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidates: selectedCandidates })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to add selected sources');
      }
      const addedList = await res.json();
      setErrorMsg('');
      addedList.forEach(s => onSourceAdded(s));
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsAddingCandidates(false);
    }
  };

  const filteredCandidates = candidateResults?.candidates?.filter(c => {
    if (candidateFilter === 'youtube') return c.type === 'youtube';
    if (candidateFilter === 'web') return c.type === 'web' || c.type === 'article';
    return true;
  }) || [];

  const totalSelectedBytes = selectedFiles.reduce((acc, f) => acc + (f.size || 0), 0);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content add-source-modal-redesigned" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">Add Sources</h3>
            <div className="modal-quota-indicator">
              <span className="quota-text">
                {currentSourcesCount} of {MAX_SOURCES} sources used
              </span>
              <div className="quota-bar-pills" title={`${remainingSlots} slots remaining`}>
                {Array.from({ length: MAX_SOURCES }).map((_, i) => (
                  <span
                    key={i}
                    className={`quota-pill-dot ${i < currentSourcesCount ? 'filled' : i < currentSourcesCount + selectedFiles.length ? 'staged' : 'empty'}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <button className="icon-btn modal-close-btn" onClick={onClose} title="Close">
            <IconX size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="modal-tabs-segmented">
          <button
            type="button"
            className={`tab-segment-btn ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => { setActiveTab('upload'); setErrorMsg(''); }}
          >
            <IconUploadCloud size={16} />
            <span>Upload Documents</span>
          </button>
          <button
            type="button"
            className={`tab-segment-btn ${activeTab === 'discover' ? 'active' : ''}`}
            onClick={() => { setActiveTab('discover'); setErrorMsg(''); }}
          >
            <IconSparkles size={16} />
            <span>Search & Discover</span>
          </button>
          <button
            type="button"
            className={`tab-segment-btn ${activeTab === 'link' ? 'active' : ''}`}
            onClick={() => { setActiveTab('link'); setErrorMsg(''); }}
          >
            <IconLink size={16} />
            <span>Web Link</span>
          </button>
        </div>

        {/* Warning Banner if limit reached */}
        {isLimitReached && (
          <div className="modal-warning-banner">
            <IconAlertTriangle size={16} />
            <span>This notebook has reached the {MAX_SOURCES}-source limit. Remove an existing source to attach new documents.</span>
          </div>
        )}

        {/* Error Banner */}
        {errorMsg && (
          <div className="modal-error-banner">
            <span>{errorMsg}</span>
            <button className="banner-close" onClick={() => setErrorMsg('')}>✕</button>
          </div>
        )}

        <div className="modal-body-custom">
          {/* ══════════════════════════════════════════════════════════ */}
          {/* TAB 1: File Upload (PDF, TXT, MD, Scanned Docs, Images)  */}
          {/* ══════════════════════════════════════════════════════════ */}
          {activeTab === 'upload' && (
            <form onSubmit={handleFileUpload} className="tab-pane-upload">
              <input
                id="file-input-field"
                type="file"
                multiple
                accept=".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp"
                style={{ display: 'none' }}
                disabled={isLimitReached || selectedFiles.length >= maxSelectable || isUploading}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFilesSelected(e.target.files);
                    e.target.value = '';
                  }
                }}
              />

              {/* No files selected yet: Large interactive dropzone */}
              {selectedFiles.length === 0 ? (
                <div
                  className={`premium-dropzone ${isDragging ? 'is-dragging' : ''} ${isLimitReached ? 'disabled' : ''}`}
                  onClick={() => {
                    if (!isLimitReached && !isUploading) {
                      document.getElementById('file-input-field').click();
                    }
                  }}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="dropzone-icon-bubble">
                    <IconUploadCloud size={32} />
                  </div>
                  <h4 className="dropzone-heading">
                    {isLimitReached
                      ? 'Notebook Limit Reached'
                      : 'Drag & drop research documents here'}
                  </h4>
                  <p className="dropzone-description">
                    {isLimitReached
                      ? `Maximum of ${MAX_SOURCES} sources allowed per notebook.`
                      : 'or click to browse files from your computer'}
                  </p>

                  <div className="dropzone-badges-row">
                    <span className="file-format-badge">PDF</span>
                    <span className="file-format-badge">Text (.txt, .md)</span>
                    <span className="file-format-badge">Scanned Docs</span>
                    <span className="file-format-badge">Images</span>
                  </div>

                  <div className="dropzone-capacity-hint">
                    Attach up to {maxSelectable} file{maxSelectable > 1 ? 's' : ''} at once • Text and scans are automatically indexed
                  </div>
                </div>
              ) : (
                /* Files selected state */
                <div className="selected-files-deck">
                  {/* Summary bar */}
                  <div className="deck-summary-bar">
                    <div className="deck-summary-left">
                      <span className="deck-summary-title">
                        {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} ready
                      </span>
                      <span className="deck-summary-size">
                        ({formatBytes(totalSelectedBytes)})
                      </span>
                    </div>
                    <div className="deck-summary-actions">
                      {selectedFiles.length < maxSelectable && !isUploading && (
                        <button
                          type="button"
                          className="btn-add-more-pill"
                          onClick={() => document.getElementById('file-input-field').click()}
                        >
                          <IconFileUp size={13} />
                          <span>Add more ({maxSelectable - selectedFiles.length} left)</span>
                        </button>
                      )}
                      {!isUploading && (
                        <button
                          type="button"
                          className="btn-clear-all"
                          onClick={handleClearAllFiles}
                          title="Clear all selected files"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Drop zone strip for quick dragging more files */}
                  {selectedFiles.length < maxSelectable && !isUploading && (
                    <div
                      className={`mini-drop-strip ${isDragging ? 'is-dragging' : ''}`}
                      onClick={() => document.getElementById('file-input-field').click()}
                      onDragEnter={handleDragEnter}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <IconUpload size={14} />
                      <span>Drag additional files here or browse</span>
                    </div>
                  )}

                  {/* Selected files list */}
                  <div className="staged-files-list">
                    {selectedFiles.map((file, idx) => {
                      const badge = getFileBadge(file.name);
                      return (
                        <div key={idx} className="staged-file-card">
                          <div className="staged-file-left">
                            <span
                              className="staged-file-badge"
                              style={{ background: badge.bg, color: badge.text }}
                            >
                              {badge.label}
                            </span>
                            <div className="staged-file-meta">
                              <span className="staged-file-name" title={file.name}>
                                {file.name}
                              </span>
                              <span className="staged-file-sub">
                                {formatBytes(file.size)}
                              </span>
                            </div>
                          </div>

                          <div className="staged-file-right">
                            <span className="file-ready-tag">
                              <IconCheckCircle size={12} /> Ready
                            </span>
                            {!isUploading && (
                              <button
                                type="button"
                                className="btn-remove-staged"
                                title="Remove file"
                                onClick={(e) => handleRemoveSelectedFile(idx, e)}
                              >
                                <IconTrash size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* OCR & Processing note */}
                  <div className="deck-helper-note">
                    <IconSparkles size={14} className="sparkle-hint" />
                    <span>Scanned pages, notes, and PDF text are automatically read and indexed for instant Q&amp;A.</span>
                  </div>
                </div>
              )}

              {/* Upload footer actions */}
              <div className="modal-footer-custom">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onClose}
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={selectedFiles.length === 0 || isUploading || isLimitReached}
                >
                  {isUploading ? (
                    <>
                      <IconLoader size={16} className="spin" />
                      <span>Processing & Indexing {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}...</span>
                    </>
                  ) : (
                    <>
                      <IconUploadCloud size={16} />
                      <span>
                        Upload {selectedFiles.length > 0 ? `${selectedFiles.length} Document${selectedFiles.length > 1 ? 's' : ''}` : 'Documents'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* TAB 2: Discover from Search (Articles & YouTube)         */}
          {/* ══════════════════════════════════════════════════════════ */}
          {activeTab === 'discover' && (
            <div className="tab-pane-discover">
              <form onSubmit={handleDiscoverPrompt} className="search-box-row">
                <div className="search-input-wrapper">
                  <IconSearch size={16} className="search-input-icon" />
                  <input
                    type="text"
                    className="form-input search-input-styled"
                    placeholder="Search any topic, e.g. Quantum Computing or Electric Vehicles"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={isSearching || isAddingCandidates || isLimitReached}
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!prompt.trim() || isSearching || isAddingCandidates || isLimitReached}
                >
                  {isSearching ? <IconLoader size={16} className="spin" /> : <IconSearch size={16} />}
                  <span>{isSearching ? 'Searching...' : 'Find Sources'}</span>
                </button>
              </form>

              {/* Searching Loading State */}
              {isSearching && (
                <div className="discover-loading-box">
                  <div className="spinner-wrapper">
                    <IconLoader size={32} className="spin text-accent" />
                  </div>
                  <div className="discover-loading-title">Finding relevant sources...</div>
                  <div className="discover-loading-sub">
                    Searching top YouTube videos and articles matching your topic.
                  </div>
                </div>
              )}

              {/* Extracting Loading State */}
              {isAddingCandidates && (
                <div className="discover-loading-box active-extracting">
                  <div className="spinner-wrapper">
                    <IconLoader size={36} className="spin text-accent" />
                  </div>
                  <div className="discover-loading-title">
                    Adding {selectedCandidates.length} source{selectedCandidates.length > 1 ? 's' : ''} to notebook...
                  </div>
                  <div className="discover-loading-sub">
                    Extracting content, transcripts, and preparing your knowledge base.
                  </div>
                  <div className="extract-progress-indicator">
                    <div className="extract-progress-bar" />
                  </div>
                </div>
              )}

              {/* Search Results */}
              {candidateResults && !isSearching && !isAddingCandidates && (
                <div className="candidates-list-wrap">
                  <div className="candidates-header-bar">
                    <div className="candidates-filter-pills">
                      <button
                        type="button"
                        className={`filter-pill ${candidateFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setCandidateFilter('all')}
                      >
                        All ({candidateResults.candidates.length})
                      </button>
                      <button
                        type="button"
                        className={`filter-pill ${candidateFilter === 'youtube' ? 'active' : ''}`}
                        onClick={() => setCandidateFilter('youtube')}
                      >
                        YouTube ({candidateResults.candidates.filter(c => c.type === 'youtube').length})
                      </button>
                      <button
                        type="button"
                        className={`filter-pill ${candidateFilter === 'web' ? 'active' : ''}`}
                        onClick={() => setCandidateFilter('web')}
                      >
                        Articles ({candidateResults.candidates.filter(c => c.type !== 'youtube').length})
                      </button>
                    </div>

                    <div className="candidates-quick-toggle">
                      <button
                        type="button"
                        className="text-action-btn"
                        onClick={() => handleSelectAll(filteredCandidates)}
                        disabled={isLimitReached}
                      >
                        Select Top {maxSelectable}
                      </button>
                      <span>·</span>
                      <button type="button" className="text-action-btn" onClick={handleDeselectAll}>
                        Clear
                      </button>
                      <span className="selection-counter-badge">
                        {selectedCandidates.length}/{maxSelectable} selected
                      </span>
                    </div>
                  </div>

                  {filteredCandidates.length === 0 ? (
                    <div className="empty-sub-state">No sources found for this filter.</div>
                  ) : (
                    <div className="unified-candidates-list">
                      {filteredCandidates.map((cand, idx) => {
                        const isSel = selectedCandidates.some(c => c.url === cand.url);
                        return (
                          <div
                            key={cand.id || idx}
                            className={`unified-candidate-card ${isSel ? 'selected' : ''}`}
                            onClick={() => toggleCandidateSelection(cand)}
                          >
                            <div className="candidate-select-col">
                              <div className={`custom-checkbox ${isSel ? 'checked' : ''}`}>
                                {isSel && <IconCheck size={12} />}
                              </div>
                            </div>

                            {cand.thumbnail && (
                              <div className="candidate-thumb-col">
                                <img src={cand.thumbnail} alt="" className="candidate-thumb-img" />
                                {cand.duration && <span className="duration-pill">{cand.duration}</span>}
                              </div>
                            )}

                            <div className="candidate-details-col">
                              <div className="candidate-meta-line">
                                <span className={`source-type-pill ${cand.type}`}>
                                  {cand.type === 'youtube' ? <IconYoutube size={12} /> : <IconGlobe size={12} />}
                                  {cand.type === 'youtube' ? 'YouTube' : 'Article'}
                                </span>
                                <span className="candidate-source-name">{cand.channel_or_source}</span>
                              </div>
                              <div className="candidate-title-text">{cand.title}</div>
                              {cand.snippet && <div className="candidate-snippet-text">{cand.snippet}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="modal-footer-custom">
                    <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleImportCandidates}
                      disabled={selectedCandidates.length === 0 || isAddingCandidates || isLimitReached}
                    >
                      Add {selectedCandidates.length} Selected Source{selectedCandidates.length !== 1 ? 's' : ''}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* TAB 3: Direct URL Import                                 */}
          {/* ══════════════════════════════════════════════════════════ */}
          {activeTab === 'link' && (
            <form onSubmit={handleAddLink} className="tab-pane-link">
              <div className="form-group">
                <label className="form-label">Article or YouTube Video URL</label>
                <div className="link-input-wrapper">
                  <IconGlobe size={16} className="link-input-icon" />
                  <input
                    type="url"
                    className="form-input link-input-styled"
                    placeholder="https://www.youtube.com/watch?v=... or https://..."
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    disabled={isLimitReached}
                    required
                  />
                </div>
                <span className="form-hint">Paste any public web article or YouTube link to ingest its content.</span>
              </div>

              <div className="form-group">
                <label className="form-label">Custom Title (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Research Summary / Overview"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  disabled={isLimitReached}
                />
              </div>

              <div className="modal-footer-custom">
                <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!linkUrl.trim() || isAddingLink || isLimitReached}
                >
                  {isAddingLink ? (
                    <>
                      <IconLoader size={16} className="spin" />
                      <span>Extracting Content...</span>
                    </>
                  ) : (
                    'Add Source'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
