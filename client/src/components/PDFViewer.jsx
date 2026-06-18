import { useState, useEffect, useRef } from 'react';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export default function PDFViewer({ pdfUrl, filename }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scale, setScale] = useState(1.2);
  const [pageInput, setPageInput] = useState('1');
  const renderTaskRef = useRef(null);

  // Dynamically load pdfjs from the module
  useEffect(() => {
    let cancelled = false;

    async function loadPDF() {
      if (!pdfUrl) return;
      setLoading(true);
      setError('');

      try {
        const pdfjsLib = await import('pdfjs-dist');

        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

        const response = await fetch(pdfUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const arrayBuffer = await response.arrayBuffer();
        const header = new TextDecoder('latin1').decode(arrayBuffer.slice(0, 5));
        if (header !== '%PDF-') {
          throw new Error(`Invalid PDF header: ${header || 'empty file'}`);
        }

        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const loadedPdf = await loadingTask.promise;

        if (cancelled) return;
        setPdfDoc(loadedPdf);
        setTotalPages(loadedPdf.numPages);
        setCurrentPage(1);
        setPageInput('1');
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('PDF load error:', err);
          setError('Failed to load PDF document. The file may be corrupted or invalid.');
          setLoading(false);
        }
      }
    }

    loadPDF();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch(e) {}
      }
    };
  }, [pdfUrl]);

  // Render the current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let cancelled = false;

    async function renderPage() {
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch(e) {}
      }

      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Set canvas dimensions
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Render
        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
          background: 'white',
        };

        renderTaskRef.current = page.render(renderContext);
        await renderTaskRef.current.promise;
        renderTaskRef.current = null;
      } catch (err) {
        if (err?.name === 'RenderingCancelledException') return;
        console.error('Render error:', err);
        if (!cancelled) {
          setError('Failed to render page');
        }
      }
    }

    renderPage();

    return () => { cancelled = true; };
  }, [pdfDoc, currentPage, scale]);

  // Fit width on load
  useEffect(() => {
    if (!pdfDoc || !containerRef.current) return;
    // First render will happen, then we can adjust scale if needed
  }, [pdfDoc]);

  const goToPrevPage = () => {
    if (currentPage <= 1) return;
    setCurrentPage(prev => prev - 1);
    setPageInput(String(currentPage - 1));
  };

  const goToNextPage = () => {
    if (currentPage >= totalPages) return;
    setCurrentPage(prev => prev + 1);
    setPageInput(String(currentPage + 1));
  };

  const handlePageJump = (e) => {
    e.preventDefault();
    const num = parseInt(pageInput, 10);
    if (isNaN(num) || num < 1 || num > totalPages) {
      setPageInput(String(currentPage));
      return;
    }
    setCurrentPage(num);
  };

  const zoomIn = () => setScale(s => Math.min(s + 0.25, 3));
  const zoomOut = () => setScale(s => Math.max(s - 0.25, 0.5));

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = filename || 'document.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (error) {
    return (
      <div className="pdf-viewer-error">
        <div className="error-icon">⚠️</div>
        <h3>PDF Render Error</h3>
        <p>{error}</p>
        {pdfUrl && (
          <div className="pdf-viewer-error-actions">
            <a href={pdfUrl} download={filename || 'document.pdf'} className="btn btn-primary">
              ⬇ Download PDF Directly
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
          <span className="pdf-filename">📄 {filename || 'Document'}</span>
          {totalPages > 0 && (
            <span className="pdf-page-count">{totalPages} pages</span>
          )}
        </div>
        <div className="pdf-toolbar-center">
          <button
            className="pdf-nav-btn"
            onClick={goToPrevPage}
            disabled={currentPage <= 1}
            title="Previous page"
          >
            ◀
          </button>
          <form onSubmit={handlePageJump} className="pdf-page-jump">
            <input
              type="text"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              className="pdf-page-input"
            />
            <span className="pdf-page-total">/ {totalPages}</span>
          </form>
          <button
            className="pdf-nav-btn"
            onClick={goToNextPage}
            disabled={currentPage >= totalPages}
            title="Next page"
          >
            ▶
          </button>
        </div>
        <div className="pdf-toolbar-right">
          <button className="pdf-nav-btn" onClick={zoomOut} title="Zoom out" disabled={scale <= 0.5}>
            🔍-
          </button>
          <span className="pdf-zoom-level">{Math.round(scale * 100)}%</span>
          <button className="pdf-nav-btn" onClick={zoomIn} title="Zoom in" disabled={scale >= 3}>
            🔍+
          </button>
          <button className="btn btn-sm btn-accent" onClick={handleDownload}>
            ⬇ Download
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="pdf-loading">
          <div className="pdf-loading-spinner"></div>
          <span>Loading PDF document...</span>
        </div>
      )}

      {/* Canvas container */}
      <div className="pdf-canvas-container" ref={containerRef}>
        <canvas ref={canvasRef} className="pdf-canvas" style={{ display: loading ? 'none' : 'block' }} />
      </div>
    </div>
  );
}
