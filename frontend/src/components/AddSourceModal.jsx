import React, { useState } from 'react';
import {
  IconX, IconUpload, IconLink, IconSparkles, IconLoader,
  IconCheck, IconYoutube, IconGlobe, IconFileText
} from './Icons';

export default function AddSourceModal({ notebookId, isOpen, onClose, onSourceAdded }) {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'link' | 'generate'
  
  // File Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Link State
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [isAddingLink, setIsAddingLink] = useState(false);

  // Generate / Discover State
  const [prompt, setPrompt] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [candidateResults, setCandidateResults] = useState(null);
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [isAddingCandidates, setIsAddingCandidates] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;
    setIsUploading(true);
    setErrorMsg('');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch(`/api/notebooks/${notebookId}/sources/upload`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Upload failed');
      }
      const data = await res.json();
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
        throw new Error(err.detail || 'Search generation failed');
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
      if (selectedCandidates.length >= 5) {
        alert("You can select up to 5 sources at a time.");
        return;
      }
      setSelectedCandidates(prev => [...prev, item]);
    }
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
        throw new Error(err.detail || 'Failed to import candidates');
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

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">Add Sources to Notebook</h3>
            <p className="modal-sub">Sources are indexed and grounded into your Llama 3.3 70B RAG context.</p>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <IconX size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="modal-error">
            {errorMsg}
          </div>
        )}

        <div className="modal-tabs">
          <button
            className={`modal-tab ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            <IconUpload size={16} /> Upload Files
          </button>
          <button
            className={`modal-tab ${activeTab === 'link' ? 'active' : ''}`}
            onClick={() => setActiveTab('link')}
          >
            <IconLink size={16} /> Link / YouTube
          </button>
          <button
            className={`modal-tab ${activeTab === 'generate' ? 'active' : ''}`}
            onClick={() => setActiveTab('generate')}
          >
            <IconSparkles size={16} /> Discover from Topic
          </button>
        </div>

        <div className="modal-body">
          {/* TAB 1: File Upload */}
          {activeTab === 'upload' && (
            <form onSubmit={handleFileUpload} className="tab-pane">
              <div className="dropzone-area">
                <input
                  type="file"
                  id="source-file-input"
                  accept=".pdf,.txt,.md,.csv,.json"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  style={{ display: 'none' }}
                />
                <label htmlFor="source-file-input" className="dropzone-label">
                  <div className="dropzone-icon">
                    <IconUpload size={32} />
                  </div>
                  <div className="dropzone-text">
                    {selectedFile ? (
                      <span className="file-name-highlight">{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                    ) : (
                      <>
                        <strong>Choose a document</strong> or drag and drop
                        <span className="dropzone-hint">PDF, TXT, Markdown, CSV up to 25MB (Saved to AWS S3)</span>
                      </>
                    )}
                  </div>
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!selectedFile || isUploading}
                >
                  {isUploading ? (
                    <><IconLoader size={16} className="spin" /> Indexing Document...</>
                  ) : (
                    'Upload & Index'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: Web / YouTube URL */}
          {activeTab === 'link' && (
            <form onSubmit={handleAddLink} className="tab-pane">
              <div className="form-group">
                <label className="form-label">Web URL or YouTube Video Link</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://www.youtube.com/watch?v=... or https://arxiv.org/..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  required
                />
                <span className="form-hint">YouTube transcripts and article texts are extracted and embedded automatically.</span>
              </div>

              <div className="form-group">
                <label className="form-label">Optional Custom Title</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Deep Learning Transformer Architecture"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!linkUrl.trim() || isAddingLink}
                >
                  {isAddingLink ? (
                    <><IconLoader size={16} className="spin" /> Extracting & Indexing...</>
                  ) : (
                    'Add Source'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: Discover from Topic */}
          {activeTab === 'generate' && (
            <div className="tab-pane">
              <form onSubmit={handleDiscoverPrompt} className="search-box-row">
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Quantum Computing algorithms and real world use cases"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={isSearching}
                />
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!prompt.trim() || isSearching}
                >
                  {isSearching ? <IconLoader size={16} className="spin" /> : <IconSparkles size={16} />}
                  Find Sources
                </button>
              </form>

              {candidateResults && (
                <div className="candidates-list-wrap">
                  <div className="candidates-header">
                    <span>Generated {candidateResults.candidates.length} sources across YouTube & Web</span>
                    <span className="candidates-selected-count">Selected: {selectedCandidates.length}/5</span>
                  </div>

                  <div className="candidates-grid">
                    {candidateResults.candidates.map((cand, idx) => {
                      const isSel = selectedCandidates.some(c => c.url === cand.url);
                      return (
                        <div
                          key={idx}
                          className={`candidate-card ${isSel ? 'selected' : ''}`}
                          onClick={() => toggleCandidateSelection(cand)}
                        >
                          <div className="candidate-card-top">
                            <span className={`source-type-pill ${cand.type}`}>
                              {cand.type === 'youtube' ? <IconYoutube size={13} /> : <IconGlobe size={13} />}
                              {cand.type === 'youtube' ? 'YouTube Video' : 'Web Article'}
                            </span>
                            <div className={`checkbox-circle ${isSel ? 'checked' : ''}`}>
                              {isSel && <IconCheck size={12} />}
                            </div>
                          </div>
                          <div className="candidate-title">{cand.title}</div>
                          <div className="candidate-snippet">{cand.snippet}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="modal-footer" style={{ marginTop: '16px' }}>
                    <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleImportCandidates}
                      disabled={selectedCandidates.length === 0 || isAddingCandidates}
                    >
                      {isAddingCandidates ? (
                        <><IconLoader size={16} className="spin" /> Ingesting Transcripts...</>
                      ) : (
                        `Import & Index ${selectedCandidates.length} Selected`
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
