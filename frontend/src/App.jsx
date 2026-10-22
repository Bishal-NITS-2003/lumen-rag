import React, { useState, useEffect } from 'react';
import {
  IconLumen, IconArrowLeft, IconSun, IconMoon, IconSparkles,
  IconEdit, IconDatabase, IconFileText
} from './components/Icons';
import NotebooksDashboard from './components/NotebooksDashboard';
import SourcesPanel from './components/SourcesPanel';
import ChatPanel from './components/ChatPanel';
import NotesPanel from './components/NotesPanel';
import AddSourceModal from './components/AddSourceModal';
import SourceViewerModal from './components/SourceViewerModal';

export default function App() {
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'notebook'
  const [notebooks, setNotebooks] = useState([]);
  const [currentNotebookId, setCurrentNotebookId] = useState(null);
  const [currentNotebook, setCurrentNotebook] = useState(null);

  const [systemHealth, setSystemHealth] = useState(null);
  const [isLoadingChat, setIsLoadingChat] = useState(false);

  // Modals
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [viewingSourceId, setViewingSourceId] = useState(null);
  const [citationHighlight, setCitationHighlight] = useState(null);

  // Title Editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editableTitle, setEditableTitle] = useState('');

  // Dark mode
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('lumen-dark') === 'true'; } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    try { localStorage.setItem('lumen-dark', darkMode); } catch {}
  }, [darkMode]);

  useEffect(() => {
    fetchNotebooks();
    fetchHealth();
  }, []);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) setSystemHealth(await res.json());
    } catch {}
  };

  const fetchNotebooks = async () => {
    try {
      const res = await fetch('/api/notebooks');
      if (res.ok) {
        const data = await res.json();
        setNotebooks(data);
      }
    } catch {}
  };

  const loadNotebookDetail = async (id) => {
    try {
      const res = await fetch(`/api/notebooks/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentNotebook(data);
        setEditableTitle(data.title);
      }
    } catch {}
  };

  const handleSelectNotebook = (id) => {
    setCurrentNotebookId(id);
    setView('notebook');
    loadNotebookDetail(id);
  };

  const handleCreateNotebook = async (title) => {
    try {
      const res = await fetch('/api/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      if (res.ok) {
        const newNb = await res.json();
        setNotebooks(prev => [newNb, ...prev]);
        handleSelectNotebook(newNb.id);
      }
    } catch (err) {
      alert(`Could not create notebook: ${err.message}`);
    }
  };

  const handleDeleteNotebook = async (id) => {
    try {
      await fetch(`/api/notebooks/${id}`, { method: 'DELETE' });
      setNotebooks(prev => prev.filter(n => n.id !== id));
      if (currentNotebookId === id) {
        setView('dashboard');
        setCurrentNotebook(null);
        setCurrentNotebookId(null);
      }
    } catch {}
  };

  const handleSaveTitle = async () => {
    if (!editableTitle.trim() || editableTitle === currentNotebook?.title) {
      setIsEditingTitle(false);
      return;
    }
    try {
      const res = await fetch(`/api/notebooks/${currentNotebookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editableTitle.trim() })
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentNotebook(prev => ({ ...prev, title: updated.title }));
        setNotebooks(prev => prev.map(n => n.id === currentNotebookId ? { ...n, title: updated.title } : n));
      }
    } catch {}
    finally {
      setIsEditingTitle(false);
    }
  };

  // ── Source handlers ───────────────────────────────────────
  const handleSourceAdded = (newSource) => {
    setCurrentNotebook(prev => ({
      ...prev,
      sources: [newSource, ...(prev?.sources || [])]
    }));
    setNotebooks(prev => prev.map(n => n.id === currentNotebookId ? { ...n, source_count: (n.source_count || 0) + 1 } : n));
  };

  const handleToggleSource = async (sourceId, isActive) => {
    try {
      const res = await fetch(`/api/notebooks/${currentNotebookId}/sources/${sourceId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive })
      });
      if (res.ok) {
        setCurrentNotebook(prev => ({
          ...prev,
          sources: prev.sources.map(s => s.id === sourceId ? { ...s, is_active: isActive } : s)
        }));
      }
    } catch {}
  };

  const handleDeleteSource = async (sourceId) => {
    try {
      const res = await fetch(`/api/notebooks/${currentNotebookId}/sources/${sourceId}`, { method: 'DELETE' });
      if (res.ok) {
        setCurrentNotebook(prev => ({
          ...prev,
          sources: (prev?.sources || []).filter(s => s.id !== sourceId)
        }));
        setNotebooks(prev => prev.map(n => n.id === currentNotebookId ? { ...n, source_count: Math.max(0, (n.source_count || 1) - 1) } : n));
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Failed to delete source: ${err.detail || 'Server error'}`);
      }
    } catch (err) {
      alert(`Network error deleting source: ${err.message}`);
    }
  };

  // Open source viewer popup from left panel (eye icon)
  const handleSelectSource = (sourceId) => {
    setCitationHighlight(null);
    setViewingSourceId(sourceId);
  };

  // Open source viewer popup from chat citation and scroll to cited passage
  const handleSelectCitation = (sourceId, snippet) => {
    setCitationHighlight(snippet);
    setViewingSourceId(sourceId);
  };

  // ── Chat handlers ─────────────────────────────────────────
  const handleSendMessage = async (text) => {
    setIsLoadingChat(true);
    const tempUserMsg = {
      id: 'temp_' + Date.now(),
      notebook_id: currentNotebookId,
      role: 'user',
      content: text,
      citations: [],
      created_at: new Date().toISOString()
    };
    setCurrentNotebook(prev => ({
      ...prev,
      messages: [...(prev?.messages || []), tempUserMsg]
    }));

    try {
      const res = await fetch(`/api/notebooks/${currentNotebookId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Chat query failed');
      }
      const assistantMsg = await res.json();
      setCurrentNotebook(prev => ({
        ...prev,
        messages: [...prev.messages.filter(m => m.id !== tempUserMsg.id), tempUserMsg, assistantMsg]
      }));
    } catch (err) {
      alert(`Chat error: ${err.message}`);
      setCurrentNotebook(prev => ({
        ...prev,
        messages: prev.messages.filter(m => m.id !== tempUserMsg.id)
      }));
    } finally {
      setIsLoadingChat(false);
    }
  };

  const handleClearChat = async () => {
    if (!confirm('Clear all chat history for this notebook?')) return;
    try {
      await fetch(`/api/notebooks/${currentNotebookId}/chat`, { method: 'DELETE' });
      setCurrentNotebook(prev => ({ ...prev, messages: [] }));
    } catch {}
  };

  // ── Append user selection / message to Manual Notes ────────
  const handleAddToNote = async (textToAdd) => {
    if (!textToAdd || !textToAdd.trim()) return;
    try {
      const res = await fetch(`/api/notebooks/${currentNotebookId}/note/append`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToAdd.trim() })
      });
      if (res.ok) {
        const updatedNote = await res.json();
        setCurrentNotebook(prev => ({
          ...prev,
          manual_note: updatedNote
        }));
      }
    } catch (err) {
      console.error('Error appending text to note:', err);
    }
  };

  return (
    <div className="app-shell">
      {/* Universal Top Header */}
      <header className="app-top-header">
        <div className="header-left-col">
          {view === 'notebook' ? (
            <button className="back-to-dashboard-btn" onClick={() => { setView('dashboard'); fetchNotebooks(); }}>
              <IconArrowLeft size={16} />
              <span>Notebooks</span>
            </button>
          ) : (
            <div className="logo-brand-wrap">
              <IconLumen size={26} />
              <span className="logo-brand-text">Lumen</span>
            </div>
          )}

          {view === 'notebook' && currentNotebook && (
            <div className="notebook-title-editor-wrap">
              {isEditingTitle ? (
                <input
                  type="text"
                  className="notebook-inline-input"
                  value={editableTitle}
                  onChange={(e) => setEditableTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                  autoFocus
                />
              ) : (
                <div className="notebook-display-title-row" onClick={() => setIsEditingTitle(true)}>
                  <h1 className="active-notebook-title">{currentNotebook.title}</h1>
                  <IconEdit size={14} className="edit-pencil-icon" />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="header-right-col">
          <div className="status-badge model-badge">
            <IconSparkles size={13} />
            <span>{systemHealth?.llm_engine || 'DeepSeek-R1 / Qwen Reasoning'}</span>
          </div>

          <div className="status-badge db-badge">
            <IconDatabase size={13} />
            <span>{systemHealth?.database || 'Database'}</span>
          </div>

          <button
            className="theme-toggle-btn"
            onClick={() => setDarkMode(!darkMode)}
            title="Toggle theme"
          >
            {darkMode ? <IconSun size={17} /> : <IconMoon size={17} />}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      {view === 'dashboard' ? (
        <NotebooksDashboard
          notebooks={notebooks}
          onCreateNotebook={handleCreateNotebook}
          onSelectNotebook={handleSelectNotebook}
          onDeleteNotebook={handleDeleteNotebook}
          systemHealth={systemHealth}
        />
      ) : (
        <div className="notebook-workspace-3col">
          {/* Column 1: Sources with View eye icon & extraction error badge */}
          <SourcesPanel
            sources={currentNotebook?.sources || []}
            onOpenAddModal={() => setIsAddSourceOpen(true)}
            onToggleSource={handleToggleSource}
            onDeleteSource={handleDeleteSource}
            onSelectSourceDetail={handleSelectSource}
          />

          {/* Column 2: Grounded Chat with text selection -> Add to Note & Citation Scroll */}
          <ChatPanel
            notebookTitle={currentNotebook?.title || 'Notebook'}
            messages={currentNotebook?.messages || []}
            sources={currentNotebook?.sources || []}
            isLoading={isLoadingChat}
            onSendMessage={handleSendMessage}
            onClearChat={handleClearChat}
            onSelectCitation={handleSelectCitation}
            onAddToNote={handleAddToNote}
          />

          {/* Column 3: Manual Notes Section with DB Sync & TXT Export */}
          <NotesPanel
            notebookId={currentNotebookId}
            notebookTitle={currentNotebook?.title || 'Research_Notes'}
            initialNote={currentNotebook?.manual_note}
            onNoteUpdated={(updatedNote) => {
              setCurrentNotebook(prev => ({
                ...prev,
                manual_note: updatedNote
              }));
            }}
          />
        </div>
      )}

      {/* Modals */}
      <AddSourceModal
        notebookId={currentNotebookId}
        isOpen={isAddSourceOpen}
        onClose={() => setIsAddSourceOpen(false)}
        onSourceAdded={handleSourceAdded}
        currentSourcesCount={currentNotebook?.sources?.length || 0}
      />

      <SourceViewerModal
        notebookId={currentNotebookId}
        sourceId={viewingSourceId}
        isOpen={Boolean(viewingSourceId)}
        onClose={() => {
          setViewingSourceId(null);
          setCitationHighlight(null);
        }}
        highlightSnippet={citationHighlight}
      />
    </div>
  );
}
