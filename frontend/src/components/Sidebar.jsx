import React from 'react';
import {
  IconLumen, IconPlus, IconTrash, IconMessageSquare,
  IconDatabase, IconSun, IconMoon
} from './Icons';

export default function Sidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  darkMode,
  onToggleDark
}) {
  const fmt = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  return (
    <aside style={{
      width: 'var(--sidebar-w)',
      height: '100vh',
      background: 'var(--bg-panel)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      transition: 'background var(--transition)',
    }}>
      {/* Brand */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <IconLumen size={32} />
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.4px' }}>
                Lumen Notebook
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: 500, letterSpacing: '0.3px' }}>
                AI Research Assistant
              </div>
            </div>
          </div>

          <button
            className="btn-icon"
            onClick={onToggleDark}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              padding: '6px',
              borderRadius: 'var(--r-md)',
              color: 'var(--text-3)',
              transition: 'all var(--transition)',
            }}
          >
            {darkMode
              ? <IconSun size={15} />
              : <IconMoon size={15} />
            }
          </button>
        </div>

        <button
          className="btn btn-primary"
          onClick={onNewChat}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          <IconPlus size={14} />
          New Research
        </button>
      </div>

      {/* History */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
        <div style={{
          padding: '6px 8px 8px',
          fontSize: '10px',
          fontWeight: 700,
          color: 'var(--text-3)',
          textTransform: 'uppercase',
          letterSpacing: '0.8px'
        }}>
          Sessions
        </div>

        {sessions.length === 0 ? (
          <div style={{
            padding: '32px 12px',
            textAlign: 'center',
            color: 'var(--text-3)',
            fontSize: '13px',
            lineHeight: 1.6
          }}>
            <IconMessageSquare size={28} style={{ marginBottom: '10px', opacity: 0.4, display: 'block', margin: '0 auto 10px' }} />
            No sessions yet.<br />
            Start a new research prompt.
          </div>
        ) : (
          sessions.map((sess, i) => {
            const isActive = sess.session_id === currentSessionId;
            return (
              <div
                key={sess.session_id}
                className="slide-left"
                onClick={() => onSelectSession(sess.session_id)}
                style={{
                  padding: '9px 10px',
                  borderRadius: 'var(--r-md)',
                  background: isActive ? 'var(--bg-active)' : 'transparent',
                  border: `1px solid ${isActive ? 'color-mix(in srgb, var(--blue) 30%, transparent)' : 'transparent'}`,
                  marginBottom: '3px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '6px',
                  transition: 'all var(--transition)',
                  animationDelay: `${i * 30}ms`,
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '12.5px',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--blue)' : 'var(--text)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginBottom: '3px'
                  }}>
                    {sess.title || 'Untitled'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>
                      {fmt(sess.created_at)}
                    </span>
                    {sess.is_indexed && (
                      <span className="tag tag-green" style={{ fontSize: '9px', padding: '1px 6px' }}>
                        {sess.source_count} src
                      </span>
                    )}
                  </div>
                </div>

                <button
                  className="btn-icon danger"
                  title="Delete"
                  onClick={e => { e.stopPropagation(); onDeleteSession(sess.session_id); }}
                  style={{ padding: '4px', flexShrink: 0, borderRadius: '6px' }}
                >
                  <IconTrash size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IconDatabase size={12} color="var(--text-3)" />
          <span style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: 500 }}>LangChain RAG</span>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--green-text)' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
          Online
        </span>
      </div>
    </aside>
  );
}
