import React, { useState, useRef, useEffect } from 'react';
import SourceSelector from './SourceSelector';
import {
  IconSearch, IconSend, IconDatabase, IconYoutube,
  IconGlobe, IconSparkles, IconBook, IconCpu, IconZap
} from './Icons';

/* ─── Skeleton block ──────────────────────────────────────────────── */
function Skeleton({ w = '100%', h = 16, r = 'var(--r-md)', style = {} }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

/* ─── Skeleton loading screen while searching ─────────────────────── */
function SearchSkeleton({ prompt }) {
  const steps = [
    { icon: IconSparkles, label: 'Sending your topic to Gemini…',           color: 'var(--blue)' },
    { icon: IconZap,      label: 'Generating 5 focused search queries…',    color: 'var(--amber)' },
    { icon: IconYoutube,  label: 'Fetching top YouTube videos per query…',  color: 'var(--red)' },
    { icon: IconGlobe,    label: 'Retrieving articles from Google Search…', color: 'var(--green)' },
    { icon: IconDatabase, label: 'Assembling your source library…',         color: 'var(--blue)' },
  ];

  return (
    <div className="fade-in" style={{
      maxWidth: '680px', margin: '0 auto',
      display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '12px'
    }}>
      {/* Topic pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '12px 16px',
        background: 'var(--bg-panel)',
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <span className="spin" style={{ display: 'flex', color: 'var(--blue)' }}><IconSearch size={15} /></span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {prompt}
        </span>
        <span className="tag tag-blue" style={{ fontSize: '10px', flexShrink: 0 }}>Searching</span>
      </div>

      {/* Activity steps */}
      <div style={{
        background: 'var(--bg-panel)',
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border)',
        padding: '16px 18px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '14px' }}>
          What's happening
        </div>
        {steps.map((s, i) => (
          <div key={i} className="log-line" style={{ animationDelay: `${i * 200}ms` }}>
            <span className="log-dot pulse" style={{ background: s.color, animationDelay: `${i * 0.3}s` }} />
            <s.icon size={12} color={s.color} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Skeleton cards preview */}
      <div>
        <Skeleton w="120px" h={11} style={{ marginBottom: '12px' }} />
        <div style={{ display: 'flex', gap: '12px', overflowX: 'hidden' }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              minWidth: '220px', borderRadius: 'var(--r-lg)',
              border: '1px solid var(--border)', overflow: 'hidden',
              background: 'var(--bg-panel)', animationDelay: `${i * 100}ms`
            }}>
              <Skeleton h={110} r="0" />
              <div style={{ padding: '10px' }}>
                <Skeleton h={12} style={{ marginBottom: '7px' }} />
                <Skeleton w="70%" h={10} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Skeleton w="100px" h={11} style={{ marginBottom: '12px' }} />
        <div style={{ display: 'flex', gap: '12px', overflowX: 'hidden' }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              minWidth: '220px', borderRadius: 'var(--r-lg)',
              border: '1px solid var(--border)', overflow: 'hidden',
              background: 'var(--bg-panel)', animationDelay: `${i * 100}ms`
            }}>
              <div style={{ padding: '10px', borderBottom: '1px solid var(--border)' }}>
                <Skeleton w="60%" h={10} />
              </div>
              <div style={{ padding: '10px' }}>
                <Skeleton h={12} style={{ marginBottom: '7px' }} />
                <Skeleton h={10} style={{ marginBottom: '5px' }} />
                <Skeleton w="80%" h={10} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Welcome hero ────────────────────────────────────────────────── */
function WelcomeHero({ onSubmit, isSearching }) {
  const [val, setVal] = useState('');

  const suggestions = [
    { label: 'Rust vs Go in 2025', icon: IconCpu },
    { label: 'RAG architectures for production LLMs', icon: IconDatabase },
    { label: 'Advances in fusion energy', icon: IconZap },
    { label: 'Modern CSS layout techniques', icon: IconBook },
  ];

  const submit = () => { if (val.trim()) onSubmit(val.trim()); };

  return (
    <div className="fade-up" style={{
      maxWidth: '660px', margin: '32px auto 0',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center', paddingBottom: '40px'
    }}>
      {/* Logo mark */}
      <div style={{
        width: '60px', height: '60px',
        borderRadius: '18px',
        background: 'linear-gradient(135deg, var(--blue-light), color-mix(in srgb, var(--blue) 20%, transparent))',
        border: '1px solid color-mix(in srgb, var(--blue) 25%, transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '20px',
        boxShadow: '0 8px 24px rgba(91,125,255,0.15)',
      }}>
        <IconSparkles size={28} color="var(--blue)" strokeWidth={1.5} />
      </div>

      <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.7px', marginBottom: '8px', lineHeight: 1.2 }}>
        What do you want to explore?
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--text-2)', maxWidth: '480px', marginBottom: '28px', lineHeight: 1.65 }}>
        Drop a topic and Lumen finds the right YouTube videos and articles,
        then builds a focused knowledge base you can actually talk to.
      </p>

      {/* Search input */}
      <div style={{ width: '100%', marginBottom: '20px', position: 'relative' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-full)',
          boxShadow: 'var(--shadow-md)',
          transition: 'box-shadow var(--transition), border-color var(--transition)',
          overflow: 'hidden',
        }}
          onFocusCapture={e => { e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.boxShadow = 'var(--shadow-glow), var(--shadow-md)'; }}
          onBlurCapture={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
        >
          <div style={{ padding: '0 14px 0 18px', color: 'var(--text-3)', display: 'flex' }}>
            <IconSearch size={16} strokeWidth={2} />
          </div>
          <input
            type="text"
            className="input"
            placeholder="e.g. How transformers changed NLP forever"
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            disabled={isSearching}
            style={{
              flex: 1, border: 'none', borderRadius: 0,
              padding: '13px 8px', boxShadow: 'none',
              fontSize: '14px', background: 'transparent',
            }}
          />
          <div style={{ padding: '6px 8px 6px 0' }}>
            <button
              className={`btn ${val.trim() ? 'btn-primary' : 'btn-ghost'}`}
              onClick={submit}
              disabled={!val.trim() || isSearching}
              style={{ padding: '9px 20px', fontSize: '13px' }}
            >
              <IconSearch size={14} />
              Research
            </button>
          </div>
        </div>
      </div>

      {/* Suggestion chips */}
      <div style={{ width: '100%', textAlign: 'left' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
          Quick starts
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {suggestions.map(({ label, icon: Icon }, i) => (
            <button
              key={i}
              className="btn btn-ghost"
              onClick={() => onSubmit(label)}
              style={{ fontSize: '12.5px', padding: '7px 14px', borderRadius: 'var(--r-full)', gap: '6px' }}
            >
              <Icon size={12} strokeWidth={2} color="var(--text-3)" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Chat message ────────────────────────────────────────────────── */
function Message({ msg, idx }) {
  const isUser = msg.role === 'user';
  return (
    <div
      className="fade-up"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        animationDelay: `${idx * 30}ms`,
      }}
    >
      <div style={{
        maxWidth: '82%',
        padding: '12px 17px',
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        background: isUser ? 'var(--blue)' : 'var(--bg-panel)',
        color: isUser ? '#fff' : 'var(--text)',
        border: isUser ? 'none' : '1px solid var(--border)',
        boxShadow: isUser ? '0 4px 16px rgba(91,125,255,0.25)' : 'var(--shadow-sm)',
        fontSize: '14px', lineHeight: 1.65, whiteSpace: 'pre-wrap',
      }}>
        {msg.content}
      </div>
    </div>
  );
}

/* ─── Main ChatArea ───────────────────────────────────────────────── */
export default function ChatArea({
  currentSession,
  searchState,
  isSearching,
  isIndexing,
  indexingLogs,
  onGenerateSources,
  onToggleSource,
  onIndexSources,
  onSendMessage,
  isAnswering,
  lastPrompt,
}) {
  const [chatInput, setChatInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.chat_history, isAnswering]);

  const sendMsg = () => {
    if (chatInput.trim() && !isAnswering) {
      onSendMessage(chatInput.trim());
      setChatInput('');
    }
  };

  const isIndexed  = currentSession?.is_indexed;
  const hasChatHistory = currentSession?.chat_history?.length > 0;
  const showWelcome = !isSearching && !searchState && !isIndexed;

  return (
    <main style={{
      flex: 1, height: '100vh',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg)',
      position: 'relative', overflow: 'hidden',
      transition: 'background var(--transition)',
    }}>
      {/* Header */}
      <header style={{
        height: '56px', padding: '0 24px',
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize: '14px', fontWeight: 700, color: 'var(--text)',
            maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            {currentSession?.title && currentSession.title !== 'New Research'
              ? currentSession.title
              : 'New Research'}
          </span>
          {isIndexed && (
            <span className="tag tag-green fade-in" style={{ gap: '5px' }}>
              <span style={{ width: '5px', height: '5px', background: 'var(--green)', borderRadius: '50%', display: 'inline-block' }} />
              Knowledge base ready
            </span>
          )}
          {isSearching && (
            <span className="tag tag-blue fade-in" style={{ gap: '5px' }}>
              <span className="pulse" style={{ width: '5px', height: '5px', background: 'var(--blue)', borderRadius: '50%', display: 'inline-block' }} />
              Searching…
            </span>
          )}
        </div>

        <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          Lumen · RAG
        </span>
      </header>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

        {/* State 1: Welcome */}
        {showWelcome && (
          <WelcomeHero onSubmit={onGenerateSources} isSearching={isSearching} />
        )}

        {/* State 2: Skeleton while searching */}
        {isSearching && <SearchSkeleton prompt={lastPrompt} />}

        {/* State 3: Source selection */}
        {searchState && !isIndexed && !isSearching && (
          <SourceSelector
            queries={searchState.queries}
            youtubeVideos={searchState.youtube_videos}
            googleArticles={searchState.google_articles}
            selectedItems={searchState.selected_items}
            onToggleItem={onToggleSource}
            onIndexSources={onIndexSources}
            isIndexing={isIndexing}
            indexingLogs={indexingLogs}
          />
        )}

        {/* State 4: Chat mode */}
        {isIndexed && (
          <div className="fade-up" style={{
            maxWidth: '800px', margin: '0 auto',
            display: 'flex', flexDirection: 'column', gap: '18px',
            paddingBottom: '90px'
          }}>
            {/* Active sources banner */}
            <div style={{
              background: 'var(--bg-panel)',
              borderRadius: 'var(--r-lg)',
              border: '1px solid var(--border)',
              padding: '14px 18px',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                marginBottom: '10px',
                fontSize: '11px', fontWeight: 700,
                color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.6px'
              }}>
                <IconDatabase size={12} color="var(--green)" strokeWidth={2} />
                Knowledge base · {currentSession.indexed_sources?.length || 0} sources
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                {currentSession.indexed_sources?.map((s, i) => (
                  <a
                    key={i}
                    href={s.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '4px 10px',
                      borderRadius: 'var(--r-full)',
                      background: s.type === 'youtube' ? 'var(--red-light)' : 'var(--blue-light)',
                      border: `1px solid ${s.type === 'youtube' ? 'color-mix(in srgb, var(--red) 22%, transparent)' : 'color-mix(in srgb, var(--blue) 22%, transparent)'}`,
                      color: s.type === 'youtube' ? 'var(--red-text)' : 'var(--blue-text)',
                      fontSize: '11px', fontWeight: 600,
                      transition: 'opacity var(--transition)',
                      maxWidth: '240px',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    {s.type === 'youtube'
                      ? <IconYoutube size={11} color="var(--red)" strokeWidth={1.5} />
                      : <IconGlobe size={11} color="var(--blue)" strokeWidth={1.5} />
                    }
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.title}
                    </span>
                  </a>
                ))}
              </div>
            </div>

            {/* Chat messages */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {currentSession.chat_history?.map((msg, i) => (
                <Message key={i} msg={msg} idx={i} />
              ))}

              {isAnswering && (
                <div className="fade-in" style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  color: 'var(--text-3)', fontSize: '13px'
                }}>
                  <div className="dot-loader">
                    <span /><span /><span />
                  </div>
                  <span style={{ fontStyle: 'italic' }}>Retrieving relevant context…</span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>
        )}
      </div>

      {/* Chat input bar — only in chat mode */}
      {isIndexed && (
        <div className="slide-left" style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'var(--bg-panel)',
          borderTop: '1px solid var(--border)',
          padding: '12px 28px 16px',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            maxWidth: '800px', margin: '0 auto',
            display: 'flex', gap: '10px', alignItems: 'flex-end'
          }}>
            <div style={{
              flex: 1,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              padding: '10px 16px',
              display: 'flex', alignItems: 'center', gap: '8px',
              transition: 'border-color var(--transition), box-shadow var(--transition)',
            }}
              onFocusCapture={e => { e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.boxShadow = 'var(--shadow-glow)'; }}
              onBlurCapture={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <input
                type="text"
                placeholder="Ask something about your sources…"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMsg()}
                disabled={isAnswering}
                style={{
                  flex: 1, border: 'none', outline: 'none',
                  fontSize: '14px', background: 'transparent',
                  color: 'var(--text)',
                }}
              />
            </div>
            <button
              className={`btn ${chatInput.trim() && !isAnswering ? 'btn-primary' : 'btn-ghost'}`}
              onClick={sendMsg}
              disabled={!chatInput.trim() || isAnswering}
              style={{ padding: '12px 18px', borderRadius: 'var(--r-lg)', flexShrink: 0 }}
            >
              <IconSend size={15} />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
