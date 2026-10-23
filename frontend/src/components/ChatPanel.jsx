import React, { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import {
  IconSend, IconTrash, IconSparkles, IconLoader,
  IconCopy, IconCheck, IconFileText, IconPlus,
  IconGoogle, IconLock
} from './Icons';

// Configure marked for clean GFM parsing with breaks
marked.setOptions({
  gfm: true,
  breaks: true,
});

export const AVAILABLE_MODELS = [
  { id: 'openai/gpt-oss-120b', label: 'GPT OSS 120B' },
  { id: 'qwen/qwen3.8-27b', label: 'Qwen 27B' },
  { id: 'openai/gpt-oss-20b', label: 'GPT OSS 20B' },
  { id: 'openai/gpt-oss-safeguard-20b', label: 'GPT Safeguard 20B' },
  { id: 'meta-llama/llama-prompt-guard-2-86m', label: 'Llama Guard 86M' },
  { id: 'meta-llama/llama-prompt-guard-2-22m', label: 'Llama Guard 22M' }
];

export default function ChatPanel({
  notebookTitle,
  messages = [],
  sources = [],
  isLoading,
  user = null,
  onGoogleSignIn,
  onSendMessage,
  onClearChat,
  onSelectCitation,
  onAddToNote
}) {
  const [inputText, setInputText] = useState('');
  const [selectedModel, setSelectedModel] = useState('openai/gpt-oss-120b');
  const [rateLimitError, setRateLimitError] = useState(null);
  const [hoveredCitation, setHoveredCitation] = useState(null);
  const [selectionPopup, setSelectionPopup] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [toastMsg, setToastMsg] = useState('');

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  const activeSources = sources.filter(s => s.is_active && s.extraction_status !== 'failed');

  const getModelLabel = (modelId) => {
    const found = AVAILABLE_MODELS.find(m => m.id === modelId);
    return found ? found.label : (modelId || 'GPT OSS 120B');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Handle user text selection in chat messages to show floating "Add to Note"
  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setSelectionPopup(null);
      return;
    }

    const selectedText = sel.toString().trim();
    if (selectedText.length >= 3) {
      try {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectionPopup({
          text: selectedText,
          top: rect.top - 46,
          left: Math.max(16, rect.left + rect.width / 2 - 60)
        });
      } catch (err) {
        setSelectionPopup(null);
      }
    } else {
      setSelectionPopup(null);
    }
  };

  const handleAddSelectionToNote = () => {
    if (!selectionPopup?.text) return;
    if (onAddToNote) {
      onAddToNote(selectionPopup.text);
      showToast('Added to your notes');
    }
    window.getSelection()?.removeAllRanges();
    setSelectionPopup(null);
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!user) {
      if (onGoogleSignIn) onGoogleSignIn();
      return;
    }
    const trimmed = inputText.trim();
    if (!trimmed || isLoading) return;

    setRateLimitError(null);
    try {
      await onSendMessage(trimmed, selectedModel);
      setInputText('');
    } catch (err) {
      const errDetail = (err?.message || '').toLowerCase();
      const is429 = err?.status === 429 ||
        errDetail.includes('rate limit') ||
        errDetail.includes('too many requests') ||
        errDetail.includes('429');

      if (is429) {
        const curLabel = getModelLabel(selectedModel);
        setRateLimitError({
          failedModel: curLabel,
          message: `Rate limit reached for ${curLabel}. Please switch to another model and try again.`
        });
      } else {
        alert(`Something went wrong: ${err.message || 'Unknown error'}`);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCopyMessage = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const starterPrompts = [
    'Summarize the key ideas across all sources',
    'What are the most important findings?',
    'Identify any conflicting perspectives',
    'Write a 5-point executive summary'
  ];

  // Helper to render text with marked Markdown parsing & clickable citation pills
  const renderMessageContent = (msg) => {
    const { content, citations = [], role } = msg;
    if (!content) return null;

    if (role === 'user') {
      return <div className="msg-user-content">{content}</div>;
    }

    // Replace [1], [2], [1, 2], [1, 2, 3] with interactive HTML citation pill spans
    const processedText = content.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (match, numsStr) => {
      const indices = numsStr.split(',').map(n => n.trim()).filter(Boolean);
      return indices.map(num => `<span class="citation-pill" data-citation-index="${num}">${num}</span>`).join(' ');
    });

    // Parse markdown (headings, bold, lists, code, tables) into HTML
    const parsedHtml = marked.parse(processedText);

    return (
      <div
        className="msg-markdown-content"
        dangerouslySetInnerHTML={{ __html: parsedHtml }}
        onClick={(e) => {
          const pill = e.target.closest('.citation-pill');
          if (pill) {
            const idx = parseInt(pill.getAttribute('data-citation-index'), 10);
            const citation = citations?.find(c => c.citation_index === idx);
            if (onSelectCitation) {
              if (citation && citation.source_id) {
                onSelectCitation(
                  citation.source_id,
                  citation.full_snippet || citation.snippet
                );
              } else {
                onSelectCitation(null, `Citation [${idx}]`);
              }
            }
          }
        }}
        onMouseOver={(e) => {
          const pill = e.target.closest('.citation-pill');
          if (pill) {
            const idx = parseInt(pill.getAttribute('data-citation-index'), 10);
            const citation = citations?.find(c => c.citation_index === idx) || {
              citation_index: idx,
              source_title: `Source ${idx}`,
              snippet: 'Referenced passage from document context.'
            };
            setHoveredCitation(citation);
          }
        }}
        onMouseOut={(e) => {
          const pill = e.target.closest('.citation-pill');
          if (pill) {
            setHoveredCitation(null);
          }
        }}
      />
    );
  };

  return (
    <main className="chat-panel" onMouseUp={handleMouseUp}>
      {/* Toast Notification */}
      {toastMsg && (
        <div className="floating-toast">
          <IconCheck size={14} /> {toastMsg}
        </div>
      )}

      {/* Floating Selection Tooltip: Add to Note */}
      {selectionPopup && (
        <div
          className="floating-selection-action"
          style={{ top: `${selectionPopup.top}px`, left: `${selectionPopup.left}px` }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleAddSelectionToNote();
          }}
        >
          <button className="btn-add-to-note-float">
            <IconPlus size={13} /> Save to Notes
          </button>
        </div>
      )}

      <div className="chat-panel-header">
        <div className="chat-panel-title-wrap">
          <h2 className="chat-notebook-name">{notebookTitle}</h2>
          <span className="chat-grounding-tag">
            <span className="grounding-dot" />
            {sources.length === 0
              ? 'No sources yet'
              : `${activeSources.length} of ${sources.length} ${sources.length === 1 ? 'source' : 'sources'} active`}
          </span>
        </div>
        {messages.length > 0 && (
          <button className="icon-btn" title="Clear chat" onClick={onClearChat}>
            <IconTrash size={16} />
          </button>
        )}
      </div>

      <div className="chat-messages-container" ref={chatContainerRef}>
        {messages.length === 0 ? (
          <div className="chat-welcome-state">
            <div className="welcome-avatar">
              <IconSparkles size={32} />
            </div>
            <h3 className="welcome-heading">
              {activeSources.length > 0 ? 'Ready to answer your questions' : 'Add sources to get started'}
            </h3>
            <p className="welcome-sub">
              {activeSources.length > 0
                ? `Ask anything about your sources. Responses are grounded in the ${activeSources.length} active ${activeSources.length === 1 ? 'source' : 'sources'} and include citations.`
                : 'Upload PDFs, paste a YouTube link, or add a web article using the panel on the left.'}
            </p>

            {activeSources.length > 0 && (
              <div className="starter-chips-grid">
                {starterPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    className="starter-chip"
                    onClick={() => onSendMessage(p)}
                  >
                    <span>{p}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="messages-stream">
            {messages.map((msg, idx) => (
              <div key={msg.id || idx} className={`chat-message-row ${msg.role}`}>
                <div className="message-bubble">
                  {msg.role === 'assistant' && (
                    <div className="message-speaker-header">
                      <span className="assistant-badge">
                        <IconSparkles size={13} /> {getModelLabel(msg.model || selectedModel)}
                      </span>
                      <div className="message-quick-actions">
                        <button
                          className="msg-action-btn"
                          onClick={() => handleCopyMessage(msg.id || idx, msg.content)}
                          title="Copy"
                        >
                          {copiedId === (msg.id || idx) ? <IconCheck size={13} /> : <IconCopy size={13} />}
                        </button>
                        <button
                          className="msg-action-btn"
                          onClick={() => {
                            if (onAddToNote) {
                              onAddToNote(msg.content);
                              showToast('Added to your notes');
                            }
                          }}
                          title="Save to notes"
                        >
                          <IconFileText size={13} /> <span>Save to Notes</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="message-body">
                    {renderMessageContent(msg)}
                  </div>

                  {msg.citations && msg.citations.length > 0 && (
                    <div className="message-citations-footer">
                      <div className="citations-footer-label">Sources cited</div>
                      <div className="citations-pills-row">
                        {msg.citations.map((c) => (
                          <button
                            key={c.citation_index}
                            className="citation-footer-chip"
                            onClick={() => {
                              if (c.source_id && onSelectCitation) {
                                onSelectCitation(
                                  c.source_id,
                                  c.full_snippet || c.snippet
                                );
                              }
                            }}
                          >
                            <span className="cite-num">[{c.citation_index}]</span>
                            <span className="cite-name">{c.source_title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="chat-message-row assistant">
                <div className="message-bubble loading-bubble">
                  <div className="loading-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className="loading-text">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Floating Citation Tooltip on Hover */}
      {hoveredCitation && (
        <div className="floating-citation-card">
          <div className="floating-citation-header">
            <span className="floating-num">[{hoveredCitation.citation_index}]</span>
            <span className="floating-title">{hoveredCitation.source_title}</span>
          </div>
          <p className="floating-snippet">{hoveredCitation.snippet}</p>
        </div>
      )}

      {/* Input area */}
      <div className="chat-input-bar-wrap">
        {!user ? (
          <div className="chat-login-gate-banner">
            <div className="login-gate-info">
              <div className="login-gate-icon-circle">
                <IconLock size={18} />
              </div>
              <div className="login-gate-text">
                <div className="login-gate-title">Sign in to chat</div>
                <div className="login-gate-desc">
                  Your conversations are saved to your account.
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn-login-gate-google"
              onClick={onGoogleSignIn}
            >
              <IconGoogle size={17} />
              <span>Continue with Google</span>
            </button>
          </div>
        ) : (
          <>
            {rateLimitError && (
              <div className="chat-rate-limit-banner">
                <div className="rate-limit-banner-content">
                  <span className="rate-limit-banner-icon">⚠️</span>
                  <div className="rate-limit-banner-text">
                    <span className="rate-limit-banner-title">Rate limit reached — {rateLimitError.failedModel}</span>
                    <span className="rate-limit-banner-desc">
                      Switch to a different model below and try again.
                    </span>
                  </div>
                </div>
                <div className="rate-limit-banner-actions">
                  <button
                    type="button"
                    className="btn-switch-model-quick"
                    onClick={() => {
                      const next = AVAILABLE_MODELS.find(m => m.id !== selectedModel) || AVAILABLE_MODELS[0];
                      setSelectedModel(next.id);
                      setRateLimitError(null);
                    }}
                  >
                    Switch to {getModelLabel(AVAILABLE_MODELS.find(m => m.id !== selectedModel)?.id || '')}
                  </button>
                  <button
                    type="button"
                    className="btn-close-banner"
                    onClick={() => setRateLimitError(null)}
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            <div className="chat-input-toolbar">
              <div className="chat-model-selector-group">
                <span className="model-selector-tag">Model</span>
                <select
                  className="chat-model-select"
                  value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    if (rateLimitError) setRateLimitError(null);
                  }}
                  disabled={isLoading}
                  title="Select AI Model"
                >
                  {AVAILABLE_MODELS.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              {activeSources.length > 0 && (
                <div className="chat-input-sources-count">
                  <span className="sources-count-dot" />
                  {activeSources.length} active {activeSources.length === 1 ? 'source' : 'sources'}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="chat-input-form">
              <textarea
                className="chat-textarea"
                placeholder={
                  activeSources.length === 0
                    ? 'Add a source to start chatting…'
                    : 'Ask a question about your sources…'
                }
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={isLoading || activeSources.length === 0}
              />
              <button
                type="submit"
                className="chat-send-btn"
                disabled={!inputText.trim() || isLoading || activeSources.length === 0}
              >
                {isLoading ? <IconLoader size={18} className="spin" /> : <IconSend size={18} />}
              </button>
            </form>
            <div className="chat-input-hint">
              Highlight text in any response to save it to your notes · Enter to send
            </div>
          </>
        )}
      </div>
    </main>
  );
}
