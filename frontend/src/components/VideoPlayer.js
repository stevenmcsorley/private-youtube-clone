import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Hls from 'hls.js';
import AddToPlaylistModal from './AddToPlaylistModal';

function VideoPlayer() {
  const { videoId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [videoData, setVideoData] = useState(null);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const viewCountedRef = useRef(false);
  const [likeStatus, setLikeStatus] = useState('none');
  const [likeCount, setLikeCount] = useState(0);
  const [dislikeCount, setDislikeCount] = useState(0);
  const [isLooping, setIsLooping] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [relatedVideos, setRelatedVideos] = useState([]);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const youtubePlayerRef = useRef(null);

  useEffect(() => {
    // Reset state when videoId changes
    setIsLoading(true);
    setVideoData(null);
    setError(null);
    viewCountedRef.current = false;

    const fetchVideoMetadata = async () => {
      try {
        console.log('Fetching video metadata for ID:', videoId);
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        // Fetch specific video metadata
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/videos/${videoId}`, {
          headers,
        });

        if (!response.ok) {
          throw new Error('Video not found');
        }

        const currentVideo = await response.json();
        console.log('Video data loaded:', currentVideo.title);

        setVideoData(currentVideo);
        setLikeCount(currentVideo.likes || 0);
        setDislikeCount(currentVideo.dislikes || 0);
        setIsLoading(false);

        // Fetch like status
        try {
          const statusResponse = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/videos/${videoId}/like-status`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            }
          );
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            setLikeStatus(statusData.status);
          }
        } catch (err) {
          console.error('Failed to fetch like status:', err);
        }
      } catch (err) {
        console.error('Failed to fetch video metadata:', err);
        setError(err.message);
        setIsLoading(false);
      }
    };

    fetchVideoMetadata();
  }, [videoId, token]);

  // Fetch related videos OR use auto-play queue
  useEffect(() => {
    // Check if we're navigating from auto-play with an existing queue
    const autoPlayState = location.state;

    if (autoPlayState?.isAutoPlay && autoPlayState?.autoPlayQueue) {
      // Use the existing auto-play queue
      console.log('Using existing auto-play queue:', autoPlayState.autoPlayQueue.length, 'videos');
      setRelatedVideos(autoPlayState.autoPlayQueue);
    } else {
      // Normal navigation - fetch new related videos
      const fetchRelatedVideos = async () => {
        try {
          const headers = {};
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          const response = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/videos/${videoId}/related?limit=10`,
            { headers }
          );

          if (response.ok) {
            const related = await response.json();
            console.log('Fetched new related videos:', related.length);
            setRelatedVideos(related);
          }
        } catch (err) {
          console.error('Failed to fetch related videos:', err);
        }
      };

      if (videoId) {
        fetchRelatedVideos();
      }
    }
  }, [videoId, token, location.state]);

  // Update video loop attribute when isLooping changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.loop = isLooping;
    }
  }, [isLooping]);

  useEffect(() => {
    if (!videoData || !videoRef.current) return;

    const video = videoRef.current;

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Track view when video starts playing (for all video types)
    const handlePlay = () => {
      if (!viewCountedRef.current) {
        viewCountedRef.current = true;
        fetch(`${process.env.REACT_APP_BACKEND_URL}/videos/${videoId}/view`, {
          method: 'POST',
        }).catch(err => console.error('Failed to track view:', err));
      }
    };
    video.addEventListener('play', handlePlay);

    // Auto-play next video when current ends
    const handleEnded = () => {
      if (autoPlayEnabled && !isLooping && relatedVideos.length > 0) {
        const nextVideo = relatedVideos[0];
        const remainingQueue = relatedVideos.slice(1); // Remove the video we're about to play

        console.log('Video ended, auto-playing next. Queue remaining:', remainingQueue.length);

        setTimeout(() => {
          navigate(`/videos/${nextVideo.id}`, {
            state: {
              isAutoPlay: true,
              autoPlayQueue: remainingQueue
            }
          });
        }, 1000); // 1 second delay before auto-play
      }
    };
    video.addEventListener('ended', handleEnded);

    // Handle live streams (RTSP/HTTP/HTTPS stream URLs)
    if (videoData.is_live_stream && videoData.stream_url) {
      // For live streams, we need to proxy RTSP through a conversion service
      // or directly play HLS/HTTP streams
      if (videoData.stream_url.startsWith('rtsp://')) {
        // RTSP streams need server-side conversion to HLS
        // Use a proxy endpoint that converts RTSP to HLS
        const proxyUrl = `${process.env.REACT_APP_BACKEND_URL}/stream/proxy/${videoData.id}/playlist.m3u8`;

        if (Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(proxyUrl);
          hls.attachMedia(video);
          hlsRef.current = hls;
        } else {
          // Fallback for browsers that support HLS natively
          video.src = proxyUrl;
        }
      } else {
        // For HTTP/HTTPS HLS streams, play directly
        if (Hls.isSupported() && videoData.stream_url.includes('.m3u8')) {
          const hls = new Hls();
          hls.loadSource(videoData.stream_url);
          hls.attachMedia(video);
          hlsRef.current = hls;
        } else {
          // Direct playback for non-HLS or natively supported streams
          video.src = videoData.stream_url;
        }
      }

      video.play().catch(err => {
        console.log('Auto-play prevented:', err);
      });

      return () => {
        video.removeEventListener('play', handlePlay);
        if (hlsRef.current) {
          hlsRef.current.destroy();
        }
      };
    }

    // If HLS is available and supported, use it for uploaded videos
    if (videoData.hls_path && Hls.isSupported()) {
      const hls = new Hls({
        xhrSetup: (xhr) => {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        },
      });

      const hlsUrl = `${process.env.REACT_APP_BACKEND_URL}${videoData.hls_path}`;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // Don't auto-play, let user click play
        video.play().catch(err => {
          // Ignore auto-play errors
          console.log('Auto-play prevented:', err);
        });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.error('HLS error:', data);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Network error, trying to recover...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Media error, trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              setError('Failed to load HLS stream');
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;

      return () => {
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('ended', handleEnded);
        if (hls) {
          hls.destroy();
        }
      };
    }
    // Fallback to direct video streaming
    else if (videoData.hls_path && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = `${process.env.REACT_APP_BACKEND_URL}${videoData.hls_path}`;

      return () => {
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('ended', handleEnded);
      };
    }
    else {
      // Fallback to direct file streaming with blob
      const fetchVideo = async () => {
        try {
          const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/videos/${videoId}/stream`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            throw new Error('Failed to load video');
          }

          const blob = await response.blob();
          video.src = URL.createObjectURL(blob);
        } catch (err) {
          setError(err.message);
        }
      };

      fetchVideo();

      return () => {
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('ended', handleEnded);
      };
    }
  }, [videoData, videoId, relatedVideos, autoPlayEnabled, isLooping, navigate, token]);

  const handleLike = async () => {
    if (!token) {
      alert('Please log in to like videos');
      return;
    }

    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/videos/${videoId}/like`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setLikeCount(data.likes);
        setDislikeCount(data.dislikes);
        setLikeStatus(data.action === 'removed' ? 'none' : 'liked');
      }
    } catch (err) {
      console.error('Failed to like video:', err);
    }
  };

  const handleDislike = async () => {
    if (!token) {
      alert('Please log in to dislike videos');
      return;
    }

    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/videos/${videoId}/dislike`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setLikeCount(data.likes);
        setDislikeCount(data.dislikes);
        setLikeStatus(data.action === 'removed' ? 'none' : 'disliked');
      }
    } catch (err) {
      console.error('Failed to dislike video:', err);
    }
  };

  // Track view for YouTube videos on mount
  useEffect(() => {
    if (videoData && videoData.youtube_url && !viewCountedRef.current) {
      viewCountedRef.current = true;
      fetch(`${process.env.REACT_APP_BACKEND_URL}/videos/${videoId}/view`, {
        method: 'POST',
      }).catch(err => console.error('Failed to track view:', err));
    }
  }, [videoData, videoId]);

  // Setup YouTube IFrame API for auto-play on YouTube videos
  useEffect(() => {
    if (!videoData || !videoData.youtube_url) return;

    // Load YouTube IFrame API if not already loaded
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    // Initialize player when API is ready
    const initPlayer = () => {
      if (window.YT && window.YT.Player) {
        youtubePlayerRef.current = new window.YT.Player(`youtube-player-${videoId}`, {
          events: {
            onStateChange: (event) => {
              // YT.PlayerState.ENDED === 0
              if (event.data === 0 && autoPlayEnabled && !isLooping && relatedVideos.length > 0) {
                const nextVideo = relatedVideos[0];
                const remainingQueue = relatedVideos.slice(1); // Remove the video we're about to play

                console.log('YouTube video ended, auto-playing next. Queue remaining:', remainingQueue.length);

                setTimeout(() => {
                  navigate(`/videos/${nextVideo.id}`, {
                    state: {
                      isAutoPlay: true,
                      autoPlayQueue: remainingQueue
                    }
                  });
                }, 1000);
              }
            },
          },
        });
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (youtubePlayerRef.current && youtubePlayerRef.current.destroy) {
        youtubePlayerRef.current.destroy();
      }
    };
  }, [videoData, videoId, autoPlayEnabled, isLooping, relatedVideos, navigate]);

  if (error) {
    return (
      <div className="video-player-container">
        <p style={{ color: 'red', textAlign: 'center', padding: '40px' }}>{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="video-player-container">
        <p style={{ textAlign: 'center', color: '#aaa', marginTop: '40px' }}>Loading video...</p>
      </div>
    );
  }

  return (
    <div className="video-player-container">
      {videoData ? (
        <>
          <div className="video-player-wrapper">
            {videoData.youtube_url ? (
              <iframe
                key={`youtube-${videoId}`}
                id={`youtube-player-${videoId}`}
                src={`https://www.youtube.com/embed/${videoData.youtube_url}?autoplay=1&enablejsapi=1`}
                title={videoData.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            ) : (
              <video key={`video-${videoId}`} ref={videoRef} controls>
                Your browser does not support the video tag.
              </video>
            )}
            {videoData.is_live_stream && (
              <div style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                backgroundColor: '#ff0000',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  animation: 'pulse 1.5s ease-in-out infinite'
                }}></span>
                LIVE
              </div>
            )}
          </div>
          <div className="video-player-info">
            <h1>
              {videoData.title}
              {videoData.is_live_stream && (
                <span style={{
                  marginLeft: '12px',
                  fontSize: '14px',
                  color: '#ff0000',
                  fontWeight: 'normal'
                }}>
                  • LIVE STREAM
                </span>
              )}
            </h1>
            <div className="video-player-meta">
              <div className="video-stats">
                {videoData.views > 0 && `${videoData.views} views`}
                {videoData.views > 0 && ' • '}
                {new Date(videoData.upload_date).toLocaleDateString()}
              </div>
              <div className="video-actions">
                <button
                  className="action-btn"
                  onClick={handleLike}
                  style={{
                    backgroundColor: likeStatus === 'liked' ? '#3ea6ff' : 'transparent',
                    color: likeStatus === 'liked' ? 'white' : '#f1f1f1'
                  }}
                >
                  👍 {likeCount > 0 && likeCount}
                </button>
                <button
                  className="action-btn"
                  onClick={handleDislike}
                  style={{
                    backgroundColor: likeStatus === 'disliked' ? '#3ea6ff' : 'transparent',
                    color: likeStatus === 'disliked' ? 'white' : '#f1f1f1'
                  }}
                >
                  👎 {dislikeCount > 0 && dislikeCount}
                </button>
                <button className="action-btn">
                  ↗ Share
                </button>
                <button
                  className="action-btn"
                  onClick={() => setIsLooping(!isLooping)}
                  style={{
                    backgroundColor: isLooping ? '#3ea6ff' : 'transparent',
                    color: isLooping ? 'white' : '#f1f1f1'
                  }}
                  title={isLooping ? 'Loop enabled' : 'Loop disabled'}
                >
                  🔁 Loop
                </button>
                <button
                  className="action-btn"
                  onClick={() => {
                    if (!token) {
                      alert('Please log in to save videos to playlists');
                      return;
                    }
                    setShowPlaylistModal(true);
                  }}
                >
                  📝 Save
                </button>
              </div>
            </div>
            <div style={{marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px'}}>
              <div className="video-avatar"></div>
              <div>
                <div>
                  <Link
                    to={videoData.owner ? `/channel/${videoData.owner.id}` : '#'}
                    style={{color: '#f1f1f1', textDecoration: 'none', fontWeight: '500'}}
                    onMouseEnter={(e) => e.target.style.color = '#3ea6ff'}
                    onMouseLeave={(e) => e.target.style.color = '#f1f1f1'}
                  >
                    {videoData.owner?.channel_name || videoData.owner?.username || 'Unknown Channel'}
                  </Link>
                </div>
                {videoData.owner && (
                  <div style={{color: '#aaa', fontSize: '12px'}}>
                    {videoData.owner.subscriber_count} subscribers
                  </div>
                )}
              </div>
            </div>
            {videoData.description && (
              <div className="video-description">
                <strong>Description</strong>
                <p style={{marginTop: '8px'}}>{videoData.description}</p>
              </div>
            )}
          </div>

          {/* Related Videos / Up Next */}
          {relatedVideos.length > 0 && (
            <div style={{marginTop: '24px', borderTop: '1px solid #3f3f3f', paddingTop: '16px'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                <h3 style={{margin: 0}}>Up Next</h3>
                <button
                  className="action-btn"
                  onClick={() => setAutoPlayEnabled(!autoPlayEnabled)}
                  style={{
                    backgroundColor: autoPlayEnabled ? '#3ea6ff' : 'transparent',
                    color: autoPlayEnabled ? 'white' : '#f1f1f1',
                    fontSize: '13px'
                  }}
                >
                  {autoPlayEnabled ? '⏸ Autoplay ON' : '▶ Autoplay OFF'}
                </button>
              </div>
              <div style={{display: 'grid', gap: '12px'}}>
                {relatedVideos.slice(0, 5).map((video, index) => (
                  <Link
                    key={video.id}
                    to={`/videos/${video.id}`}
                    style={{
                      display: 'flex',
                      gap: '12px',
                      textDecoration: 'none',
                      color: '#f1f1f1',
                      padding: '8px',
                      borderRadius: '8px',
                      backgroundColor: index === 0 ? '#1f1f1f' : 'transparent',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2f2f2f'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index === 0 ? '#1f1f1f' : 'transparent'}
                  >
                    <img
                      src={video.thumbnail_path ? `${process.env.REACT_APP_BACKEND_URL}${video.thumbnail_path}` : 'https://via.placeholder.com/168x94/333/fff?text=No+Thumbnail'}
                      alt={video.title}
                      style={{
                        width: '168px',
                        height: '94px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        flexShrink: 0
                      }}
                    />
                    <div style={{flex: 1, minWidth: 0}}>
                      <h4 style={{
                        margin: '0 0 4px 0',
                        fontSize: '14px',
                        fontWeight: '500',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {index === 0 && autoPlayEnabled && '▶ '}
                        {video.title}
                      </h4>
                      <p style={{
                        margin: '0',
                        fontSize: '12px',
                        color: '#aaa'
                      }}>
                        {video.owner?.channel_name || 'Unknown'}
                      </p>
                      <p style={{
                        margin: '4px 0 0 0',
                        fontSize: '12px',
                        color: '#aaa'
                      }}>
                        {video.views} views
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p style={{textAlign: 'center', color: 'red', marginTop: '40px'}}>
          Error: Video data not available. Please try refreshing the page.
        </p>
      )}

      <AddToPlaylistModal
        isOpen={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        videoId={parseInt(videoId)}
      />
    </div>
  );
}

export default VideoPlayer;
