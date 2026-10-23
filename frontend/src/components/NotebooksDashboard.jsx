import React, { useState } from 'react';
import { IconLumen, IconPlus, IconTrash, IconBook, IconLoader, IconGoogle } from './Icons';

export default function NotebooksDashboard({
  notebooks = [],
  isLoading = false,
  deletingNotebookId = null,
  user = null,
  onGoogleSignIn,
  onCreateNotebook,
  onSelectNotebook,
  onDeleteNotebook,
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

  const handleOpenCreateModal = () => {
    if (!user && onGoogleSignIn) {
      onGoogleSignIn();
      return;
    }
    setShowModal(true);
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="dashboard-container">
      {/* Hero */}
      <div className="dashboard-hero">
        <div className="hero-branding">
          <div className="hero-icon-wrap">
            <IconLumen size={32} />
          </div>
          <div>
            {user ? (
              <>
                <h1 className="hero-title">
                  {greeting()}, {user.displayName?.split(' ')[0] || 'there'} 👋
                </h1>
                <p className="hero-sub">
                  Your research notebooks are ready. Pick one to continue, or start something new.
                </p>
              </>
            ) : (
              <>
                <h1 className="hero-title">Welcome to Lumen Notebook</h1>
                <p className="hero-sub">
                  Your AI research workspace. Summarize papers, videos, and articles — grounded in the sources you choose.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="dashboard-action-bar">
        <div className="dashboard-section-title">
          <h2>My Notebooks</h2>
          {notebooks.length > 0 && (
            <span className="notebooks-count-badge">{notebooks.length}</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {!user && (
            <button
              type="button"
              className="btn-google-action"
              onClick={onGoogleSignIn}
            >
              <IconGoogle size={15} />
              <span>Sign in</span>
            </button>
          )}
          <button className="btn-primary" onClick={handleOpenCreateModal}>
            <IconPlus size={16} /> New Notebook
          </button>
        </div>
      </div>

      {/* Notebooks Grid */}
      <div className="notebooks-grid">
        {isLoading ? (
          [1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="skeleton-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="skeleton skeleton-icon" />
                <div className="skeleton" style={{ width: '22px', height: '22px', borderRadius: '4px' }} />
              </div>
              <div className="skeleton skeleton-line medium" style={{ height: '18px', marginTop: '6px' }} />
              <div className="skeleton skeleton-line full" style={{ height: '12px' }} />
              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between' }}>
                <div className="skeleton skeleton-line short" style={{ height: '12px' }} />
                <div className="skeleton skeleton-line short" style={{ height: '12px', width: '25%' }} />
              </div>
            </div>
          ))
        ) : notebooks.length === 0 ? (
          !user ? (
            <div className="empty-dashboard-card" onClick={handleOpenCreateModal}>
              <div className="empty-icon-wrap">
                <IconGoogle size={28} />
              </div>
              <h3>Sign in to get started</h3>
              <p>Save and sync your research notebooks across devices.</p>
              <button
                type="button"
                className="btn-primary"
                style={{ marginTop: '14px', gap: '8px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onGoogleSignIn) onGoogleSignIn();
                }}
              >
                <IconGoogle size={15} /> Continue with Google
              </button>
            </div>
          ) : (
            <div className="empty-dashboard-card" onClick={handleOpenCreateModal}>
              <div className="empty-icon-wrap">
                <IconPlus size={28} />
              </div>
              <h3>Create your first notebook</h3>
              <p>Add sources — PDFs, YouTube videos, or web articles — and start asking questions.</p>
            </div>
          )
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
                  type="button"
                  className="notebook-delete-btn"
                  title={deletingNotebookId === nb.id ? 'Deleting...' : 'Delete notebook'}
                  disabled={deletingNotebookId === nb.id}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.confirm(`Delete "${nb.title}"? This cannot be undone.`)) {
                      onDeleteNotebook(nb.id);
                    }
                  }}
                >
                  {deletingNotebookId === nb.id ? (
                    <IconLoader size={14} className="spin" />
                  ) : (
                    <IconTrash size={14} />
                  )}
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
              <h3 className="modal-title">New Notebook</h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate} className="modal-body">
              <div className="form-group">
                <label className="form-label">What are you researching?</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Climate Policy 2024, LLM Research Papers…"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                  required
                />
                <span className="form-hint">You can rename this anytime from inside the notebook.</span>
              </div>
              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={!newTitle.trim() || isCreating}>
                  {isCreating ? <IconLoader size={16} className="spin" /> : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
