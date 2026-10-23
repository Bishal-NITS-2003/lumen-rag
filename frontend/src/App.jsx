import React, { useState, useEffect } from 'react';
import {
  IconLumen, IconArrowLeft, IconSun, IconMoon,
  IconEdit, IconGoogle, IconLogOut
} from './components/Icons';
import { signInWithGoogle, logOut, subscribeToAuth } from './firebase';
import NotebooksDashboard from './components/NotebooksDashboard';
import SourcesPanel from './components/SourcesPanel';
import ChatPanel from './components/ChatPanel';
import NotesPanel from './components/NotesPanel';
import AddSourceModal from './components/AddSourceModal';
import SourceViewerModal from './components/SourceViewerModal';

export default function App() {
  // Parse current route from URL (hash or pathname)
  const getRouteNotebookId = () => {
    try {
      const hashMatch = window.location.hash.match(/^#\/notebook\/([a-zA-Z0-9_-]+)/);
      if (hashMatch) return hashMatch[1];
      const pathMatch = window.location.pathname.match(/^\/notebook\/([a-zA-Z0-9_-]+)/);
      if (pathMatch) return pathMatch[1];
    } catch {}
    return null;
  };

  const initialNbId = getRouteNotebookId();
  const [view, setView] = useState(initialNbId ? 'notebook' : 'dashboard');
  const [notebooks, setNotebooks] = useState([]);
  const [currentNotebookId, setCurrentNotebookId] = useState(initialNbId);
  const [currentNotebook, setCurrentNotebook] = useState(null);

  // User Auth State
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [systemHealth, setSystemHealth] = useState(null);
  const [isLoadingNotebooks, setIsLoadingNotebooks] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [deletingNotebookId, setDeletingNotebookId] = useState(null);
  const [deletingSourceId, setDeletingSourceId] = useState(null);

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

  // Subscribe to Firebase Auth changes
  useEffect(() => {
    const unsub = subscribeToAuth((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Fetch notebooks when user changes
  useEffect(() => {
    if (user?.uid) {
      fetchNotebooks(user.uid);
    } else {
      setNotebooks([]);
      setIsLoadingNotebooks(false);
    }
    fetchHealth();
  }, [user]);

  // Sync route on popstate and hashchange (browser forward/back & page refresh)
  useEffect(() => {
    const handleRouteSync = () => {
      const nbId = getRouteNotebookId();
      if (nbId) {
        setCurrentNotebookId(nbId);
        setView('notebook');
        loadNotebookDetail(nbId);
      } else {
        setCurrentNotebookId(null);
        setView('dashboard');
        setCurrentNotebook(null);
      }
    };

    window.addEventListener('popstate', handleRouteSync);
    window.addEventListener('hashchange', handleRouteSync);

    const initialId = getRouteNotebookId();
    if (initialId) {
      loadNotebookDetail(initialId);
    }

    return () => {
      window.removeEventListener('popstate', handleRouteSync);
      window.removeEventListener('hashchange', handleRouteSync);
    };
  }, []);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) setSystemHealth(await res.json());
    } catch {}
  };

  const fetchNotebooks = async (userId = user?.uid) => {
    if (!userId) {
      setNotebooks([]);
      setIsLoadingNotebooks(false);
      return;
    }
    setIsLoadingNotebooks(true);
    try {
      const headers = { 'X-User-Id': userId };
      const res = await fetch('/api/notebooks', { headers });
      if (res.ok) {
        const data = await res.json();
        setNotebooks(data);
      } else {
        setNotebooks([]);
      }
    } catch {
      setNotebooks([]);
    } finally {
      setIsLoadingNotebooks(false);
    }
  };

  const loadNotebookDetail = async (id, currentUser = user) => {
    if (!id) return;
    setIsLoadingDetail(true);
    try {
      const headers = {};
      if (currentUser?.uid) headers['X-User-Id'] = currentUser.uid;
      const res = await fetch(`/api/notebooks/${id}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setCurrentNotebook(data);
        setEditableTitle(data.title);
      }
    } catch (err) {
      console.error('Failed to load notebook detail:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleSelectNotebook = (id) => {
    setCurrentNotebookId(id);
    setView('notebook');
    window.history.pushState({}, '', `#/notebook/${id}`);
    loadNotebookDetail(id);
  };

  const handleBackToDashboard = () => {
    setView('dashboard');
    setCurrentNotebookId(null);
    setCurrentNotebook(null);
    window.history.pushState({}, '', '#/');
    fetchNotebooks();
  };

  const handleGoogleSignIn = async () => {
    try {
      const loggedUser = await signInWithGoogle();
      if (loggedUser) {
        setUser(loggedUser);
        fetchNotebooks(loggedUser.uid);
      }
      return loggedUser;
    } catch (err) {
      alert(`Google sign in failed: ${err.message}`);
      return null;
    }
  };

  const handleSignOut = async () => {
    try {
      await logOut();
      setUser(null);
      setNotebooks([]);
      setCurrentNotebook(null);
      setCurrentNotebookId(null);
      setView('dashboard');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const handleCreateNotebook = async (title) => {
    if (!user) {
      const logged = await handleGoogleSignIn();
      if (!logged) return;
    }
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (user?.uid) headers['X-User-Id'] = user.uid;
      const res = await fetch('/api/notebooks', {
        method: 'POST',
        headers,
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
    setDeletingNotebookId(id);
    try {
      const headers = {};
      if (user?.uid) headers['X-User-Id'] = user.uid;
      const res = await fetch(`/api/notebooks/${id}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to delete notebook');
      }
      setNotebooks(prev => prev.filter(n => n.id !== id));
      if (currentNotebookId === id) {
        handleBackToDashboard();
      }
    } catch (err) {
      console.error('Failed to delete notebook:', err);
      alert(`Could not delete notebook: ${err.message}`);
    } finally {
      setDeletingNotebookId(null);
    }
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
    const newItems = Array.isArray(newSource) ? newSource : [newSource];
    setCurrentNotebook(prev => ({
      ...prev,
      sources: [...newItems, ...(prev?.sources || [])]
    }));
    setNotebooks(prev => prev.map(n => n.id === currentNotebookId ? { ...n, source_count: (n.source_count || 0) + newItems.length } : n));
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
    setDeletingSourceId(sourceId);
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
    } finally {
      setDeletingSourceId(null);
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
  const handleSendMessage = async (text, model = 'openai/gpt-oss-120b') => {
    if (!user) {
      const logged = await handleGoogleSignIn();
      if (!logged) {
        alert('Please sign in with your Google account to chat.');
        return;
      }
    }

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
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user ? user.uid : ''
        },
        body: JSON.stringify({ message: text, model })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const errorObj = new Error(err.detail || 'Chat query failed');
        errorObj.status = res.status;
        throw errorObj;
      }
      const assistantMsg = await res.json();
      setCurrentNotebook(prev => ({
        ...prev,
        messages: [...prev.messages.filter(m => m.id !== tempUserMsg.id), tempUserMsg, assistantMsg]
      }));
      return { success: true };
    } catch (err) {
      setCurrentNotebook(prev => ({
        ...prev,
        messages: prev.messages.filter(m => m.id !== tempUserMsg.id)
      }));
      throw err;
    } finally {
      setIsLoadingChat(false);
    }
  };

  const handleClearChat = async () => {
    if (!confirm('Clear all chat history for this notebook?')) return;
    try {
      await fetch(`/api/notebooks/${currentNotebookId}/chat`, {
        method: 'DELETE',
        headers: { ...(user?.uid ? { 'X-User-Id': user.uid } : {}) }
      });
      setCurrentNotebook(prev => ({ ...prev, messages: [] }));
    } catch {}
  };

  // ── Append user selection / message to Manual Notes (Optimistic immediate update) ────────
  const handleAddToNote = async (textToAdd) => {
    if (!textToAdd || !textToAdd.trim()) return;
    const trimmed = textToAdd.trim();

    // 1. Optimistic immediate frontend update so user sees it without waiting
    const currentContent = currentNotebook?.manual_note?.content || '';
    const updatedContent = currentContent.trim() ? `${currentContent.trim()}\n\n${trimmed}` : trimmed;

    setCurrentNotebook(prev => ({
      ...prev,
      manual_note: {
        ...(prev?.manual_note || {}),
        notebook_id: currentNotebookId,
        content: updatedContent,
        updated_at: new Date().toISOString()
      }
    }));

    // 2. Persist to DB in background
    try {
      const res = await fetch(`/api/notebooks/${currentNotebookId}/note/append`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.uid ? { 'X-User-Id': user.uid } : {})
        },
        body: JSON.stringify({ text: trimmed })
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
            <button className="back-to-dashboard-btn" onClick={handleBackToDashboard}>
              <IconArrowLeft size={16} />
              <span>Notebooks</span>
            </button>
          ) : (
            <div className="logo-brand-wrap">
              <IconLumen size={26} />
              <span className="logo-brand-text">Lumen Notebook</span>
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
          <button
            className="theme-toggle-btn"
            onClick={() => setDarkMode(!darkMode)}
            title="Toggle theme"
          >
            {darkMode ? <IconSun size={17} /> : <IconMoon size={17} />}
          </button>

          {/* Google Authentication Control */}
          {!user ? (
            <button className="header-google-signin-btn" onClick={handleGoogleSignIn}>
              <IconGoogle size={15} />
              <span>Sign in with Google</span>
            </button>
          ) : (
            <div className="header-user-badge">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName} className="header-user-avatar" />
              ) : (
                <div className="header-user-avatar-initial">
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'G'}
                </div>
              )}
              <span className="header-user-name" title={user.email}>
                {user.displayName || 'Google User'}
              </span>
              <button className="header-logout-btn" onClick={handleSignOut} title="Sign Out">
                <IconLogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      {view === 'dashboard' ? (
        <NotebooksDashboard
          notebooks={notebooks}
          isLoading={isLoadingNotebooks}
          deletingNotebookId={deletingNotebookId}
          user={user}
          onGoogleSignIn={handleGoogleSignIn}
          onCreateNotebook={handleCreateNotebook}
          onSelectNotebook={handleSelectNotebook}
          onDeleteNotebook={handleDeleteNotebook}
        />
      ) : (
        <div className="notebook-workspace-3col">
          {/* Column 1: Sources with View eye icon & extraction error badge */}
          <SourcesPanel
            sources={currentNotebook?.sources || []}
            isLoading={isLoadingDetail}
            deletingSourceId={deletingSourceId}
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
            user={user}
            onGoogleSignIn={handleGoogleSignIn}
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
