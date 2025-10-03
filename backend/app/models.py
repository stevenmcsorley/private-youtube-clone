from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Table, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .database import Base

# Subscription association table
subscriptions = Table(
    'subscriptions',
    Base.metadata,
    Column('subscriber_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('subscribed_to_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('subscribed_at', DateTime(timezone=True), server_default=func.now())
)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)

    # Channel info
    channel_name = Column(String, nullable=True)
    channel_description = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    banner_url = Column(String, nullable=True)

    videos = relationship("Video", back_populates="owner")

    # Subscriptions: users this user is subscribed to
    subscriptions = relationship(
        "User",
        secondary=subscriptions,
        primaryjoin=id == subscriptions.c.subscriber_id,
        secondaryjoin=id == subscriptions.c.subscribed_to_id,
        backref="subscribers"
    )

class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    file_path = Column(String, nullable=True)  # Nullable for live streams and YouTube videos
    stream_url = Column(String, nullable=True)  # RTSP/HLS stream URL
    is_live_stream = Column(Boolean, default=False)  # True if this is a live stream
    youtube_url = Column(String, nullable=True)  # YouTube video URL/ID
    thumbnail_path = Column(String, nullable=True)
    hls_path = Column(String, nullable=True)
    duration = Column(Integer, nullable=True)  # Duration in seconds
    processing_status = Column(String, default="uploading")  # uploading, processing, completed, failed
    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    dislikes = Column(Integer, default=0)
    tags = Column(ARRAY(String), nullable=True, default=[])  # Array of tags for categorization
    upload_date = Column(DateTime(timezone=True), server_default=func.now())
    owner_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="videos")
    video_likes = relationship("VideoLike", back_populates="video", cascade="all, delete-orphan")

class VideoLike(Base):
    __tablename__ = "video_likes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False)
    is_like = Column(Boolean, nullable=False)  # True = like, False = dislike
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    video = relationship("Video", back_populates="video_likes")
    user = relationship("User")

# Playlist-Video association table for many-to-many relationship
playlist_videos = Table(
    'playlist_videos',
    Base.metadata,
    Column('playlist_id', Integer, ForeignKey('playlists.id'), primary_key=True),
    Column('video_id', Integer, ForeignKey('videos.id'), primary_key=True),
    Column('position', Integer, nullable=False),  # Order of videos in playlist
    Column('added_at', DateTime(timezone=True), server_default=func.now())
)

class Playlist(Base):
    __tablename__ = "playlists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_public = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    owner = relationship("User")
    videos = relationship("Video", secondary=playlist_videos, order_by=playlist_videos.c.position)
