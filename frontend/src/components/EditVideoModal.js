import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

function EditVideoModal({ isOpen, onClose, video, onUpdate, onDelete }) {
  const { token } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [thumbnail, setThumbnail] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Update state when video prop changes
  useEffect(() => {
    if (video) {
      setTitle(video.title || '');
      setDescription(video.description || '');
      setTags(video.tags ? video.tags.join(', ') : '');
    }
  }, [video]);

  if (!isOpen) return null;

  const handleThumbnailChange = (event) => {
    const selectedThumbnail = event.target.files[0];
    setThumbnail(selectedThumbnail);

    // Create preview
    if (selectedThumbnail) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result);
      };
      reader.readAsDataURL(selectedThumbnail);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('tags', tags);
      if (thumbnail) {
        formData.append('thumbnail', thumbnail);
      }

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/videos/${video.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to update video');
      }

      const data = await response.json();
      console.log('Video updated:', data);

      // Reset thumbnail preview on successful update
      setThumbnail(null);
      setThumbnailPreview(null);

      onUpdate();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/videos/${video.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete video');
      }

      onDelete(video.id);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#181818',
        padding: '24px',
        borderRadius: '8px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        {showDeleteConfirm ? (
          <>
            <h2 style={{ marginBottom: '20px', color: '#ff4444' }}>Delete Video?</h2>
            <p style={{ marginBottom: '20px' }}>
              Are you sure you want to permanently delete "{video.title}"? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#272727',
                  color: '#f1f1f1',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#cc0000',
                  color: 'white',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  opacity: deleting ? 0.6 : 1
                }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ marginBottom: '20px' }}>Edit Video</h2>

            {error && <p style={{ color: '#ff4444', marginBottom: '16px' }}>{error}</p>}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#272727',
                    border: '1px solid #303030',
                    borderRadius: '2px',
                    color: '#f1f1f1'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#272727',
                    border: '1px solid #303030',
                    borderRadius: '2px',
                    color: '#f1f1f1',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>
                  Tags <span style={{fontSize: '12px'}}>(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="gaming, tutorial, funny, etc."
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#272727',
                    border: '1px solid #303030',
                    borderRadius: '2px',
                    color: '#f1f1f1'
                  }}
                />
                {tags && tags.trim() && (
                  <div style={{marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
                    {tags.split(',').filter(tag => tag.trim()).map((tag, index) => (
                      <span
                        key={index}
                        style={{
                          backgroundColor: '#3ea6ff',
                          color: 'white',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          display: 'inline-block'
                        }}
                      >
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>
                  Update Thumbnail <span style={{fontSize: '12px'}}>(optional)</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#272727',
                    border: '1px solid #303030',
                    borderRadius: '2px',
                    color: '#f1f1f1'
                  }}
                />
                {thumbnailPreview ? (
                  <div style={{marginTop: '12px'}}>
                    <p style={{color: '#aaa', fontSize: '12px', marginBottom: '8px'}}>New Thumbnail Preview:</p>
                    <img
                      src={thumbnailPreview}
                      alt="New thumbnail preview"
                      style={{
                        maxWidth: '240px',
                        width: '100%',
                        borderRadius: '4px',
                        border: '2px solid #3ea6ff'
                      }}
                    />
                  </div>
                ) : video?.thumbnail_path && (
                  <div style={{marginTop: '12px'}}>
                    <p style={{color: '#aaa', fontSize: '12px', marginBottom: '8px'}}>Current Thumbnail:</p>
                    <img
                      src={`${process.env.REACT_APP_BACKEND_URL}${video.thumbnail_path}`}
                      alt="Current thumbnail"
                      style={{
                        maxWidth: '240px',
                        width: '100%',
                        borderRadius: '4px',
                        border: '1px solid #303030'
                      }}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: '#cc0000',
                    color: 'white',
                    border: 'none',
                    borderRadius: '2px',
                    cursor: 'pointer'
                  }}
                >
                  Delete Video
                </button>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    style={{
                      padding: '10px 16px',
                      backgroundColor: '#272727',
                      color: '#f1f1f1',
                      border: 'none',
                      borderRadius: '2px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      padding: '10px 16px',
                      backgroundColor: '#3ea6ff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '2px',
                      cursor: 'pointer',
                      opacity: loading ? 0.6 : 1
                    }}
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default EditVideoModal;
