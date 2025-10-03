import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function AddYouTubeForm() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    if (!youtubeUrl) {
      setError('Please enter a YouTube URL');
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('youtube_url', youtubeUrl);
    if (tags) {
      formData.append('tags', tags);
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/videos/add-youtube`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to add YouTube video');
      }

      const data = await response.json();
      setSuccess(true);
      setYoutubeUrl('');
      setTags('');

      // Redirect to the video page after 1 second
      setTimeout(() => {
        navigate(`/watch/${data.id}`);
      }, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px' }}>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: '#f1f1f1' }}>
            YouTube URL *
          </label>
          <input
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            required
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#282828',
              border: '1px solid #303030',
              borderRadius: '4px',
              color: '#f1f1f1',
              fontSize: '14px'
            }}
          />
          <small style={{ color: '#aaa', display: 'block', marginTop: '4px' }}>
            The title, description, thumbnail, and duration will be automatically fetched
          </small>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: '#f1f1f1' }}>
            Tags (optional)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g., gaming, tutorial, music (comma-separated)"
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#282828',
              border: '1px solid #303030',
              borderRadius: '4px',
              color: '#f1f1f1',
              fontSize: '14px'
            }}
          />
        </div>

        {error && (
          <div style={{
            padding: '12px',
            marginBottom: '16px',
            backgroundColor: '#d32f2f',
            color: 'white',
            borderRadius: '4px'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            padding: '12px',
            marginBottom: '16px',
            backgroundColor: '#2e7d32',
            color: 'white',
            borderRadius: '4px'
          }}>
            YouTube video added successfully! Redirecting...
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '12px 24px',
            backgroundColor: loading ? '#555' : '#3ea6ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Fetching video info...' : 'Add YouTube Video'}
        </button>
      </form>
    </div>
  );
}

export default AddYouTubeForm;
