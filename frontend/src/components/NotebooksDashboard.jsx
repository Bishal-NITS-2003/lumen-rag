import React, { useState } from 'react';
import { IconLumen, IconPlus, IconTrash, IconBook, IconSparkles, IconLayers, IconLoader } from './Icons';

export default function NotebooksDashboard({
  notebooks = [],
  onCreateNotebook,
  onSelectNotebook,
  onDeleteNotebook,
  systemHealth
}) {
  const [newTitle, setNewTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsCreating(true);
    await onCreateNotebook(newTitle.trim());
    setNewTitle('');
    setIsCreating(false);
    setShowModal(false);
  };

  return (
    <div className="dashboard-container">
      {/* Top Banner */}
      <div className="dashboard-hero">
        <div className="hero-branding">
          <IconLumen size={36} />
          <div>
            <h1 className="hero-title">Lumen Notebooks</h1>
            <p className="hero-sub">
              Your personalized AI research workspace powered by Meta Llama 3.3 70B & AWS.
            </p>
          </div>
        </div>

        <div className="hero-stats-row">
          <div className="hero-stat-pill">
            <span className="stat-label">Model:</span>
            <span className="stat-value">{systemHealth?.llm_engine || 'Meta Llama 3.3 70B'}</span>
          </div>
          <div className="hero-stat-pill">
            <span className="stat-label">Database:</span>
            <span className="stat-value">{systemHealth?.database || 'SQLAlchemy / RDS Ready'}</span>
          </div>
          <div className="hero-stat-pill">
            <span className="stat-label">Storage:</span>
            <span className="stat-value">{systemHealth?.aws_s3_connected ? 'AWS S3 (Active)' : 'Local Storage Fallback'}</span>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="dashboard-action-bar">
        <div className="dashboard-section-title">
          <h2>All Notebooks</h2>
          <span className="notebooks-count-badge">{notebooks.length}</span>
        </div>

        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <IconPlus size={16} /> New Notebook
        </button>
      </div>

      {/* Notebooks Grid */}
      <div className="notebooks-grid">
        {notebooks.length === 0 ? (
          <div className="empty-dashboard-card" onClick={() => setShowModal(true)}>
            <div className="empty-icon-wrap">
              <IconPlus size={28} />
            </div>
            <h3>Create your first notebook</h3>
            <p>Upload research papers, YouTube videos, or articles and synthesize with Llama 3.3 70B.</p>
          </div>
        ) : (
          notebooks.map((nb) => (
            <div
              key={nb.id}
              className="notebook-card"
              onClick={() => onSelectNotebook(nb.id)}
            >
              <div className="notebook-card-top">
                <div className="notebook-icon-wrap">
                  <IconBook size={20} />
                </div>
                <button
                  className="notebook-delete-btn"
                  title="Delete notebook"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete notebook "${nb.title}"?`)) {
                      onDeleteNotebook(nb.id);
                    }
                  }}
                >
                  <IconTrash size={14} />
                </button>
              </div>

              <h3 className="notebook-title">{nb.title}</h3>
              {nb.description && <p className="notebook-desc">{nb.description}</p>}

              <div className="notebook-card-footer">
                <span className="source-count-pill">
                  {nb.source_count} {nb.source_count === 1 ? 'source' : 'sources'}
                </span>
                <span className="notebook-date">
                  {new Date(nb.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Notebook Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Create New Notebook</h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate} className="modal-body">
              <div className="form-group">
                <label className="form-label">Notebook Title</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. LLM Reasoning Papers & Benchmarks"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={!newTitle.trim() || isCreating}>
                  {isCreating ? <IconLoader size={16} className="spin" /> : 'Create Notebook'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
