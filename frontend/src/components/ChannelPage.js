import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import EditProfileModal from './EditProfileModal';
import EditVideoModal from './EditVideoModal';

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

function ChannelPage() {
  const { userId } = useParams();
  const { token, user } = useAuth();
  const [channelData, setChannelData] = useState(null);
  const [videos, setVideos] = useState([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);

  const isOwnChannel = user && user.id === parseInt(userId);

  useEffect(() => {
    const fetchChannelData = async () => {
      if (!token) return;

      try {
        // Fetch channel profile
        const profileResponse = await fetch(
          `${process.env.REACT_APP_BACKEND_URL}/users/${userId}/profile`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        if (!profileResponse.ok) {
          throw new Error('Failed to load channel');
        }

        const profileData = await profileResponse.json();
        setChannelData(profileData);

        // Fetch channel videos
        const videosResponse = await fetch(
          `${process.env.REACT_APP_BACKEND_URL}/users/${userId}/videos`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        if (videosResponse.ok) {
          const videosData = await videosResponse.json();
          setVideos(videosData);
        }

        // Check subscription status (if not own channel)
        if (!isOwnChannel) {
          const subResponse = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/users/${userId}/is-subscribed`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            }
          );

          if (subResponse.ok) {
            const subData = await subResponse.json();
            setIsSubscribed(subData.is_subscribed);
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchChannelData();
  }, [userId, token, isOwnChannel]);

  const handleProfileUpdate = (updatedData) => {
    setChannelData(prev => ({
      ...prev,
      ...updatedData
    }));
  };

  const handleVideoUpdate = () => {
    // Refresh videos list
    const fetchVideos = async () => {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/users/${userId}/videos`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      if (response.ok) {
        const videosData = await response.json();
        setVideos(videosData);
      }
    };
    fetchVideos();
  };

  const handleVideoDelete = (videoId) => {
    setVideos(prev => prev.filter(v => v.id !== videoId));
    setChannelData(prev => ({
      ...prev,
      video_count: prev.video_count - 1
    }));
  };

  const handleSubscribe = async () => {
    try {
      const method = isSubscribed ? 'DELETE' : 'POST';
      const endpoint = isSubscribed ? 'unsubscribe' : 'subscribe';

      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/users/${userId}/${endpoint}`,
        {
          method,
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to ${endpoint}`);
      }

      setIsSubscribed(!isSubscribed);

      // Update subscriber count
      setChannelData(prev => ({
        ...prev,
        subscriber_count: prev.subscriber_count + (isSubscribed ? -1 : 1)
      }));
    } catch (err) {
      console.error('Subscription error:', err);
    }
  };

  if (loading) {
    return <p style={{textAlign: 'center', color: '#aaa', marginTop: '40px'}}>Loading channel...</p>;
  }

  if (error) {
    return <p style={{textAlign: 'center', color: '#ff4444', marginTop: '40px'}}>{error}</p>;
  }

  return (
    <div className="channel-page">
      <div className="channel-header">
        <div className="channel-banner" style={{
          backgroundColor: '#272727',
          height: '200px',
          width: '100%',
          marginBottom: '16px'
        }}></div>

        <div className="channel-info" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          padding: '0 24px',
          marginBottom: '24px'
        }}>
          <div className="channel-avatar" style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: '#aaa'
          }}></div>

          <div style={{flex: 1}}>
            <h1 style={{fontSize: '24px', marginBottom: '4px'}}>
              {channelData?.channel_name || channelData?.username}
            </h1>
            <div style={{color: '#aaa', fontSize: '14px', marginBottom: '4px'}}>
              @{channelData?.username}
            </div>
            <div style={{color: '#aaa', fontSize: '14px'}}>
              {channelData?.subscriber_count} subscribers • {channelData?.video_count} videos
            </div>
            {channelData?.channel_description && (
              <div style={{marginTop: '12px', color: '#f1f1f1'}}>
                {channelData.channel_description}
              </div>
            )}
          </div>

          {isOwnChannel ? (
            <button
              onClick={() => setShowEditProfile(true)}
              style={{
                backgroundColor: '#3ea6ff',
                color: 'white',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '2px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => e.target.style.opacity = '0.9'}
              onMouseLeave={(e) => e.target.style.opacity = '1'}
            >
              Edit Channel
            </button>
          ) : (
            <button
              onClick={handleSubscribe}
              style={{
                backgroundColor: isSubscribed ? '#272727' : '#cc0000',
                color: 'white',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '2px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => e.target.style.opacity = '0.9'}
              onMouseLeave={(e) => e.target.style.opacity = '1'}
            >
              {isSubscribed ? 'Subscribed' : 'Subscribe'}
            </button>
          )}
        </div>
      </div>

      <div style={{padding: '24px'}}>
        <h2 style={{marginBottom: '24px', fontSize: '20px'}}>Videos</h2>

        {videos.length === 0 ? (
          <p style={{textAlign: 'center', color: '#aaa'}}>
            No videos uploaded yet.
          </p>
        ) : (
          <div className="video-grid">
            {videos.map((video) => {
              const status = video.processing_status || 'completed';
              const isCompleted = status === 'completed';

              const statusConfig = {
                processing: { icon: '⏳', text: 'Processing...', badge: '🔄 Processing' },
                failed: { icon: '❌', text: 'Processing failed', badge: '⚠️ Failed' },
                completed: { icon: '', text: '', badge: '' }
              };

              const config = statusConfig[status] || statusConfig.completed;

              return (
                <div key={video.id} style={{ position: 'relative' }}>
                  {isOwnChannel && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingVideo(video);
                      }}
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        zIndex: 10,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      ✏️ Edit
                    </button>
                  )}
                  <Link
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
                        backgroundColor: `rgba(${status === 'failed' ? '255, 68, 68' : '255, 165, 0'}, 0.9)`,
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
                      <h3>{video.title}</h3>
                      <div className="video-metadata">
                        <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                          {video.views > 0 && <span>{video.views} views</span>}
                          {video.views > 0 && ' • '}
                          {new Date(video.upload_date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
              );
            })}
          </div>
        )}
      </div>

      <EditProfileModal
        isOpen={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        channelData={channelData}
        onUpdate={handleProfileUpdate}
      />

      <EditVideoModal
        isOpen={editingVideo !== null}
        onClose={() => setEditingVideo(null)}
        video={editingVideo}
        onUpdate={handleVideoUpdate}
        onDelete={handleVideoDelete}
      />
    </div>
  );
}

export default ChannelPage;
