from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class UserBase(BaseModel):
    username: str
    email: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: bool = True
    channel_name: Optional[str] = None
    channel_description: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None

    class Config:
        from_attributes = True

class UserProfile(BaseModel):
    id: int
    username: str
    channel_name: Optional[str] = None
    channel_description: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    subscriber_count: int = 0
    video_count: int = 0

    class Config:
        from_attributes = True

class VideoBase(BaseModel):
    title: str
    description: Optional[str] = None
    tags: Optional[List[str]] = None

class VideoCreate(VideoBase):
    pass

class Video(VideoBase):
    id: int
    file_path: Optional[str] = None  # Nullable for live streams and YouTube videos
    stream_url: Optional[str] = None
    is_live_stream: Optional[bool] = False
    youtube_url: Optional[str] = None
    thumbnail_path: Optional[str] = None
    hls_path: Optional[str] = None
    duration: Optional[int] = None
    processing_status: Optional[str] = "uploading"
    views: int = 0
    likes: int = 0
    dislikes: int = 0
    tags: Optional[List[str]] = []
    upload_date: datetime
    owner_id: int
    owner: Optional[UserProfile] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class VideoMetadataUpdate(BaseModel):
    thumbnail_path: Optional[str] = None
    hls_path: Optional[str] = None
    duration: Optional[int] = None
    processing_status: Optional[str] = None

class PlaylistBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_public: bool = True

class PlaylistCreate(PlaylistBase):
    pass

class PlaylistUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None

class Playlist(PlaylistBase):
    id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime
    video_count: int = 0

    class Config:
        from_attributes = True

class PlaylistWithVideos(Playlist):
    videos: List[Video] = []

    class Config:
        from_attributes = True
