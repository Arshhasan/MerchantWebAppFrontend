import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LearningCentre.css';

const learningSections = [
  {
    title: 'Getting Started',
    items: [
      {
        id: 1,
        title: 'How to set up your BestByBites store',
        duration: '04:32',
        thumbnailColor: '#0052cc',
        videoUrl:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        posterUrl: '/BAGS.png',
      },
      {
        id: 2,
        title: 'Create your first surprise bag',
        duration: '03:10',
        thumbnailColor: '#02a86b',
        videoUrl:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        posterUrl: '/CREATE SURPRISE BAG.png',
      },
      {
        id: 3,
        title: 'Understanding order flow',
        duration: '02:45',
        thumbnailColor: '#ff6b9d',
        videoUrl:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
        posterUrl: '/CUSTOMER ORDER.png',
      },
    ],
  },
  {
    title: 'Customer Experience',
    items: [
      {
        id: 4,
        title: 'How to improve customer ratings',
        duration: '01:17',
        thumbnailColor: '#e63946',
        videoUrl:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        posterUrl: '/CONFIRM PICKUP.png',
      },
      {
        id: 5,
        title: 'Best practices for pickups',
        duration: '02:02',
        thumbnailColor: '#457b9d',
        videoUrl:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        posterUrl: '/GET PAID.png',
      },
      {
        id: 6,
        title: 'Handling complaints & refunds',
        duration: '03:25',
        thumbnailColor: '#f4a261',
        videoUrl:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
        posterUrl: '/realtimeanalysis.jpg',
      },
    ],
  },
];

const LearningCentre = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeVideo, setActiveVideo] = useState(null);

  const filteredSections = learningSections.map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      item.title.toLowerCase().includes(search.toLowerCase())
    ),
  }));

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
              Simple, bite‑sized lessons to help you increase sales, reduce waste and
              delight customers.
            </p>
          </div>
          <div className="banner-illustration">
            <div className="banner-circle" />
            <div className="banner-card" />
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
            />
          </div>
        </div>

        {filteredSections.map(
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
                      onClick={() => setActiveVideo(item)}
                    >
                      <div
                        className="learning-thumbnail"
                        style={{ backgroundColor: item.thumbnailColor }}
                      >
                        {item.posterUrl && (
                          <img
                            className="learning-poster"
                            src={item.posterUrl}
                            alt=""
                            aria-hidden="true"
                          />
                        )}
                        <span className="play-button" aria-hidden="true">
                          ▶
                        </span>
                        <span className="video-duration">{item.duration}</span>
                      </div>
                      <p className="learning-card-title">{item.title}</p>
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
          onClick={() => setActiveVideo(null)}
        >
          <div className="video-modal" onClick={(e) => e.stopPropagation()}>
            <div className="video-modal-header">
              <div className="video-modal-title">{activeVideo.title}</div>
              <button
                type="button"
                className="video-modal-close"
                onClick={() => setActiveVideo(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <video
              className="video-player"
              src={activeVideo.videoUrl}
              poster={activeVideo.posterUrl}
              controls
              autoPlay
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningCentre;

