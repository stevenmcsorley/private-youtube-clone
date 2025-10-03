import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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

function TrendingPage() {
  const [videos, setVideos] = useState([]);
  const [error, setError] = useState(null);
  const [timePeriod, setTimePeriod] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [popularTags, setPopularTags] = useState([]);
  const [filteredVideos, setFilteredVideos] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalVideos, setTotalVideos] = useState(0);
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();
  const pageSize = 20;

  useEffect(() => {
    const fetchTrendingVideos = async () => {
      try {
        setLoading(true);
        let url = `${process.env.REACT_APP_BACKEND_URL}/videos/trending?page=${currentPage}&page_size=${pageSize}`;
        if (timePeriod) {
          url += `&time_period=${timePeriod}`;
        }

        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
          headers,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to fetch trending videos');
        }

        const data = await response.json();
        setVideos(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchTrendingVideos();
  }, [token, timePeriod, currentPage]);

  useEffect(() => {
    const fetchTotalCount = async () => {
      try {
        let url = `${process.env.REACT_APP_BACKEND_URL}/videos/trending/count`;
        if (timePeriod) {
          url += `?time_period=${timePeriod}`;
        }

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setTotalVideos(data.total);
        }
      } catch (err) {
        console.error('Failed to fetch trending count:', err);
      }
    };

    fetchTotalCount();
  }, [timePeriod, videos]);

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

  useEffect(() => {
    if (selectedTag) {
      const filtered = videos.filter(video =>
        video.tags && video.tags.some(tag => tag.toLowerCase() === selectedTag.toLowerCase())
      );
      setFilteredVideos(filtered);
    } else {
      setFilteredVideos(videos);
    }
  }, [selectedTag, videos]);

  return (
    <div>
      <div style={{padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h1 style={{fontSize: '24px', margin: 0}}>Trending</h1>
        <div style={{display: 'flex', gap: '8px'}}>
          <button
            onClick={() => setTimePeriod(null)}
            style={{
              padding: '8px 16px',
              backgroundColor: timePeriod === null ? '#3ea6ff' : '#272727',
              color: 'white',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            All Time
          </button>
          <button
            onClick={() => setTimePeriod('month')}
            style={{
              padding: '8px 16px',
              backgroundColor: timePeriod === 'month' ? '#3ea6ff' : '#272727',
              color: 'white',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            This Month
          </button>
          <button
            onClick={() => setTimePeriod('week')}
            style={{
              padding: '8px 16px',
              backgroundColor: timePeriod === 'week' ? '#3ea6ff' : '#272727',
              color: 'white',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            This Week
          </button>
        </div>
      </div>
      {popularTags.length > 0 && (
        <div style={{
          padding: '0 24px 16px',
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
      {filteredVideos.length === 0 && !error && (
        <p style={{textAlign: 'center', color: '#aaa', marginTop: '40px'}}>
          {selectedTag ? `No trending videos found with tag "${selectedTag}".` : 'No trending videos yet.'}
        </p>
      )}
      <div className="video-grid">
        {filteredVideos.map((video) => (
          <Link
            key={video.id}
            to={`/videos/${video.id}`}
            className="video-card"
          >
            <div className="video-thumbnail-container">
              {video.thumbnail_path ? (
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
                  justifyContent: 'center'
                }}>
                  <div style={{fontSize: '32px'}}>📹</div>
                </div>
              )}
              {video.duration && (
                <span className="video-duration-badge">{formatDuration(video.duration)}</span>
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
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
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

export default TrendingPage;
