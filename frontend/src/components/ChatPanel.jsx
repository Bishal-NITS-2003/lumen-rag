import React, { useState, useRef, useEffect } from 'react';
import {
  IconSend, IconTrash, IconSparkles, IconLoader,
  IconCopy, IconCheck, IconFileText, IconPlus
} from './Icons';

export default function ChatPanel({
  notebookTitle,
  messages = [],
  sources = [],
  isLoading,
  onSendMessage,
  onClearChat,
  onSelectCitation,
  onAddToNote
}) {
  const [inputText, setInputText] = useState('');
  const [hoveredCitation, setHoveredCitation] = useState(null);
  const [selectionPopup, setSelectionPopup] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [toastMsg, setToastMsg] = useState('');

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  const activeSources = sources.filter(s => s.is_active && s.extraction_status !== 'failed');

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
      showToast('Appended selection to Research Notes!');
    }
    window.getSelection()?.removeAllRanges();
    setSelectionPopup(null);
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim());
    setInputText('');
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
    "Summarize the key ideas and conclusions across all sources",
    "What are the most significant findings and data points?",
    "Identify any conflicting perspectives or contrasting claims",
    "Generate a structured 5-point executive summary"
  ];

  // Helper to render text with clickable citation pills
  const renderMessageContent = (content, citations = []) => {
    if (!citations || citations.length === 0) {
      return <div className="msg-text-plain">{content}</div>;
    }

    const parts = content.split(/(\[\d+\])/g);

    return (
      <div className="msg-text-parsed">
        {parts.map((part, i) => {
          const match = part.match(/\[(\d+)\]/);
          if (match) {
            const index = parseInt(match[1], 10);
            const citation = citations.find(c => c.citation_index === index) || {
              citation_index: index,
              source_title: `Source ${index}`,
              snippet: 'Referenced passage from document context.'
            };

            return (
              <span
                key={i}
                className="citation-pill"
                onClick={() => {
                  if (citation.source_id && onSelectCitation) {
                    onSelectCitation(
                      citation.source_id,
                      citation.full_snippet || citation.snippet
                    );
                  }
                }}
                onMouseEnter={() => setHoveredCitation(citation)}
                onMouseLeave={() => setHoveredCitation(null)}
                title={`[${index}] ${citation.source_title} - Click to jump to passage`}
              >
                {index}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </div>
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
            <IconPlus size={13} /> Add to Note
          </button>
        </div>
      )}

      <div className="chat-panel-header">
        <div className="chat-panel-title-wrap">
          <h2 className="chat-notebook-name">{notebookTitle}</h2>
          <span className="chat-grounding-tag">
            <span className="grounding-dot" />
            {sources.length === 0
              ? 'No sources attached'
              : `Grounded with all ${sources.length} ${sources.length === 1 ? 'source' : 'sources'}`}
          </span>
        </div>
        {messages.length > 0 && (
          <button className="icon-btn" title="Clear chat history" onClick={onClearChat}>
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
            <h3 className="welcome-heading">Chat with your research notebook</h3>
            <p className="welcome-sub">
              {activeSources.length > 0
                ? `Answers are synthesized by DeepSeek-R1 / Qwen Reasoning and grounded exclusively in your ${activeSources.length} active sources with source citations.`
                : 'Upload or discover sources in the left panel to begin querying your notebook.'}
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
                        <IconSparkles size={13} /> DeepSeek-R1 Reasoning
                      </span>
                      <div className="message-quick-actions">
                        <button
                          className="msg-action-btn"
                          onClick={() => handleCopyMessage(msg.id || idx, msg.content)}
                          title="Copy response"
                        >
                          {copiedId === (msg.id || idx) ? <IconCheck size={13} /> : <IconCopy size={13} />}
                        </button>
                        <button
                          className="msg-action-btn"
                          onClick={() => {
                            if (onAddToNote) {
                              onAddToNote(msg.content);
                              showToast('Appended full response to Research Notes!');
                            }
                          }}
                          title="Append entire response to Notes"
                        >
                          <IconFileText size={13} /> <span>Add to Note</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="message-body">
                    {renderMessageContent(msg.content, msg.citations)}
                  </div>

                  {msg.citations && msg.citations.length > 0 && (
                    <div className="message-citations-footer">
                      <div className="citations-footer-label">Referenced Sources (click to inspect passage):</div>
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
                  <span className="loading-text">Synthesizing grounded answer with DeepSeek-R1...</span>
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
            <span className="floating-num">Citation [{hoveredCitation.citation_index}]</span>
            <span className="floating-title">{hoveredCitation.source_title}</span>
          </div>
          <p className="floating-snippet">{hoveredCitation.snippet}</p>
        </div>
      )}

      {/* Input area */}
      <div className="chat-input-bar-wrap">
        <form onSubmit={handleSubmit} className="chat-input-form">
          <textarea
            className="chat-textarea"
            placeholder={
              activeSources.length === 0
                ? "Add at least one active source in the left panel to begin..."
                : "Ask a grounded question about your sources..."
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
          {activeSources.length} sources active · Highlight any text to Add to Notes · Enter to send
        </div>
      </div>
    </main>
  );
}
