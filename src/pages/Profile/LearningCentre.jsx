import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
  resolveLearningThumbnailUrl,
  resolveLearningVideoUrl,
} from '../../firebase/storage';
import { useToast } from '../../contexts/ToastContext';
import './LearningCentre.css';

function getCreatedMs(doc) {
  const t = doc.CreatedAt ?? doc.createdAt;
  if (!t) return 0;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (typeof t.seconds === 'number') return t.seconds * 1000;
  return 0;
}

function buildSectionsFromDocs(docs) {
  const active = docs.filter((d) => d.isActive === true);
  const byCat = {};
  for (const row of active) {
    const cat = (row.category || 'General').trim() || 'General';
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(row);
  }
  for (const cat of Object.keys(byCat)) {
    byCat[cat].sort((a, b) => getCreatedMs(b) - getCreatedMs(a));
  }
  return Object.keys(byCat)
    .sort((a, b) => a.localeCompare(b))
    .map((title) => ({
      title,
      items: byCat[title].map((row) => ({
        id: row.id,
        title: row.videoTitle || 'Untitled',
        description: (row.description || row.videoDescription || '').toString().trim(),
        videoUrl: row.videoUrl,
        thumbnailRaw: (row.thumbnail || '').toString(),
      })),
    }));
}

const LearningCentre = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [sections, setSections] = useState([]);
  /** Resolved HTTPS URLs for Firestore `thumbnail` field, keyed by document id */
  const [thumbnailUrls, setThumbnailUrls] = useState({});
  const [loadState, setLoadState] = useState('loading');
  const [loadError, setLoadError] = useState(null);

  const [activeVideo, setActiveVideo] = useState(null);
  /** idle | loading | success | error — url set when success */
  const [playState, setPlayState] = useState({ status: 'idle', url: null });

  const closeModal = useCallback(() => {
    setActiveVideo(null);
    setPlayState({ status: 'idle', url: null });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadState('loading');
      setLoadError(null);
      try {
        const snap = await getDocs(collection(db, 'learning_videos'));
        const docs = snap.docs.map((d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            videoTitle: (data.videoTitle ?? '').toString(),
            videoUrl: (data.videoUrl ?? '').toString(),
            thumbnail: (data.thumbnail ?? '').toString(),
            description: (data.description ?? data.videoDescription ?? '').toString(),
            videoDescription: (data.videoDescription ?? '').toString(),
            category: (data.category ?? '').toString(),
            CreatedAt: data.CreatedAt ?? data.createdAt,
            createdAt: data.createdAt,
            isActive: data.isActive === true,
          };
        });
        if (!cancelled) {
          setSections(buildSectionsFromDocs(docs));
          setLoadState('ready');
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e?.message || 'Failed to load videos');
          setLoadState('error');
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loadState !== 'ready') return undefined;
    let cancelled = false;
    const flat = sections.flatMap((s) => s.items);
    const withThumb = flat.filter((item) => item.thumbnailRaw?.trim());
    if (withThumb.length === 0) {
      Promise.resolve().then(() => {
        if (!cancelled) setThumbnailUrls({});
      });
      return undefined;
    }
    Promise.all(
      withThumb.map(async (item) => {
        const r = await resolveLearningThumbnailUrl(item.thumbnailRaw);
        return r.success ? { id: item.id, url: r.url } : null;
      })
    ).then((results) => {
      if (cancelled) return;
      const next = {};
      results.forEach((x) => {
        if (x) next[x.id] = x.url;
      });
      setThumbnailUrls(next);
    });
    return () => {
      cancelled = true;
    };
  }, [loadState, sections]);

  /** Resolve poster when user opens a video (covers opening before list prefetch finishes) */
  useEffect(() => {
    if (!activeVideo) return undefined;
    const { id, thumbnailRaw } = activeVideo;
    const raw = (thumbnailRaw || '').trim();
    if (!raw) return undefined;
    let cancelled = false;
    resolveLearningThumbnailUrl(raw).then((r) => {
      if (cancelled || !r.success) return;
      setThumbnailUrls((prev) => {
        if (prev[id]) return prev;
        return { ...prev, [id]: r.url };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [activeVideo]);

  useEffect(() => {
    if (!activeVideo) return undefined;
    let cancelled = false;
    resolveLearningVideoUrl(activeVideo.videoUrl).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setPlayState({ status: 'success', url: result.url });
      } else {
        setPlayState({ status: 'error', url: null });
        showToast(result.error || 'Could not load video', 'error');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeVideo, showToast]);

  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          const inTitle = item.title.toLowerCase().includes(q);
          const inSection = section.title.toLowerCase().includes(q);
          const inDesc = (item.description || '').toLowerCase().includes(q);
          return inTitle || inSection || inDesc;
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, search]);

  const hasAnyVideos = sections.some((s) => s.items.length > 0);

  const modalPosterUrl = activeVideo ? thumbnailUrls[activeVideo.id] : null;

  return (
    <div className="learning-page">
      <header className="learning-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M15 18L9 12L15 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h1>Learning Centre</h1>
        <button className="learning-notify-btn" type="button">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>

      <main className="learning-content">
        <section className="learning-banner">
          <div className="banner-text">
            <h2>Grow with BestByBites</h2>
            <p>
              Short videos to help you sell smarter, cut waste, and serve customers better.
            </p>
          </div>
        </section>

        <div className="learning-search">
          <div className="search-input-wrapper">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="11"
                cy="11"
                r="6"
                stroke="#9ca3af"
                strokeWidth="2"
              />
              <path
                d="M16 16L20 20"
                stroke="#9ca3af"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="text"
              placeholder="Search any topic"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={loadState === 'loading'}
            />
          </div>
        </div>

        {loadState === 'loading' && (
          <p className="learning-center-status learning-center-status--muted">Loading videos…</p>
        )}

        {loadState === 'error' && (
          <p className="learning-center-status learning-center-status--error" role="alert">
            {loadError || 'Something went wrong.'}
          </p>
        )}

        {loadState === 'ready' && !hasAnyVideos && (
          <p className="learning-center-status learning-center-status--muted">No videos yet.</p>
        )}

        {loadState === 'ready' &&
          hasAnyVideos &&
          filteredSections.length === 0 && (
            <p className="learning-center-status learning-center-status--muted">
              No topics match your search.
            </p>
          )}

        {loadState === 'ready' &&
          filteredSections.map(
            (section) =>
              section.items.length > 0 && (
                <section key={section.title} className="learning-section">
                  <h3 className="learning-section-title">{section.title}</h3>
                  <div className="learning-carousel">
                    {section.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="learning-card"
                        onClick={() => {
                          setActiveVideo(item);
                          setPlayState({ status: 'loading', url: null });
                        }}
                      >
                        <div className="learning-card-surface">
                          <div className="learning-thumbnail">
                            {thumbnailUrls[item.id] ? (
                              <img
                                className="learning-poster"
                                src={thumbnailUrls[item.id]}
                                alt=""
                                loading="lazy"
                              />
                            ) : (
                              <div className="learning-thumbnail-placeholder" aria-hidden />
                            )}
                            <span className="learning-play-icon" aria-hidden="true">
                              ▶
                            </span>
                          </div>
                          <div className="learning-card-body">
                            <p className="learning-card-title">{item.title}</p>
                            {item.description ? (
                              <p className="learning-card-desc">{item.description}</p>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )
          )}
      </main>

      {activeVideo && (
        <div
          className="video-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Video player"
          onClick={closeModal}
        >
          <div className="video-modal" onClick={(e) => e.stopPropagation()}>
            <div className="video-modal-header">
              <div className="video-modal-heading">
                <div className="video-modal-title">{activeVideo.title}</div>
                {activeVideo.description ? (
                  <p className="video-modal-subtitle">{activeVideo.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="video-modal-close"
                onClick={closeModal}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="video-modal-stage">
              {modalPosterUrl ? (
                <img
                  className="video-modal-poster"
                  src={modalPosterUrl}
                  alt=""
                  aria-hidden="true"
                />
              ) : null}
              {playState.status === 'loading' && (
                <div className="video-modal-loading-overlay" aria-live="polite">
                  Loading video…
                </div>
              )}
              {playState.status === 'error' && (
                <div className="video-modal-error" role="alert">
                  Could not load this video. Check the link or try again later.
                </div>
              )}
              {playState.status === 'success' && playState.url ? (
                <video
                  className="video-player"
                  src={playState.url}
                  poster={modalPosterUrl || undefined}
                  controls
                  autoPlay
                  playsInline
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningCentre;
