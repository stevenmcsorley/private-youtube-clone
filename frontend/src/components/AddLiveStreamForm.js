import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function AddLiveStreamForm() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [thumbnail, setThumbnail] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { token } = useAuth();
  const navigate = useNavigate();

  const handleThumbnailChange = (event) => {
    const selectedThumbnail = event.target.files[0];
    setThumbnail(selectedThumbnail);

    if (selectedThumbnail) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result);
      };
      reader.readAsDataURL(selectedThumbnail);
    } else {
      setThumbnailPreview(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!streamUrl) {
      setError('Please enter a stream URL.');
      return;
    }

    // Validate RTSP URL format
    if (!streamUrl.startsWith('rtsp://') && !streamUrl.startsWith('http://') && !streamUrl.startsWith('https://')) {
      setError('Stream URL must start with rtsp://, http://, or https://');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('tags', tags);
      formData.append('stream_url', streamUrl);
      if (thumbnail) {
        formData.append('thumbnail', thumbnail);
      }

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/videos/add-stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to add live stream');
      }

      const data = await response.json();
      setMessage('Live stream added successfully!');

      // Reset form
      setTitle('');
      setDescription('');
      setTags('');
      setStreamUrl('');
      setThumbnail(null);
      setThumbnailPreview(null);

      // Redirect to the video page after 2 seconds
      setTimeout(() => {
        navigate(`/videos/${data.id}`);
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '24px' }}>Add Live Stream</h1>

      {error && (
        <div style={{
          backgroundColor: 'rgba(255, 0, 0, 0.1)',
          border: '1px solid #ff0000',
          color: '#ff6b6b',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      )}

      {message && (
        <div style={{
          backgroundColor: 'rgba(0, 255, 0, 0.1)',
          border: '1px solid #00ff00',
          color: '#69db7c',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            Stream URL *
          </label>
          <input
            type="text"
            value={streamUrl}
            onChange={(e) => setStreamUrl(e.target.value)}
            placeholder="rtsp://username:password@192.168.1.100:554/stream1"
            required
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#272727',
              border: '1px solid #303030',
              borderRadius: '4px',
              color: '#f1f1f1',
              fontSize: '14px'
            }}
          />
          <p style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
            Supports RTSP, HLS (http/https) streams
          </p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My Security Camera"
            required
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#272727',
              border: '1px solid #303030',
              borderRadius: '4px',
              color: '#f1f1f1',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Live stream description..."
            rows={4}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#272727',
              border: '1px solid #303030',
              borderRadius: '4px',
              color: '#f1f1f1',
              fontSize: '14px',
              resize: 'vertical'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            Tags
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="live, security, camera (comma-separated)"
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#272727',
              border: '1px solid #303030',
              borderRadius: '4px',
              color: '#f1f1f1',
              fontSize: '14px'
            }}
          />
          {tags && (
            <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {tags.split(',').filter(tag => tag.trim()).map((tag, index) => (
                <span
                  key={index}
                  style={{
                    backgroundColor: '#3ea6ff',
                    color: 'white',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                >
                  {tag.trim()}
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            Thumbnail
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleThumbnailChange}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#272727',
              border: '1px solid #303030',
              borderRadius: '4px',
              color: '#f1f1f1',
              fontSize: '14px'
            }}
          />
          {thumbnailPreview && (
            <div style={{ marginTop: '12px' }}>
              <img
                src={thumbnailPreview}
                alt="Thumbnail preview"
                style={{
                  maxWidth: '300px',
                  width: '100%',
                  borderRadius: '8px',
                  border: '2px solid #3ea6ff'
                }}
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '12px 24px',
              backgroundColor: '#3ea6ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              opacity: isSubmitting ? 0.6 : 1
            }}
          >
            {isSubmitting ? 'Adding Stream...' : 'Add Stream'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/my-videos')}
            disabled={isSubmitting}
            style={{
              padding: '12px 24px',
              backgroundColor: '#272727',
              color: '#f1f1f1',
              border: '1px solid #303030',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500'
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddLiveStreamForm;
