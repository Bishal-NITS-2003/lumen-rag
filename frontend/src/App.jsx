import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(() => 'sess_' + Math.random().toString(36).substring(2, 10));
  const [currentSession, setCurrentSession] = useState({
    session_id: '',
    title: 'New Research',
    is_indexed: false,
    indexed_sources: [],
    chat_history: []
  });

  const [searchState, setSearchState] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [lastPrompt, setLastPrompt] = useState('');

  // Live indexing activity log
  const [indexingLogs, setIndexingLogs] = useState([]);

  // Dark mode — persist in localStorage
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('lumen-dark') === 'true'; } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    try { localStorage.setItem('lumen-dark', darkMode); } catch {}
  }, [darkMode]);

  useEffect(() => { fetchSessions(); }, []);

  useEffect(() => {
    if (currentSessionId) loadSessionDetails(currentSessionId);
  }, [currentSessionId]);

  const fetchSessions = async () => {
    try {
      const r = await fetch('/api/sessions');
      if (r.ok) setSessions(await r.json());
    } catch {}
  };

  const loadSessionDetails = async (sid) => {
    try {
      const r = await fetch(`/api/sessions/${sid}`);
      if (r.ok) {
        const data = await r.json();
        setCurrentSession(data);
        if (data.is_indexed) setSearchState(null);
      }
    } catch {}
  };

  const handleNewChat = () => {
    const id = 'sess_' + Math.random().toString(36).substring(2, 10);
    setCurrentSessionId(id);
    setCurrentSession({ session_id: id, title: 'New Research', is_indexed: false, indexed_sources: [], chat_history: [] });
    setSearchState(null);
    setIndexingLogs([]);
    setLastPrompt('');
  };

  const handleDeleteSession = async (sid) => {
    try {
      await fetch(`/api/sessions/${sid}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.session_id !== sid));
      if (currentSessionId === sid) handleNewChat();
    } catch {}
  };

  const handleGenerateSources = async (prompt) => {
    setLastPrompt(prompt);
    setIsSearching(true);
    setSearchState(null);
    try {
      const r = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: currentSessionId, prompt })
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.detail || `Error ${r.status}`);
      }
      const data = await r.json();
      setSearchState({ ...data, selected_items: [] });
      setCurrentSession(prev => ({ ...prev, title: prompt.substring(0, 36) }));
      fetchSessions();
    } catch (err) {
      alert(`Search failed: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleToggleSource = (item) => {
    if (!searchState) return;
    setSearchState(prev => {
      const exists = prev.selected_items.some(s => s.link === item.link);
      if (!exists && prev.selected_items.length >= 5) {
        alert('Max 5 sources. Deselect one to swap.');
        return prev;
      }
      const updated = exists
        ? prev.selected_items.filter(s => s.link !== item.link)
        : [...prev.selected_items, item];
      return { ...prev, selected_items: updated };
    });
  };

  const handleIndexSources = async () => {
    if (!searchState || searchState.selected_items.length === 0) return;
    setIsIndexing(true);
    setIndexingLogs([]);

    // Build synthetic live log from selected items
    const items = searchState.selected_items;
    const logInterval = setInterval(() => {
      setIndexingLogs(prev => {
        if (prev.length < items.length) {
          const item = items[prev.length];
          return [...prev, {
            ok: false,
            text: item.type === 'youtube'
              ? `Fetching transcript: "${item.title.substring(0, 48)}…"`
              : `Scraping article: "${item.title.substring(0, 48)}…"`
          }];
        }
        clearInterval(logInterval);
        return prev;
      });
    }, 800);

    try {
      const r = await fetch('/api/index-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: currentSessionId, selected_items: items })
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.detail || `Error ${r.status}`);
      }
      const data = await r.json();
      clearInterval(logInterval);
      setIndexingLogs(items.map(i => ({ ok: true, text: `Indexed: ${i.title.substring(0, 52)}` })));

      setCurrentSession(prev => ({
        ...prev,
        is_indexed: true,
        indexed_sources: data.sources,
        chat_history: [{
          role: 'assistant',
          content: `Knowledge base built from ${data.indexed_count} source${data.indexed_count !== 1 ? 's' : ''} — ${data.chunks_count} chunks ready.\n\nWhat would you like to know?`
        }]
      }));
      setSearchState(null);
      fetchSessions();
    } catch (err) {
      clearInterval(logInterval);
      alert(`Indexing failed: ${err.message}`);
    } finally {
      setIsIndexing(false);
    }
  };

  const handleSendMessage = async (msgText) => {
    if (!msgText.trim() || isAnswering) return;
    setCurrentSession(prev => ({
      ...prev,
      chat_history: [...(prev.chat_history || []), { role: 'user', content: msgText }]
    }));
    setIsAnswering(true);
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: currentSessionId, message: msgText })
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.detail || `Error ${r.status}`);
      }
      const data = await r.json();
      setCurrentSession(prev => ({
        ...prev,
        chat_history: [...(prev.chat_history || []), { role: 'assistant', content: data.content }]
      }));
      fetchSessions();
    } catch (err) {
      setCurrentSession(prev => ({
        ...prev,
        chat_history: [...(prev.chat_history || []), { role: 'assistant', content: `Something went wrong: ${err.message}` }]
      }));
    } finally {
      setIsAnswering(false);
    }
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={setCurrentSessionId}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode(d => !d)}
      />
      <ChatArea
        currentSession={currentSession}
        searchState={searchState}
        isSearching={isSearching}
        isIndexing={isIndexing}
        indexingLogs={indexingLogs}
        onGenerateSources={handleGenerateSources}
        onToggleSource={handleToggleSource}
        onIndexSources={handleIndexSources}
        onSendMessage={handleSendMessage}
        isAnswering={isAnswering}
        lastPrompt={lastPrompt}
      />
    </div>
  );
}
