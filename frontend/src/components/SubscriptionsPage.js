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

function SubscriptionsPage() {
  const [videos, setVideos] = useState([]);
  const [error, setError] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [popularTags, setPopularTags] = useState([]);
  const [filteredVideos, setFilteredVideos] = useState([]);
  const { token } = useAuth();

  useEffect(() => {
    const fetchSubscriptionsFeed = async () => {
      if (!token) {
        setError('Please log in to view your subscriptions feed.');
        return;
      }

      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/videos/subscriptions-feed`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to fetch subscriptions feed');
        }

        const data = await response.json();
        setVideos(data);
      } catch (err) {
        setError(err.message);
      }
    };

    fetchSubscriptionsFeed();
  }, [token]);

  useEffect(() => {
    const fetchPopularTags = async () => {
      if (!token) return;

      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/videos/popular-tags`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
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
      <h1 style={{padding: '24px', fontSize: '24px'}}>Subscriptions</h1>
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
          {selectedTag ? `No subscription videos found with tag "${selectedTag}".` : 'No videos from your subscriptions. Subscribe to channels to see their videos here!'}
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
                    {' • '}
                    {new Date(video.upload_date).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default SubscriptionsPage;
