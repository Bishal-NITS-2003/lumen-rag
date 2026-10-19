import React from 'react';
import SourceCard from './SourceCard';
import { IconYoutube, IconGlobe, IconDatabase, IconZap } from './Icons';

export default function SourceSelector({
  queries,
  youtubeVideos,
  googleArticles,
  selectedItems,
  onToggleItem,
  onIndexSources,
  isIndexing,
  indexingLogs,
}) {
  const selectedCount = selectedItems.length;
  const maxReached = selectedCount >= 5;

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '22px', paddingBottom: '100px' }}>

      {/* Search query chips */}
      <div style={{
        background: 'var(--bg-panel)',
        padding: '14px 18px',
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          marginBottom: '10px',
          fontSize: '11px', fontWeight: 700, color: 'var(--text-3)',
          textTransform: 'uppercase', letterSpacing: '0.6px'
        }}>
          <IconZap size={12} color="var(--blue)" strokeWidth={2} />
          Gemini Search Queries
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
          {queries.map((q, i) => (
            <span
              key={i}
              className="tag tag-subtle slide-left"
              style={{ animationDelay: `${i * 60}ms`, fontSize: '12px', padding: '4px 11px' }}
            >
              <span style={{ color: 'var(--blue)', fontWeight: 700 }}>{i + 1}</span>
              &nbsp;{q}
            </span>
          ))}
        </div>
      </div>

      {/* Indexing activity log */}
      {isIndexing && (
        <div className="fade-in" style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          padding: '14px 18px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginBottom: '12px',
            fontSize: '12px', fontWeight: 700, color: 'var(--text-2)',
          }}>
            <span className="spin" style={{ display: 'flex' }}>
              <IconDatabase size={14} color="var(--blue)" />
            </span>
            Processing sources…
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {(indexingLogs || []).map((log, i) => (
              <div key={i} className="log-line" style={{ animationDelay: `${i * 80}ms` }}>
                <span className="log-dot" style={{ background: log.ok ? 'var(--green)' : 'var(--blue)' }} />
                {log.text}
              </div>
            ))}
            <div className="log-line pulse">
              <span className="log-dot" style={{ background: 'var(--blue)', animation: 'pulse 1s infinite' }} />
              <span className="cursor">Working</span>
            </div>
          </div>
        </div>
      )}

      {/* YouTube section */}
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '10px'
        }}>
          <h3 style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            fontSize: '14px', fontWeight: 700, color: 'var(--text)'
          }}>
            <IconYoutube size={16} color={`var(--red)`} strokeWidth={1.6} />
            YouTube Videos
            <span className="tag tag-red" style={{ fontSize: '10px' }}>{youtubeVideos.length}</span>
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>scroll to explore →</span>
        </div>

        <div className="h-scroll">
          {youtubeVideos.map((v, i) => {
            const isSel = selectedItems.some(s => s.link === v.link);
            return (
              <div key={v.id || v.link} className="fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                <SourceCard
                  item={v}
                  isSelected={isSel}
                  onToggle={onToggleItem}
                  disabled={maxReached && !isSel}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Google articles */}
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '10px'
        }}>
          <h3 style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            fontSize: '14px', fontWeight: 700, color: 'var(--text)'
          }}>
            <IconGlobe size={16} color="var(--blue)" strokeWidth={1.6} />
            Web Articles
            <span className="tag tag-blue" style={{ fontSize: '10px' }}>{googleArticles.length}</span>
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>scroll to explore →</span>
        </div>

        <div className="h-scroll">
          {googleArticles.map((a, i) => {
            const isSel = selectedItems.some(s => s.link === a.link);
            return (
              <div key={a.id || a.link} className="fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                <SourceCard
                  item={a}
                  isSelected={isSel}
                  onToggle={onToggleItem}
                  disabled={maxReached && !isSel}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating action bar */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        left: `calc(var(--sidebar-w) + (100vw - var(--sidebar-w)) / 2)`,
        transform: 'translateX(-50%)',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-full)',
        boxShadow: 'var(--shadow-xl)',
        padding: '10px 16px 10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        zIndex: 50,
        animation: 'fadeUp 0.3s ease both',
      }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: '5px' }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{
              width: '8px', height: '8px',
              borderRadius: '50%',
              background: i < selectedCount ? 'var(--blue)' : 'var(--border-2)',
              transition: 'background 0.2s',
              transform: i < selectedCount ? 'scale(1.15)' : 'scale(1)',
            }} />
          ))}
        </div>

        <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-2)' }}>
          {selectedCount === 0 ? 'Pick sources to research' : `${selectedCount} of 5 selected`}
        </span>

        {maxReached && (
          <span className="tag tag-amber" style={{ fontSize: '10px' }}>Max reached</span>
        )}

        <button
          className={`btn ${selectedCount > 0 && !isIndexing ? 'btn-green' : 'btn-ghost'}`}
          onClick={onIndexSources}
          disabled={selectedCount === 0 || isIndexing}
          style={{ fontSize: '13px' }}
        >
          {isIndexing ? (
            <>
              <span className="spin" style={{ display: 'flex' }}><IconDatabase size={13} /></span>
              Processing…
            </>
          ) : (
            <>
              <IconDatabase size={13} />
              Build Knowledge Base
            </>
          )}
        </button>
      </div>
    </div>
  );
}
