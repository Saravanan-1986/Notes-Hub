import { useState, useEffect, useRef } from 'react';

export default function WordViewer({ docUrl, filename }) {
  const [htmlContent, setHtmlContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWordDoc() {
      if (!docUrl) return;
      setLoading(true);
      setError('');

      try {
        // Fetch the .docx file as an ArrayBuffer
        const response = await fetch(docUrl);
        if (!response.ok) throw new Error('Failed to fetch document');
        const arrayBuffer = await response.arrayBuffer();

        // Dynamically import mammoth.js
        const mammoth = await import('mammoth');

        // Convert to HTML
        const result = await mammoth.convertToHtml({ arrayBuffer });

        if (cancelled) return;

        if (result.value) {
          setHtmlContent(result.value);
        } else {
          setHtmlContent('<p><em>No content found in document</em></p>');
        }

        if (result.messages) {
          result.messages.forEach(msg => {
            if (msg.type === 'warning') console.warn('Mammoth warning:', msg.message);
          });
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Word doc load error:', err);
          setError('Failed to load Word document. The file may be corrupted or in an unsupported format.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadWordDoc();

    return () => { cancelled = true; };
  }, [docUrl]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = docUrl;
    link.download = filename || 'document.docx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (error) {
    return (
      <div className="pdf-viewer-error">
        <div className="error-icon">⚠️</div>
        <h3>Document Render Error</h3>
        <p>{error}</p>
        {docUrl && (
          <div className="pdf-viewer-error-actions">
            <a href={docUrl} download={filename || 'document.docx'} className="btn btn-primary">
              ⬇ Download DOCX Directly
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pdf-viewer-wrapper">
      {/* Toolbar */}
      <div className="pdf-toolbar">
        <div className="pdf-toolbar-left">
          <span className="pdf-filename">📝 {filename || 'Document'}</span>
          {!loading && htmlContent && (
            <span className="pdf-page-count">Word Document</span>
          )}
        </div>
        <div className="pdf-toolbar-right">
          <button className="btn btn-sm btn-accent" onClick={handleDownload}>
            ⬇ Download
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="pdf-loading">
          <div className="pdf-loading-spinner"></div>
          <span>Converting Word document...</span>
        </div>
      )}

      {/* Document content */}
      {!loading && htmlContent && (
        <div className="word-viewer-content" ref={containerRef}>
          <div
            className="word-content-inner"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>
      )}
    </div>
  );
}