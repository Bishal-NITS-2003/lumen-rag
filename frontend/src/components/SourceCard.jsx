import React from 'react';
import { IconYoutube, IconGlobe, IconCheck, IconLink } from './Icons';

export default function SourceCard({ item, isSelected, onToggle, disabled }) {
  const isYT = item.type === 'youtube';

  return (
    <div
      onClick={() => { if (!disabled || isSelected) onToggle(item); }}
      style={{
        minWidth: '260px',
        maxWidth: '260px',
        background: 'var(--bg-panel)',
        borderRadius: 'var(--r-lg)',
        border: isSelected
          ? '2px solid var(--blue)'
          : '1px solid var(--border)',
        boxShadow: isSelected
          ? '0 0 0 3px rgba(91,125,255,0.15), var(--shadow-md)'
          : 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        cursor: disabled && !isSelected ? 'not-allowed' : 'pointer',
        opacity: disabled && !isSelected ? 0.45 : 1,
        transition: 'all 0.2s ease',
        flexShrink: 0,
        position: 'relative',
        transform: isSelected ? 'translateY(-2px)' : 'none',
      }}
      onMouseEnter={e => {
        if (!disabled || isSelected) {
          e.currentTarget.style.boxShadow = isSelected
            ? '0 0 0 3px rgba(91,125,255,0.15), var(--shadow-lg)'
            : 'var(--shadow-md)';
          if (!isSelected) e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = isSelected
          ? '0 0 0 3px rgba(91,125,255,0.15), var(--shadow-md)'
          : 'var(--shadow-sm)';
        e.currentTarget.style.transform = isSelected ? 'translateY(-2px)' : 'none';
      }}
    >
      {/* Selection tick overlay */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          background: 'var(--blue)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
          boxShadow: '0 2px 8px rgba(59,91,219,0.4)',
          animation: 'scaleIn 0.2s ease both',
        }}>
          <IconCheck size={12} color="#fff" strokeWidth={2.5} />
        </div>
      )}

      {/* Top visual */}
      {isYT ? (
        <div style={{ position: 'relative', height: '130px', background: '#000', overflow: 'hidden', flexShrink: 0 }}>
          <img
            src={item.thumbnail}
            alt={item.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.92 }}
            onError={e => { e.currentTarget.src = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=300&q=80'; }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 55%)'
          }} />
          <div style={{
            position: 'absolute', bottom: '8px', left: '8px',
            display: 'flex', alignItems: 'center', gap: '5px'
          }}>
            <IconYoutube size={13} color="#fff" strokeWidth={1.5} />
            <span style={{ color: '#fff', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              YouTube
            </span>
          </div>
        </div>
      ) : (
        <div style={{
          padding: '12px 13px 9px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <IconGlobe size={13} color="var(--blue)" strokeWidth={1.6} />
            <span className="tag tag-blue" style={{ fontSize: '10px', padding: '2px 8px' }}>Article</span>
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-3)', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.source || new URL(item.link).hostname.replace('www.', '')}
          </span>
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '11px 13px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <h4 style={{
          fontSize: '12.5px',
          fontWeight: 600,
          color: 'var(--text)',
          lineHeight: 1.4,
          marginBottom: '5px',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          height: '35px',
        }}>
          {item.title}
        </h4>

        {item.channel && (
          <div style={{ fontSize: '10.5px', color: 'var(--text-3)', fontWeight: 500, marginBottom: '5px' }}>
            {item.channel}
          </div>
        )}

        {item.snippet && (
          <p style={{
            fontSize: '11px',
            color: 'var(--text-3)',
            lineHeight: 1.45,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            flex: 1,
          }}>
            {item.snippet}
          </p>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '10px',
          paddingTop: '8px',
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '11px',
            fontWeight: 600,
            color: isSelected ? 'var(--blue)' : 'var(--text-3)',
            transition: 'color var(--transition)',
          }}>
            <div style={{
              width: '14px', height: '14px',
              borderRadius: '3px',
              border: `2px solid ${isSelected ? 'var(--blue)' : 'var(--border-2)'}`,
              background: isSelected ? 'var(--blue)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all var(--transition)',
              flexShrink: 0,
            }}>
              {isSelected && <IconCheck size={9} color="#fff" strokeWidth={3} />}
            </div>
            {isSelected ? 'Selected' : 'Select'}
          </div>

          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              fontSize: '11px', color: 'var(--blue)', fontWeight: 500,
              transition: 'opacity var(--transition)',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <IconLink size={11} strokeWidth={2} />
            Open
          </a>
        </div>
      </div>
    </div>
  );
}
