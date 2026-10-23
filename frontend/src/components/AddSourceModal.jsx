import React, { useState } from 'react';
import {
  IconX, IconUpload, IconLink, IconSparkles, IconLoader,
  IconCheck, IconYoutube, IconGlobe, IconFileText, IconSearch, IconAlertTriangle
} from './Icons';

export default function AddSourceModal({ notebookId, isOpen, onClose, onSourceAdded, currentSourcesCount = 0 }) {
  const [activeTab, setActiveTab] = useState('discover'); // 'discover' | 'upload' | 'link'

  const MAX_SOURCES = 5;
  const remainingSlots = Math.max(0, MAX_SOURCES - currentSourcesCount);
  const maxSelectable = Math.min(5, remainingSlots);
  const isLimitReached = remainingSlots <= 0;

  // File Upload State (Up to 5 files at once)
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFilesSelected = (filesList) => {
    const incoming = Array.from(filesList || []);
    if (!incoming.length) return;

    const current = [...selectedFiles];
    let addedCount = 0;
    for (const f of incoming) {
      if (current.some(existing => existing.name === f.name && existing.size === f.size)) continue;
      if (current.length >= maxSelectable) break;
      current.push(f);
      addedCount++;
    }

    if (incoming.length + selectedFiles.length > maxSelectable) {
      setErrorMsg(`Notebook limit: You can attach at most ${maxSelectable} file(s) (maximum ${MAX_SOURCES} total per notebook).`);
    } else {
      setErrorMsg('');
    }
    setSelectedFiles(current);
  };

  const handleRemoveSelectedFile = (indexToRemove, e) => {
    if (e) e.stopPropagation();
    setSelectedFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return;
    if (isLimitReached) {
      setErrorMsg(`Notebook limit reached: Maximum ${MAX_SOURCES} sources allowed. Delete an existing source first.`);
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
        throw new Error(err.detail || 'Batch upload failed');
      }
      const data = await res.json();
      onSourceAdded(data);
      setSelectedFiles([]);
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
      setErrorMsg(`Notebook limit reached: Maximum ${MAX_SOURCES} sources allowed. Delete an existing source first.`);
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
        throw new Error(err.detail || 'Failed to import URL');
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
        throw new Error(err.detail || 'Google Search failed');
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
        alert(`You can select at most ${maxSelectable} sources (maximum ${MAX_SOURCES} total allowed per notebook).`);
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
        throw new Error(err.detail || 'Failed to import candidate sources');
      }
      const addedList = await res.json();
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content add-source-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">Add Sources to Notebook</h3>
            <p className="modal-sub">
              Attach research material into your private context ({currentSourcesCount}/{MAX_SOURCES} attached)
            </p>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <IconX size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="modal-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'discover' ? 'active' : ''}`}
            onClick={() => { setActiveTab('discover'); setErrorMsg(''); }}
          >
            <IconSparkles size={15} /> Discover from Google
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => { setActiveTab('upload'); setErrorMsg(''); }}
          >
            <IconUpload size={15} /> Upload PDF / TXT
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'link' ? 'active' : ''}`}
            onClick={() => { setActiveTab('link'); setErrorMsg(''); }}
          >
            <IconLink size={15} /> Paste URL
          </button>
        </div>

        {isLimitReached && (
          <div className="modal-warning-banner">
            <IconAlertTriangle size={16} />
            <span>Maximum limit of {MAX_SOURCES} sources reached. Delete an existing source to attach new ones.</span>
          </div>
        )}

        {errorMsg && (
          <div className="modal-error-banner">
            <span>{errorMsg}</span>
            <button className="banner-close" onClick={() => setErrorMsg('')}>✕</button>
          </div>
        )}

        <div className="modal-body">
          {/* TAB 1: Discover from Google (Articles & YouTube) */}
          {activeTab === 'discover' && (
            <div className="tab-pane">
              <form onSubmit={handleDiscoverPrompt} className="search-box-row">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter any topic or query, e.g. Smartphone under 30000 or Quantum Computing"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={isSearching || isAddingCandidates || isLimitReached}
                />
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!prompt.trim() || isSearching || isAddingCandidates || isLimitReached}
                >
                  {isSearching ? <IconLoader size={16} className="spin" /> : <IconSearch size={16} />}
                  <span>{isSearching ? 'Searching...' : 'Find Sources'}</span>
                </button>
              </form>

              {/* Active Search Loading State */}
              {isSearching && (
                <div className="discover-loading-box">
                  <div className="spinner-wrapper">
                    <IconLoader size={32} className="spin text-accent" />
                  </div>
                  <div className="discover-loading-title">Querying Google Search API...</div>
                  <div className="discover-loading-sub">
                    Extracting top YouTube videos and in-depth web articles in real time.
                  </div>
                </div>
              )}

              {/* Active Extraction Loading State */}
              {isAddingCandidates && (
                <div className="discover-loading-box active-extracting">
                  <div className="spinner-wrapper">
                    <IconLoader size={36} className="spin text-accent" />
                  </div>
                  <div className="discover-loading-title">
                    Ingesting & Extracting {selectedCandidates.length} Selected Sources in Parallel...
                  </div>
                  <div className="discover-loading-sub">
                    Parallel workers fetching captions & article contents with 3.5s timeout.
                  </div>
                  <div className="extract-progress-indicator">
                    <div className="extract-progress-bar" />
                  </div>
                </div>
              )}

              {/* Results List */}
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
                        {selectedCandidates.length}/{maxSelectable} selected (max 5)
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

                  <div className="modal-footer" style={{ marginTop: '16px' }}>
                    <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleImportCandidates}
                      disabled={selectedCandidates.length === 0 || isAddingCandidates || isLimitReached}
                    >
                      Add {selectedCandidates.length} Selected to Sources
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: File Upload (Up to 5 files at once, PDF, TXT, MD, Images) */}
          {activeTab === 'upload' && (
            <form onSubmit={handleFileUpload} className="tab-pane">
              <input
                id="file-input-field"
                type="file"
                multiple
                accept=".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp"
                style={{ display: 'none' }}
                disabled={isLimitReached || selectedFiles.length >= maxSelectable}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFilesSelected(e.target.files);
                    e.target.value = '';
                  }
                }}
              />

              {selectedFiles.length === 0 ? (
                <div
                  className={`file-drop-zone ${isLimitReached ? 'disabled' : ''}`}
                  onClick={() => {
                    if (!isLimitReached) {
                      document.getElementById('file-input-field').click();
                    }
                  }}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isLimitReached && e.dataTransfer.files) {
                      handleFilesSelected(e.dataTransfer.files);
                    }
                  }}
                >
                  <div className="drop-icon-wrap">
                    <IconUpload size={32} />
                  </div>
                  <div className="drop-title">
                    {isLimitReached
                      ? 'Maximum 5 Sources Reached'
                      : `Select up to ${maxSelectable} file${maxSelectable > 1 ? 's' : ''} from your computer`}
                  </div>
                  <div className="drop-sub">
                    {isLimitReached
                      ? 'Delete an existing source first to upload new documents.'
                      : 'Upload up to 5 PDFs, scans, TXT, MD, or images at once with Fast OCR.'}
                  </div>
                </div>
              ) : (
                <div className="batch-selected-files-container">
                  <div className="batch-files-header">
                    <span className="batch-count-title">
                      Selected Files ({selectedFiles.length} of {maxSelectable} max)
                    </span>
                    {selectedFiles.length < maxSelectable && (
                      <button
                        type="button"
                        className="btn-add-more-files"
                        onClick={() => document.getElementById('file-input-field').click()}
                      >
                        + Add more files
                      </button>
                    )}
                  </div>

                  <div className="batch-files-list">
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className="batch-file-item">
                        <div className="batch-file-left">
                          <IconFileText size={18} className="batch-file-icon" />
                          <div className="batch-file-info">
                            <span className="batch-file-name" title={file.name}>{file.name}</span>
                            <span className="batch-file-size">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-remove-batch-file"
                          title="Remove file"
                          onClick={(e) => handleRemoveSelectedFile(idx, e)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="batch-ocr-hint">
                    ⚡ Fast OCR enabled for scanned pages and documents.
                  </div>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={selectedFiles.length === 0 || isUploading || isLimitReached}
                >
                  {isUploading ? (
                    <><IconLoader size={16} className="spin" /> Ingesting & OCR Processing ({selectedFiles.length} files)...</>
                  ) : (
                    `Upload & Ingest ${selectedFiles.length > 0 ? selectedFiles.length : ''} Source${selectedFiles.length !== 1 ? 's' : ''}`
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: Direct URL Import */}
          {activeTab === 'link' && (
            <form onSubmit={handleAddLink} className="tab-pane">
              <div className="form-group">
                <label className="form-label">Web Article or YouTube Video URL</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://www.youtube.com/watch?v=... or https://arxiv.org/..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  disabled={isLimitReached}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Custom Title (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. In-Depth Technical Overview"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  disabled={isLimitReached}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!linkUrl.trim() || isAddingLink || isLimitReached}
                >
                  {isAddingLink ? (
                    <><IconLoader size={16} className="spin" /> Extracting Content...</>
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
