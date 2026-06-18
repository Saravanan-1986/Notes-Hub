import { useState, useEffect } from 'react';
import PDFViewer from './PDFViewer';
import WordViewer from './WordViewer';

/**
 * UniversalFileViewer - Renders any file type properly
 * Detects file type from MIME type or extension and renders accordingly
 */
export default function UniversalFileViewer({ fileUrl, filename, fileType, mimeType }) {
  const [textContent, setTextContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Determine the actual file type for rendering
  const ext = filename?.split('.').pop()?.toLowerCase() || '';
  const mime = mimeType || '';

  // Check if it's a viewable type
  const isImage = mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'].includes(ext);
  const isVideo = mime.startsWith('video/') || ['mp4', 'webm', 'ogg', 'avi', 'mov', 'mkv', 'wmv'].includes(ext);
  const isAudio = mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'aac', 'wma'].includes(ext);
  const isPdf = mime === 'application/pdf' || ext === 'pdf';
  const isDocx = mime.includes('wordprocessingml') || ext === 'docx';
  const isLegacyWord = mime.includes('msword') || ext === 'doc';
  const isSpreadsheet = mime.includes('spreadsheet') || mime.includes('ms-excel') || ['xlsx', 'xls', 'csv'].includes(ext);
  const isPresentation = mime.includes('presentation') || mime.includes('ms-powerpoint') || ['pptx', 'ppt'].includes(ext);
  const isText = mime.startsWith('text/') || ['txt', 'md', 'csv', 'log', 'ini', 'cfg'].includes(ext);
  const isCode = ['js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs', 'swift', 'kt', 'php', 'html', 'css', 'scss', 'less', 'json', 'xml', 'yaml', 'yml', 'toml', 'sh', 'bash', 'sql'].includes(ext);
  const isArchive = mime.includes('zip') || mime.includes('rar') || mime.includes('7z') || mime.includes('tar') || mime.includes('gzip') || mime.includes('compress') || ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext);
  const isEpub = ext === 'epub' || ext === 'mobi';

  // For text/code files, fetch the content
  useEffect(() => {
    if (!isText && !isCode) return;

    let cancelled = false;
    async function fetchText() {
      setLoading(true);
      try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error('Failed to fetch file content');
        const text = await response.text();
        if (!cancelled) {
          setTextContent(text);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load text content');
          setLoading(false);
        }
      }
    }
    fetchText();
    return () => { cancelled = true; };
  }, [fileUrl, isText, isCode]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to get file type badge
  const getBadge = () => {
    if (isImage) return { icon: '🖼️', label: ext.toUpperCase() };
    if (isVideo) return { icon: '🎬', label: ext.toUpperCase() };
    if (isAudio) return { icon: '🎵', label: ext.toUpperCase() };
    if (isPdf) return { icon: '📄', label: 'PDF' };
    if (isDocx) return { icon: '📝', label: 'DOCX' };
    if (isSpreadsheet) return { icon: '📊', label: ext.toUpperCase() };
    if (isPresentation) return { icon: '📽️', label: ext.toUpperCase() };
    if (isText || isCode) return { icon: '📃', label: ext.toUpperCase() };
    if (isArchive) return { icon: '🗜️', label: ext.toUpperCase() };
    if (isEpub) return { icon: '📖', label: ext.toUpperCase() };
    return { icon: '📄', label: ext.toUpperCase() };
  };

  const badge = getBadge();

  // If it failed to render, show download
  if (error) {
    return (
      <div className="universal-viewer-error">
        <div className="error-icon">⚠️</div>
        <h3>Cannot render this file</h3>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={handleDownload}>
          ⬇ Download {filename}
        </button>
      </div>
    );
  }

  return (
    <div className="universal-viewer">
      {/* Document-based viewers */}
      {isPdf && <PDFViewer pdfUrl={fileUrl} filename={filename} />}
      {isDocx && <WordViewer docUrl={fileUrl} filename={filename} />}

      {/* Image viewer */}
      {isImage && (
        <div className="image-viewer-container">
          <div className="image-viewer-toolbar">
            <span className="image-filename">{badge.icon} {filename}</span>
            <button className="btn btn-sm btn-accent" onClick={handleDownload}>⬇ Download</button>
          </div>
          <div className="image-viewer-content">
            <img
              src={fileUrl}
              alt={filename}
              className="image-viewer-img"
              onError={() => setError('Failed to load image')}
            />
          </div>
        </div>
      )}

      {/* Video viewer */}
      {isVideo && (
        <div className="media-viewer-container">
          <div className="media-viewer-toolbar">
            <span className="media-filename">{badge.icon} {filename}</span>
            <button className="btn btn-sm btn-accent" onClick={handleDownload}>⬇ Download</button>
          </div>
          <div className="media-viewer-content">
            <video
              controls
              className="media-viewer-video"
              onError={() => setError('Failed to load video')}
            >
              <source src={fileUrl} type={mime || `video/${ext}`} />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      )}

      {/* Audio viewer */}
      {isAudio && (
        <div className="media-viewer-container">
          <div className="media-viewer-toolbar">
            <span className="media-filename">{badge.icon} {filename}</span>
            <button className="btn btn-sm btn-accent" onClick={handleDownload}>⬇ Download</button>
          </div>
          <div className="media-viewer-content audio-content">
            <div className="audio-artwork">🎵</div>
            <audio
              controls
              className="media-viewer-audio"
              onError={() => setError('Failed to load audio')}
            >
              <source src={fileUrl} type={mime || `audio/${ext}`} />
              Your browser does not support the audio tag.
            </audio>
            <div className="audio-filename">{filename}</div>
          </div>
        </div>
      )}

      {/* Text viewer */}
      {(isText || isCode) && (
        <div className="text-viewer-container">
          <div className="text-viewer-toolbar">
            <span className="text-filename">{badge.icon} {filename}</span>
            <div className="text-viewer-actions">
              <button className="btn btn-sm btn-secondary" onClick={handleDownload}>⬇ Download</button>
            </div>
          </div>
          <div className="text-viewer-content">
            {loading ? (
              <div className="loading">Loading text content...</div>
            ) : (
              <pre className={`text-viewer-pre ${isCode ? 'code-viewer' : ''}`}>
                <code>{textContent}</code>
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Spreadsheet / Presentation / Archive / Epub - show download prompt */}
      {(isLegacyWord || isSpreadsheet || isPresentation || isArchive || isEpub) && !isText && !isCode && (
        <div className="download-viewer-container">
          <div className="download-viewer-icon">{badge.icon}</div>
          <h3 className="download-viewer-title">{filename}</h3>
          <p className="download-viewer-text">
            This file type ({badge.label}) cannot be previewed reliably in the browser.
          </p>
          <div className="download-viewer-actions">
            <button className="btn btn-primary btn-glow" onClick={handleDownload}>
              ⬇ Download File
            </button>
          </div>
        </div>
      )}

      {/* Fallback for unknown types */}
      {!isImage && !isVideo && !isAudio && !isPdf && !isDocx && !isLegacyWord && !isText && !isCode && !isSpreadsheet && !isPresentation && !isArchive && !isEpub && (
        <div className="download-viewer-container">
          <div className="download-viewer-icon">📄</div>
          <h3 className="download-viewer-title">{filename}</h3>
          <p className="download-viewer-text">
            This file type cannot be previewed in the browser.
          </p>
          <div className="download-viewer-actions">
            <button className="btn btn-primary btn-glow" onClick={handleDownload}>
              ⬇ Download File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
