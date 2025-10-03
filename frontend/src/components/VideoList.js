import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function formatDuration(seconds) {
  if (!seconds) return '';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function VideoList() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const urlSearchQuery = searchParams.get('search') || '';

  const [videos, setVideos] = useState([]);
  const [filteredVideos, setFilteredVideos] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);
  const [error, setError] = useState(null);
  const [popularTags, setPopularTags] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalVideos, setTotalVideos] = useState(0);
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();
  const pageSize = 20;

  // Reset page when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [urlSearchQuery]);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true);
        setError(null);
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        let url;
        if (urlSearchQuery.trim()) {
          // Use search endpoint
          url = `${process.env.REACT_APP_BACKEND_URL}/videos/search?q=${encodeURIComponent(urlSearchQuery)}&page=${currentPage}&page_size=${pageSize}`;
        } else {
          // Use regular videos endpoint
          url = `${process.env.REACT_APP_BACKEND_URL}/videos?page=${currentPage}&page_size=${pageSize}`;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to fetch videos');
        }

        const data = await response.json();
        setVideos(data);
        setFilteredVideos(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchVideos();

    // Auto-refresh every 5 seconds only if not searching
    if (!urlSearchQuery.trim()) {
      const interval = setInterval(() => {
        fetchVideos();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [token, currentPage, urlSearchQuery]);

  useEffect(() => {
    const fetchTotalCount = async () => {
      try {
        let url;
        if (urlSearchQuery.trim()) {
          url = `${process.env.REACT_APP_BACKEND_URL}/videos/search/count?q=${encodeURIComponent(urlSearchQuery)}`;
        } else {
          url = `${process.env.REACT_APP_BACKEND_URL}/videos/count`;
        }

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setTotalVideos(data.total);
        }
      } catch (err) {
        console.error('Failed to fetch video count:', err);
      }
    };

    fetchTotalCount();
  }, [videos, urlSearchQuery]);

  useEffect(() => {
    const fetchPopularTags = async () => {
      try {
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/videos/popular-tags`, {
          headers,
        });

        if (response.ok) {
          const data = await response.json();
          setPopularTags(data);
        }
      } catch (err) {
        console.error('Failed to fetch popular tags:', err);
      }
    };

    fetchPopularTags();
  }, [token]);

  // Filter by selected tag (client-side for now)
  useEffect(() => {
    let filtered = videos;

    if (selectedTag) {
      filtered = filtered.filter(video =>
        video.tags && video.tags.some(tag => tag.toLowerCase() === selectedTag.toLowerCase())
      );
    }

    setFilteredVideos(filtered);
  }, [selectedTag, videos]);

  return (
    <div>
      {urlSearchQuery && (
        <div style={{
          padding: '16px 24px',
          backgroundColor: '#1a1a1a',
          borderBottom: '1px solid #303030',
          marginBottom: '16px'
        }}>
          <span style={{color: '#aaa', fontSize: '14px'}}>Search results for: </span>
          <span style={{color: '#f1f1f1', fontSize: '16px', fontWeight: '500'}}>"{urlSearchQuery}"</span>
          <span style={{color: '#aaa', fontSize: '14px', marginLeft: '12px'}}>({totalVideos} results)</span>
        </div>
      )}
      {popularTags.length > 0 && !urlSearchQuery && (
        <div style={{
          padding: '24px 24px 16px',
          borderBottom: '1px solid #303030',
          marginBottom: '16px'
        }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignItems: 'center'
          }}>
            <span style={{color: '#aaa', fontSize: '14px', marginRight: '8px'}}>Popular:</span>
            {selectedTag && (
              <span
                onClick={() => setSelectedTag(null)}
                style={{
                  backgroundColor: '#cc0000',
                  color: 'white',
                  padding: '6px 14px',
                  borderRadius: '16px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  border: '1px solid #cc0000'
                }}
              >
                ✕ Clear filter
              </span>
            )}
            {popularTags.map((tagData, index) => (
              <span
                key={index}
                onClick={() => setSelectedTag(tagData.tag)}
                style={{
                  backgroundColor: selectedTag === tagData.tag ? '#3ea6ff' : '#272727',
                  color: '#f1f1f1',
                  padding: '6px 14px',
                  borderRadius: '16px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  border: selectedTag === tagData.tag ? '1px solid #3ea6ff' : '1px solid #303030',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (selectedTag !== tagData.tag) {
                    e.target.style.backgroundColor = '#3ea6ff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedTag !== tagData.tag) {
                    e.target.style.backgroundColor = '#272727';
                  }
                }}
              >
                {tagData.tag} ({tagData.count})
              </span>
            ))}
          </div>
        </div>
      )}
      {error && <p className="error-message">{error}</p>}
      {filteredVideos.length === 0 && !error && !loading && (
        <p style={{textAlign: 'center', color: '#aaa', marginTop: '40px'}}>
          {urlSearchQuery ? `No videos found matching "${urlSearchQuery}"` : 'No videos available yet. Upload one!'}
        </p>
      )}
      <div className="video-grid">
        {filteredVideos.map((video) => {
          const status = video.processing_status || 'completed';
          const isProcessing = status === 'processing';
          const isFailed = status === 'failed';
          const isCompleted = status === 'completed';

          const statusConfig = {
            processing: { icon: '⏳', text: 'Processing...', color: '#ffa500', badge: '🔄 Processing' },
            failed: { icon: '❌', text: 'Processing failed', color: '#ff4444', badge: '⚠️ Failed' },
            completed: { icon: '', text: '', color: '', badge: '' }
          };

          const config = statusConfig[status] || statusConfig.completed;

          return (
            <Link
              key={video.id}
              to={isCompleted ? `/videos/${video.id}` : '#'}
              className="video-card"
              onClick={(e) => { if (!isCompleted) e.preventDefault(); }}
              style={{opacity: isCompleted ? 1 : 0.7}}
            >
              <div className="video-thumbnail-container">
                {video.thumbnail_path && isCompleted ? (
                  <img
                    src={`${process.env.REACT_APP_BACKEND_URL}${video.thumbnail_path}`}
                    alt={video.title}
                    className="video-thumbnail"
                  />
                ) : (
                  <div className="video-thumbnail" style={{
                    backgroundColor: '#272727',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{fontSize: '32px'}}>{config.icon}</div>
                    <div style={{fontSize: '12px', color: '#aaa'}}>{config.text}</div>
                  </div>
                )}
                {video.duration && isCompleted && (
                  <span className="video-duration-badge">{formatDuration(video.duration)}</span>
                )}
                {!isCompleted && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    backgroundColor: `rgba(${isFailed ? '255, 68, 68' : '255, 165, 0'}, 0.9)`,
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '500'
                  }}>
                    {config.badge}
                  </div>
                )}
              </div>
              <div className="video-info">
                <div className="video-avatar"></div>
                <div className="video-details">
                  <h3 style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    lineHeight: '1.4em',
                    maxHeight: '2.8em'
                  }}>
                    {video.title}
                  </h3>
                  <div className="video-metadata">
                    <div
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (video.owner) {
                          window.location.href = `/channel/${video.owner.id}`;
                        }
                      }}
                      style={{
                        color: '#aaa',
                        cursor: 'pointer',
                        textDecoration: 'none'
                      }}
                      onMouseEnter={(e) => e.target.style.color = '#fff'}
                      onMouseLeave={(e) => e.target.style.color = '#aaa'}
                    >
                      {video.owner?.channel_name || video.owner?.username || 'Unknown Channel'}
                    </div>
                    <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                      {video.views > 0 && <span>{video.views} views</span>}
                      {!isCompleted && <span style={{color: config.color}}>{config.text}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Pagination */}
      {totalVideos > pageSize && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px',
          marginTop: '40px',
          paddingBottom: '40px'
        }}>
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '8px 16px',
              backgroundColor: currentPage === 1 ? '#272727' : '#3ea6ff',
              color: currentPage === 1 ? '#666' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Previous
          </button>

          <span style={{ color: '#aaa', fontSize: '14px' }}>
            Page {currentPage} of {Math.ceil(totalVideos / pageSize)} ({totalVideos} videos)
          </span>

          <button
            onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalVideos / pageSize), prev + 1))}
            disabled={currentPage >= Math.ceil(totalVideos / pageSize)}
            style={{
              padding: '8px 16px',
              backgroundColor: currentPage >= Math.ceil(totalVideos / pageSize) ? '#272727' : '#3ea6ff',
              color: currentPage >= Math.ceil(totalVideos / pageSize) ? '#666' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage >= Math.ceil(totalVideos / pageSize) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Next
          </button>
        </div>
      )}

      {loading && (
        <div style={{
          textAlign: 'center',
          padding: '20px',
          color: '#aaa'
        }}>
          Loading...
        </div>
      )}
    </div>
  );
}

export default VideoList;
