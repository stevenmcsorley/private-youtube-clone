from typing import List, Optional
from datetime import timedelta, datetime
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Header, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, String
import os
import shutil
import httpx # Import httpx
import subprocess
import asyncio

from . import models, schemas, security
from .database import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# Track active stream processes and viewer counts
# Format: {video_id: {"process": Popen, "last_access": timestamp, "viewers": 0}}
active_streams = {}
STREAM_TIMEOUT = 300  # Stop stream after 5 minutes of no activity

async def cleanup_inactive_streams():
    """Background task to stop FFmpeg processes for inactive streams"""
    import time
    while True:
        await asyncio.sleep(10)  # Check every 10 seconds
        current_time = time.time()
        streams_to_stop = []

        for video_id, stream_data in active_streams.items():
            if current_time - stream_data["last_access"] > STREAM_TIMEOUT:
                streams_to_stop.append(video_id)

        for video_id in streams_to_stop:
            stream_data = active_streams.pop(video_id, None)
            if stream_data and stream_data["process"]:
                try:
                    stream_data["process"].terminate()
                    stream_data["process"].wait(timeout=5)
                except:
                    try:
                        stream_data["process"].kill()
                    except:
                        pass
                # Clean up stream directory
                stream_dir = f"/app/streams/{video_id}"
                if os.path.exists(stream_dir):
                    shutil.rmtree(stream_dir, ignore_errors=True)
                print(f"Stopped inactive stream for video {video_id}")

# Startup event to handle stuck processing videos
@app.on_event("startup")
async def startup_event():
    """Handle videos stuck in processing status on startup"""
    db = SessionLocal()
    try:
        # Find videos stuck in processing
        stuck_videos = db.query(models.Video).filter(
            models.Video.processing_status == "processing"
        ).all()

        if stuck_videos:
            print(f"Found {len(stuck_videos)} videos stuck in processing. Attempting to restart processing...")

            for video in stuck_videos:
                try:
                    # Retry processing
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        response = await client.post(
                            "http://video-processor:8002/process-video",
                            json={
                                "video_path": video.file_path,
                                "video_id": video.id,
                                "skip_thumbnail": video.thumbnail_path is not None,
                                "delete_original": True
                            }
                        )
                        if response.status_code == 200:
                            print(f"Restarted processing for video ID {video.id}")
                        else:
                            print(f"Failed to restart processing for video ID {video.id}")
                            video.processing_status = "failed"
                except Exception as e:
                    print(f"Error restarting video ID {video.id}: {e}")
                    video.processing_status = "failed"

            db.commit()
            print("Processing recovery complete")
    except Exception as e:
        print(f"Error during startup recovery: {e}")
    finally:
        db.close()

    # Start background task to cleanup inactive streams
    asyncio.create_task(cleanup_inactive_streams())

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://192.168.1.198:8080",
        "http://192.168.1.198:8001",
        "http://localhost:8080",
        "http://localhost:8001",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for thumbnails
os.makedirs("/app/thumbnails", exist_ok=True)
app.mount("/thumbnails", StaticFiles(directory="/app/thumbnails"), name="thumbnails")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Dependency to get the DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Helper function to get user by username
def get_user(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

# Helper function to get current user (required - raises exception if not authenticated)
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = security.decode_access_token(token)
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username)
    except security.JWTError:
        raise credentials_exception
    user = get_user(db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

# Helper function to get current user optionally (returns None if not authenticated)
async def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[models.User]:
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.replace("Bearer ", "")
    try:
        payload = security.decode_access_token(token)
        username: str = payload.get("sub")
        if username is None:
            return None
        user = get_user(db, username=username)
        return user
    except:
        return None

@app.get("/")
async def read_root():
    return {"message": "Welcome to the Video Streaming Backend!"}

@app.get("/test-db")
async def test_db_connection(db: Session = Depends(get_db)):
    try:
        db.execute("SELECT 1")
        return {"message": "Database connection successful!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {e}")

@app.post("/register", response_model=schemas.User)
async def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = get_user(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = security.get_password_hash(user.password)
    db_user = models.User(username=user.username, email=user.email, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = get_user(db, username=form_data.username)
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.User)
async def read_users_me(current_user: schemas.User = Depends(get_current_user)):
    return current_user

@app.post("/videos/extract-metadata")
async def extract_video_metadata(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user)
):
    """Extract metadata from video file for auto-populating title/description"""
    UPLOAD_DIR = "/app/uploads"
    TEMP_DIR = "/app/uploads/temp"
    os.makedirs(TEMP_DIR, exist_ok=True)

    # Save file temporarily
    temp_file_path = os.path.join(TEMP_DIR, file.filename)
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Call video processor to extract metadata
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "http://video-processor:8002/extract-metadata",
                params={"video_path": temp_file_path}
            )
            response.raise_for_status()
            metadata = response.json()

        # Use filename as fallback if no title in metadata
        if not metadata.get('title'):
            metadata['title'] = os.path.splitext(file.filename)[0]

        return metadata
    except Exception as e:
        print(f"Error extracting metadata: {e}")
        # Return filename as title on error
        return {
            "title": os.path.splitext(file.filename)[0],
            "description": "",
            "duration": 0
        }
    finally:
        # Clean up temp file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

@app.post("/videos/upload", response_model=schemas.Video)
async def upload_video(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # Comma-separated tags
    file: UploadFile = File(...),
    thumbnail: Optional[UploadFile] = File(None),  # Optional custom thumbnail
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    UPLOAD_DIR = "/app/uploads"
    THUMBNAIL_DIR = "/app/thumbnails"
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    os.makedirs(THUMBNAIL_DIR, exist_ok=True)

    file_location = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Parse tags
    tag_list = []
    if tags:
        tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]

    # Handle custom thumbnail if provided
    custom_thumbnail_path = None
    if thumbnail:
        # Generate unique filename for thumbnail
        thumbnail_filename = f"{os.path.splitext(file.filename)[0]}_custom_thumb.jpg"
        thumbnail_location = os.path.join(THUMBNAIL_DIR, thumbnail_filename)
        with open(thumbnail_location, "wb") as buffer:
            shutil.copyfileobj(thumbnail.file, buffer)
        custom_thumbnail_path = f"/thumbnails/{thumbnail_filename}"

    db_video = models.Video(
        title=title,
        description=description,
        tags=tag_list,
        file_path=file_location,
        thumbnail_path=custom_thumbnail_path,  # Set custom thumbnail if provided
        owner_id=current_user.id,
        processing_status="processing"
    )
    db.add(db_video)
    db.commit()
    db.refresh(db_video)

    # Trigger video processing
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://video-processor:8002/process-video",
                json={
                    "video_path": file_location,
                    "video_id": db_video.id,
                    "skip_thumbnail": custom_thumbnail_path is not None,  # Skip thumbnail gen if custom provided
                    "delete_original": True  # Delete original to save space after HLS conversion
                }
            )
            response.raise_for_status()
            print(f"Video processing triggered successfully for video ID {db_video.id}")
    except httpx.RequestError as e:
        print(f"Error triggering video processor for video ID {db_video.id}: {e}")
        db_video.processing_status = "failed"
        db.commit()
    except httpx.HTTPStatusError as e:
        print(f"Error response from video processor for video ID {db_video.id}: {e.response.status_code} - {e.response.text}")
        db_video.processing_status = "failed"
        db.commit()

    return db_video

@app.post("/videos/add-stream", response_model=schemas.Video)
async def add_live_stream(
    title: str = Form(...),
    stream_url: str = Form(...),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    thumbnail: Optional[UploadFile] = File(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a live stream (RTSP/HLS URL) without uploading a file"""
    THUMBNAIL_DIR = "/app/thumbnails"
    os.makedirs(THUMBNAIL_DIR, exist_ok=True)

    # Parse tags
    tag_list = []
    if tags:
        tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]

    # Handle custom thumbnail if provided
    custom_thumbnail_path = None
    if thumbnail:
        thumbnail_filename = f"stream_{current_user.id}_{int(datetime.now().timestamp())}.jpg"
        thumbnail_location = os.path.join(THUMBNAIL_DIR, thumbnail_filename)
        with open(thumbnail_location, "wb") as buffer:
            shutil.copyfileobj(thumbnail.file, buffer)
        custom_thumbnail_path = f"/thumbnails/{thumbnail_filename}"

    # Create video record for live stream
    db_video = models.Video(
        title=title,
        description=description,
        tags=tag_list,
        stream_url=stream_url,
        is_live_stream=True,
        file_path=None,  # No file for live streams
        thumbnail_path=custom_thumbnail_path,
        owner_id=current_user.id,
        processing_status="completed",  # Live streams are immediately available
        duration=0  # Live streams have no fixed duration
    )
    db.add(db_video)
    db.commit()
    db.refresh(db_video)

    return db_video

@app.post("/videos/add-youtube", response_model=schemas.Video)
async def add_youtube_video(
    youtube_url: str = Form(...),
    tags: Optional[str] = Form(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a YouTube video by URL - automatically fetches metadata"""
    import yt_dlp
    import re

    # Extract video ID from YouTube URL
    youtube_regex = r'(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})'
    match = re.search(youtube_regex, youtube_url)

    if not match:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")

    video_id = match.group(1)

    # Use yt-dlp to fetch video metadata
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)

            title = info.get('title', 'Untitled YouTube Video')
            description = info.get('description', '')
            duration = info.get('duration', 0)  # Duration in seconds
            thumbnail_url = info.get('thumbnail', '')

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch YouTube video info: {str(e)}")

    # Download thumbnail if available
    thumbnail_path = None
    if thumbnail_url:
        try:
            import requests
            THUMBNAIL_DIR = "/app/thumbnails"
            os.makedirs(THUMBNAIL_DIR, exist_ok=True)

            thumbnail_filename = f"youtube_{video_id}.jpg"
            thumbnail_location = os.path.join(THUMBNAIL_DIR, thumbnail_filename)

            response = requests.get(thumbnail_url, timeout=10)
            response.raise_for_status()

            with open(thumbnail_location, "wb") as f:
                f.write(response.content)

            thumbnail_path = f"/thumbnails/{thumbnail_filename}"
        except Exception as e:
            print(f"Failed to download YouTube thumbnail: {e}")

    # Parse tags
    tag_list = []
    if tags:
        tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]

    # Create video record for YouTube video
    db_video = models.Video(
        title=title,
        description=description[:500] if description else None,  # Limit description length
        tags=tag_list,
        youtube_url=video_id,  # Store just the video ID
        file_path=None,
        thumbnail_path=thumbnail_path,
        owner_id=current_user.id,
        processing_status="completed",  # YouTube videos are immediately available
        duration=duration
    )
    db.add(db_video)
    db.commit()
    db.refresh(db_video)

    return db_video

@app.post("/admin/auto-import-youtube")
async def auto_import_youtube_videos(
    categories: Optional[List[str]] = None,
    videos_per_category: int = 2,
    username: str = "autobot",
    background_tasks: BackgroundTasks = None
):
    """Auto-import YouTube videos from predefined categories (for cron job) - runs in background"""
    import socket

    # Check internet connection first
    try:
        socket.create_connection(("8.8.8.8", 53), timeout=3)
    except OSError:
        return {"status": "skipped", "message": "No internet connection, waiting for next cron job"}

    # Run import in background
    if background_tasks:
        background_tasks.add_task(import_youtube_videos_task, categories, videos_per_category, username)
        return {"status": "started", "message": f"Import started in background for {username}"}
    else:
        # Fallback to sync if no background tasks
        await import_youtube_videos_task(categories, videos_per_category, username)
        return {"status": "completed", "message": f"Import completed for {username}"}

def import_youtube_videos_task(categories: Optional[List[str]] = None, videos_per_category: int = 2, username: str = "autobot"):
    """Background task for importing YouTube videos"""
    import yt_dlp
    import random
    from app.database import SessionLocal

    db = SessionLocal()

    # Expanded category pool for more variety
    all_categories = [
        # Tech & Science
        "technology news today",
        "AI artificial intelligence explained",
        "space exploration documentary",
        "science experiments",
        "robotics innovation",
        "cybersecurity tutorial",
        "programming tutorial",
        "gadget review 2024",
        "tech unboxing",
        "web development",

        # Gaming
        "gaming highlights 2024",
        "game review",
        "esports tournament",
        "indie game showcase",
        "speedrun gameplay",
        "retro gaming",
        "game walkthrough",
        "gaming news",

        # Food & Cooking
        "cooking tutorial easy",
        "baking recipe",
        "street food around world",
        "chef cooking tips",
        "vegan recipe",
        "dessert recipe",
        "meal prep ideas",
        "food review",

        # Entertainment
        "comedy sketches",
        "stand up comedy",
        "funny moments compilation",
        "prank videos",
        "magic tricks revealed",
        "talent show performance",

        # Music
        "music video 2024",
        "live concert performance",
        "guitar tutorial",
        "music production tips",
        "cover songs",
        "piano performance",
        "jazz music",
        "electronic music",

        # Education & How-to
        "history documentary",
        "DIY home improvement",
        "art tutorial drawing",
        "photography tips",
        "animation tutorial",
        "language learning",
        "math explained simply",

        # Lifestyle
        "travel vlog 2024",
        "fitness workout routine",
        "yoga for beginners",
        "meditation guide",
        "fashion haul",
        "beauty makeup tutorial",
        "home organization",
        "productivity tips",

        # Sports & Outdoors
        "sports highlights today",
        "extreme sports",
        "hiking adventure",
        "cycling tips",
        "workout motivation",
        "martial arts training",
        "camping survival",

        # Nature & Animals
        "wildlife documentary",
        "cute animals compilation",
        "nature photography",
        "ocean life documentary",
        "bird watching",
        "pet training tips",

        # Cars & Vehicles
        "car review 2024",
        "motorcycle review",
        "classic car restoration",
        "electric vehicle",
        "racing highlights",

        # Business & Finance
        "investing for beginners",
        "cryptocurrency explained",
        "business startup tips",
        "personal finance advice",

        # Creative & Arts
        "woodworking projects",
        "pottery tutorial",
        "crafts DIY",
        "digital art process",
        "film making tips",
        "short film"
    ]

    # Default categories if none provided - randomly select subset
    if not categories:
        # Select 12 random categories from the pool for variety
        categories = random.sample(all_categories, min(12, len(all_categories)))

    # Get the specified user
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        print(f"User '{username}' not found, skipping import")
        return {"status": "error", "message": f"User '{username}' not found"}

    imported_videos = []
    errors = []

    for category in categories:
        try:
            # Add randomization to search by using date filters or sorting
            # This helps get different results each time
            search_modifiers = [
                "",  # No modifier
                " this week",
                " recent",
                " new",
                " latest",
                " popular",
            ]
            search_suffix = random.choice(search_modifiers)

            # Search YouTube for videos in this category
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': False,
                'playlistend': videos_per_category * 3,  # Fetch more to account for duplicates
            }

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                search_query = f"ytsearch{videos_per_category * 3}:{category}{search_suffix}"
                results = ydl.extract_info(search_query, download=False)

                if not results or 'entries' not in results:
                    continue

                # Track how many we've imported for this category
                category_import_count = 0

                for video_info in results['entries']:
                    if not video_info:
                        continue

                    # Stop if we've imported enough for this category
                    if category_import_count >= videos_per_category:
                        break

                    video_id = video_info.get('id')

                    # Check if video already exists
                    existing = db.query(models.Video).filter(
                        models.Video.youtube_url == video_id
                    ).first()

                    if existing:
                        continue  # Skip duplicates

                    title = video_info.get('title', 'Untitled')
                    description = video_info.get('description', '')
                    duration = video_info.get('duration', 0)
                    thumbnail_url = video_info.get('thumbnail', '')

                    # Extract YouTube tags and combine with our category
                    video_tags = [category, "auto-imported"]
                    youtube_tags = video_info.get('tags', [])
                    if youtube_tags and isinstance(youtube_tags, list):
                        # Add first 5 YouTube tags (keep it manageable)
                        video_tags.extend(youtube_tags[:5])

                    # Download thumbnail
                    thumbnail_path = None
                    if thumbnail_url:
                        try:
                            import requests
                            THUMBNAIL_DIR = "/app/thumbnails"
                            os.makedirs(THUMBNAIL_DIR, exist_ok=True)

                            thumbnail_filename = f"youtube_{video_id}.jpg"
                            thumbnail_location = os.path.join(THUMBNAIL_DIR, thumbnail_filename)

                            response = requests.get(thumbnail_url, timeout=10)
                            response.raise_for_status()

                            with open(thumbnail_location, "wb") as f:
                                f.write(response.content)

                            thumbnail_path = f"/thumbnails/{thumbnail_filename}"
                        except Exception as e:
                            print(f"Failed to download thumbnail for {video_id}: {e}")

                    # Create video record
                    db_video = models.Video(
                        title=title,
                        description=description[:500] if description else None,
                        tags=video_tags,
                        youtube_url=video_id,
                        file_path=None,
                        thumbnail_path=thumbnail_path,
                        owner_id=user.id,
                        processing_status="completed",
                        duration=duration
                    )
                    db.add(db_video)
                    imported_videos.append({"id": video_id, "title": title, "category": category})
                    category_import_count += 1

        except Exception as e:
            errors.append(f"Error importing {category}: {str(e)}")
            print(f"Error importing {category}: {e}")

    # Commit all imported videos
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": f"Database error: {str(e)}", "imported": 0}

    return {
        "status": "success",
        "imported_count": len(imported_videos),
        "videos": imported_videos,
        "errors": errors if errors else None
    }

@app.post("/admin/cleanup-bot-videos")
async def cleanup_bot_videos(
    username: str = "cleanupbot",
    days_old: int = 7,
    max_videos: int = 100,
    db: Session = Depends(get_db)
):
    """Delete old unwatched/unliked bot videos to keep content fresh. If username is 'all', cleanup all bot users."""
    from datetime import timedelta

    # Determine which users to clean up
    if username == "all":
        # Clean up all bot users
        bot_users = ["autobot", "techreviewer", "gamingpro", "foodiechef", "musiclover",
                     "sciencegeek", "fitnessguru", "naturewild", "outdoorexplorer",
                     "devopsguru", "aienthusiast", "politicsnow", "cryptofinance",
                     "photogeek", "mindfulzen", "newstoday", "diycrafter", "biztips",
                     "polyglot", "filmcritic", "truecrime", "stargazer", "podcastclips",
                     "latenightcomedy"]
    else:
        bot_users = [username]

    total_deleted = 0
    results = {}

    for bot_username in bot_users:
        # Get bot user
        bot_user = db.query(models.User).filter(models.User.username == bot_username).first()
        if not bot_user:
            results[bot_username] = {"status": "error", "message": "User not found"}
            continue

        # Find old bot videos (older than X days, no views or likes)
        cutoff_date = datetime.utcnow() - timedelta(days=days_old)

        old_videos = db.query(models.Video).filter(
            models.Video.owner_id == bot_user.id,
            models.Video.upload_date < cutoff_date,
            models.Video.views == 0,
            models.Video.likes == 0
        ).order_by(models.Video.upload_date.asc()).all()

        deleted_count = 0

        # Delete old unwatched videos
        for video in old_videos:
            if deleted_count >= max_videos:
                break

            # Delete thumbnail if exists
            if video.thumbnail_path and os.path.exists(f"/app{video.thumbnail_path}"):
                try:
                    os.remove(f"/app{video.thumbnail_path}")
                except:
                    pass

            db.delete(video)
            deleted_count += 1
            total_deleted += 1

        db.commit()

        # Get remaining video count for this user
        remaining_videos = db.query(models.Video).filter(
            models.Video.owner_id == bot_user.id
        ).count()

        results[bot_username] = {
            "deleted": deleted_count,
            "remaining": remaining_videos
        }

    return {
        "status": "success",
        "total_deleted": total_deleted,
        "users": results,
        "message": f"Deleted {total_deleted} old unwatched videos across {len(bot_users)} user(s)"
    }

@app.get("/videos", response_model=List[schemas.Video])
async def get_videos(
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional)
):
    # Only show completed videos on main feed (public access), sorted by newest first
    offset = (page - 1) * page_size
    videos = db.query(models.Video).filter(
        models.Video.processing_status == "completed"
    ).order_by(models.Video.upload_date.desc()).offset(offset).limit(page_size).all()
    # Populate owner info for each video
    for video in videos:
        if video.owner:
            video.owner.subscriber_count = len(video.owner.subscribers)
            video.owner.video_count = len(video.owner.videos)
    return videos

@app.get("/videos/count")
async def get_videos_count(db: Session = Depends(get_db)):
    """Get total count of completed videos for pagination"""
    count = db.query(models.Video).filter(
        models.Video.processing_status == "completed"
    ).count()
    return {"total": count}

@app.get("/videos/search", response_model=List[schemas.Video])
async def search_videos(
    q: str,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional)
):
    """Search videos by title, description, or tags"""
    if not q or not q.strip():
        raise HTTPException(status_code=400, detail="Search query is required")

    search_term = f"%{q.strip()}%"

    # Search in title, description, and tags
    offset = (page - 1) * page_size
    videos = db.query(models.Video).filter(
        models.Video.processing_status == "completed",
        or_(
            models.Video.title.ilike(search_term),
            models.Video.description.ilike(search_term),
            models.Video.tags.cast(String).ilike(search_term)
        )
    ).order_by(models.Video.upload_date.desc()).offset(offset).limit(page_size).all()

    # Populate owner info
    for video in videos:
        if video.owner:
            video.owner.subscriber_count = len(video.owner.subscribers)
            video.owner.video_count = len(video.owner.videos)

    return videos

@app.get("/videos/search/count")
async def get_search_count(
    q: str,
    db: Session = Depends(get_db)
):
    """Get count of search results"""
    if not q or not q.strip():
        return {"total": 0}

    search_term = f"%{q.strip()}%"

    count = db.query(models.Video).filter(
        models.Video.processing_status == "completed",
        or_(
            models.Video.title.ilike(search_term),
            models.Video.description.ilike(search_term),
            models.Video.tags.cast(String).ilike(search_term)
        )
    ).count()

    return {"total": count, "query": q.strip()}

@app.get("/videos/my-videos", response_model=List[schemas.Video])
async def get_my_videos(
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get all videos uploaded by the current user, including processing ones"""
    offset = (page - 1) * page_size
    videos = db.query(models.Video).filter(
        models.Video.owner_id == current_user.id
    ).order_by(models.Video.upload_date.desc()).offset(offset).limit(page_size).all()

    # Populate owner info for each video
    for video in videos:
        if video.owner:
            video.owner.subscriber_count = len(video.owner.subscribers)
            video.owner.video_count = len(video.owner.videos)

    return videos

@app.get("/videos/my-videos/count")
async def get_my_videos_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get total count of user's videos for pagination"""
    count = db.query(models.Video).filter(
        models.Video.owner_id == current_user.id
    ).count()
    return {"total": count}

@app.get("/videos/{video_id}/progress")
async def get_video_progress(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get processing progress for a video"""
    video = db.query(models.Video).filter(models.Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if video.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Try to get progress from video processor
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"http://video-processor:8002/progress/{video_id}")
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        print(f"Error fetching progress: {e}")

    # Return status-based estimate if no detailed progress available
    if video.processing_status == "completed":
        return {"video_id": video_id, "progress": 100, "status": "completed"}
    elif video.processing_status == "failed":
        return {"video_id": video_id, "progress": 0, "status": "failed"}
    else:
        return {"video_id": video_id, "progress": 0, "status": "processing"}

@app.patch("/videos/{video_id}/metadata")
async def update_video_metadata(
    video_id: int,
    metadata: schemas.VideoMetadataUpdate,
    db: Session = Depends(get_db)
):
    """Update video metadata (called by video processor)"""
    video = db.query(models.Video).filter(models.Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if metadata.thumbnail_path:
        video.thumbnail_path = metadata.thumbnail_path
    if metadata.hls_path:
        video.hls_path = metadata.hls_path
    if metadata.duration is not None:
        video.duration = metadata.duration
    if metadata.processing_status:
        video.processing_status = metadata.processing_status

    db.commit()
    db.refresh(video)
    return {"message": "Metadata updated successfully"}

@app.patch("/videos/{video_id}")
async def update_video(
    video_id: int,
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # Comma-separated tags
    thumbnail: Optional[UploadFile] = File(None),  # Optional new thumbnail
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update video title, description, tags, and thumbnail"""
    video = db.query(models.Video).filter(models.Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if video.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this video")

    if title is not None:
        video.title = title
    if description is not None:
        video.description = description
    if tags is not None:
        tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]
        video.tags = tag_list

    # Handle new thumbnail if provided
    if thumbnail:
        THUMBNAIL_DIR = "/app/thumbnails"
        os.makedirs(THUMBNAIL_DIR, exist_ok=True)
        thumbnail_filename = f"video_{video_id}_custom_thumb.jpg"
        thumbnail_location = os.path.join(THUMBNAIL_DIR, thumbnail_filename)
        with open(thumbnail_location, "wb") as buffer:
            shutil.copyfileobj(thumbnail.file, buffer)
        video.thumbnail_path = f"/thumbnails/{thumbnail_filename}"

    db.commit()
    db.refresh(video)

    # Populate owner info for response
    if video.owner:
        video.owner.subscriber_count = len(video.owner.subscribers)
        video.owner.video_count = len(video.owner.videos)

    return {"message": "Video updated successfully", "video": video, "thumbnail_path": video.thumbnail_path}

@app.delete("/videos/{video_id}")
async def delete_video(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Delete a video"""
    video = db.query(models.Video).filter(models.Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if video.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this video")

    # Delete files from filesystem
    try:
        if os.path.exists(video.file_path):
            os.remove(video.file_path)

        # Delete processed files
        processed_dir = f"/app/processed_videos/{video_id}"
        if os.path.exists(processed_dir):
            shutil.rmtree(processed_dir)
    except Exception as e:
        print(f"Error deleting files for video {video_id}: {e}")

    # Delete from database
    db.delete(video)
    db.commit()

    return {"message": "Video deleted successfully"}

@app.get("/videos/{video_id}/stream")
async def stream_video(video_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    video = db.query(models.Video).filter(models.Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # If HLS is available, return the HLS manifest path info
    # Otherwise, serve the raw uploaded file
    file_path = video.file_path
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Video file not found on server")

    return FileResponse(file_path, media_type="video/mp4")

@app.get("/processed/{video_id}/{filename}")
async def serve_processed_file(video_id: int, filename: str):
    """Serve processed video files (HLS segments, thumbnails) - No auth required for public access"""
    file_path = f"/app/processed_videos/{video_id}/{filename}"

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    # Determine media type based on extension
    if filename.endswith('.m3u8'):
        media_type = "application/vnd.apple.mpegurl"
    elif filename.endswith('.ts'):
        media_type = "video/MP2T"
    elif filename.endswith('.jpg') or filename.endswith('.jpeg'):
        media_type = "image/jpeg"
    else:
        media_type = "application/octet-stream"

    return FileResponse(file_path, media_type=media_type)

@app.get("/avatars/{filename}")
async def serve_avatar(filename: str):
    """Serve user avatar images - No auth required for public access"""
    file_path = f"/app/avatars/{filename}"

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Avatar not found")

    # Determine media type based on file extension
    import mimetypes
    media_type = mimetypes.guess_type(file_path)[0] or "image/jpeg"
    return FileResponse(file_path, media_type=media_type)

@app.get("/stream/proxy/{video_id}/playlist.m3u8")
async def stream_rtsp_proxy(video_id: int, db: Session = Depends(get_db)):
    """Proxy RTSP stream to HLS for browser playback"""
    import time

    video = db.query(models.Video).filter(models.Video.id == video_id).first()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if not video.is_live_stream or not video.stream_url:
        raise HTTPException(status_code=400, detail="Not a live stream")

    # For RTSP streams, we'll use FFmpeg to convert to HLS
    # Create a temporary HLS stream directory
    STREAM_DIR = f"/app/streams/{video_id}"
    os.makedirs(STREAM_DIR, exist_ok=True)

    playlist_path = os.path.join(STREAM_DIR, "playlist.m3u8")

    # Check if stream is already active
    if video_id in active_streams:
        # Update last access time
        active_streams[video_id]["last_access"] = time.time()

        # Stream is active, return playlist
        if os.path.exists(playlist_path):
            return FileResponse(playlist_path, media_type="application/vnd.apple.mpegurl")
        else:
            # Playlist missing, restart stream
            print(f"Playlist missing for video {video_id}, restarting stream...")
            active_streams.pop(video_id)

    # Clean up old stream files before starting new stream
    for file in os.listdir(STREAM_DIR):
        file_path = os.path.join(STREAM_DIR, file)
        try:
            if os.path.isfile(file_path):
                os.remove(file_path)
        except Exception as e:
            print(f"Error removing old stream file {file_path}: {e}")

    # Start FFmpeg in background to convert RTSP to HLS
    ffmpeg_cmd = [
        "ffmpeg",
        "-rtsp_transport", "tcp",  # Use TCP for more reliable RTSP
        "-i", video.stream_url,
        "-c:v", "copy",  # Copy video codec (no re-encoding for speed)
        "-c:a", "aac",   # Convert audio to AAC
        "-f", "hls",
        "-hls_time", "2",  # 2 second segments
        "-hls_list_size", "3",  # Keep last 3 segments (lower latency)
        "-hls_flags", "delete_segments+append_list",
        "-hls_segment_filename", os.path.join(STREAM_DIR, "segment_%d.ts"),
        "-hls_start_number_source", "epoch",  # Use epoch for segment numbering
        playlist_path
    ]

    # Start FFmpeg process in background
    print(f"Starting stream for video {video_id}")
    process = subprocess.Popen(ffmpeg_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Track this stream
    active_streams[video_id] = {
        "process": process,
        "last_access": time.time(),
        "viewers": 1
    }

    # Wait a moment for playlist to be created
    for _ in range(20):  # Wait up to 2 seconds
        if os.path.exists(playlist_path):
            break
        await asyncio.sleep(0.1)

    if not os.path.exists(playlist_path):
        # Clean up failed stream
        active_streams.pop(video_id, None)
        try:
            process.terminate()
        except:
            pass
        raise HTTPException(status_code=500, detail="Failed to start stream")

    return FileResponse(playlist_path, media_type="application/vnd.apple.mpegurl")

@app.get("/stream/proxy/{video_id}/{segment_file}")
async def stream_segment(video_id: int, segment_file: str):
    """Serve HLS segment files"""
    import time

    # Update last access time for this stream
    if video_id in active_streams:
        active_streams[video_id]["last_access"] = time.time()

    STREAM_DIR = f"/app/streams/{video_id}"
    segment_path = os.path.join(STREAM_DIR, segment_file)

    if not os.path.exists(segment_path):
        raise HTTPException(status_code=404, detail="Segment not found")

    return FileResponse(segment_path, media_type="video/mp2t")

@app.post("/videos/{video_id}/reprocess")
async def reprocess_video(video_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Manually trigger reprocessing of a video"""
    video = db.query(models.Video).filter(models.Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Trigger video processing
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://video-processor:8002/process-video",
                json={
                    "video_path": video.file_path,
                    "video_id": video.id
                }
            )
            response.raise_for_status()
            return {"message": f"Video ID {video_id} queued for reprocessing"}
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Error triggering video processor: {e}")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=500, detail=f"Video processor error: {e.response.status_code}")

@app.post("/videos/reprocess-all")
async def reprocess_all_videos(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Reprocess all videos that don't have thumbnails or HLS"""
    videos = db.query(models.Video).filter(
        (models.Video.thumbnail_path == None) | (models.Video.hls_path == None)
    ).all()

    if not videos:
        return {"message": "No videos need reprocessing"}

    processed_count = 0
    errors = []

    for video in videos:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "http://video-processor:8002/process-video",
                    json={
                        "video_path": video.file_path,
                        "video_id": video.id
                    }
                )
                response.raise_for_status()
                processed_count += 1
        except Exception as e:
            errors.append(f"Video ID {video.id}: {str(e)}")

    return {
        "message": f"Queued {processed_count} videos for reprocessing",
        "errors": errors if errors else None
    }

# Channel/Profile endpoints
@app.get("/users/{user_id}/profile", response_model=schemas.UserProfile)
async def get_user_profile(user_id: int, db: Session = Depends(get_db)):
    """Get a user's public channel profile"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    subscriber_count = len(user.subscribers)
    video_count = len(user.videos)

    return schemas.UserProfile(
        id=user.id,
        username=user.username,
        channel_name=user.channel_name,
        channel_description=user.channel_description,
        avatar_url=user.avatar_url,
        banner_url=user.banner_url,
        subscriber_count=subscriber_count,
        video_count=video_count
    )

@app.get("/users/{user_id}/videos", response_model=List[schemas.Video])
async def get_user_videos(user_id: int, db: Session = Depends(get_db)):
    """Get all videos uploaded by a specific user"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    videos = db.query(models.Video).filter(models.Video.owner_id == user_id).all()

    # Populate owner info for each video
    for video in videos:
        if video.owner:
            video.owner.subscriber_count = len(video.owner.subscribers)
            video.owner.video_count = len(video.owner.videos)

    return videos

@app.patch("/users/me/profile", response_model=schemas.User)
async def update_my_profile(
    channel_name: Optional[str] = Form(None),
    channel_description: Optional[str] = Form(None),
    avatar: Optional[UploadFile] = File(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update the current user's channel profile"""
    if channel_name is not None:
        current_user.channel_name = channel_name
    if channel_description is not None:
        current_user.channel_description = channel_description

    # Handle avatar upload
    if avatar:
        AVATARS_DIR = "/app/avatars"
        os.makedirs(AVATARS_DIR, exist_ok=True)

        # Delete old avatar if exists
        if current_user.avatar_url:
            old_avatar_path = current_user.avatar_url.replace("/avatars/", "")
            old_avatar_full_path = os.path.join(AVATARS_DIR, old_avatar_path)
            if os.path.exists(old_avatar_full_path):
                os.remove(old_avatar_full_path)

        # Save new avatar
        avatar_filename = f"user_{current_user.id}_{avatar.filename}"
        avatar_path = os.path.join(AVATARS_DIR, avatar_filename)
        with open(avatar_path, "wb") as buffer:
            shutil.copyfileobj(avatar.file, buffer)

        current_user.avatar_url = f"/avatars/{avatar_filename}"

    db.commit()
    db.refresh(current_user)
    return current_user

# Subscription endpoints
@app.post("/users/{user_id}/subscribe")
async def subscribe_to_user(
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Subscribe to a user's channel"""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot subscribe to yourself")

    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if already subscribed
    if target_user in current_user.subscriptions:
        raise HTTPException(status_code=400, detail="Already subscribed to this user")

    current_user.subscriptions.append(target_user)
    db.commit()

    return {"message": f"Successfully subscribed to {target_user.username}"}

@app.delete("/users/{user_id}/unsubscribe")
async def unsubscribe_from_user(
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Unsubscribe from a user's channel"""
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if subscribed
    if target_user not in current_user.subscriptions:
        raise HTTPException(status_code=400, detail="Not subscribed to this user")

    current_user.subscriptions.remove(target_user)
    db.commit()

    return {"message": f"Successfully unsubscribed from {target_user.username}"}

@app.get("/users/{user_id}/is-subscribed")
async def check_subscription(
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if current user is subscribed to a specific user"""
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    is_subscribed = target_user in current_user.subscriptions
    return {"is_subscribed": is_subscribed}

@app.get("/users/me/subscriptions", response_model=List[schemas.UserProfile])
async def get_my_subscriptions(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of channels the current user is subscribed to"""
    subscriptions = []
    for user in current_user.subscriptions:
        subscriptions.append(schemas.UserProfile(
            id=user.id,
            username=user.username,
            channel_name=user.channel_name,
            channel_description=user.channel_description,
            avatar_url=user.avatar_url,
            banner_url=user.banner_url,
            subscriber_count=len(user.subscribers),
            video_count=len(user.videos)
        ))
    return subscriptions

# View tracking
@app.post("/videos/{video_id}/view")
async def increment_video_view(video_id: int, db: Session = Depends(get_db)):
    """Increment view count for a video"""
    video = db.query(models.Video).filter(models.Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    video.views += 1
    db.commit()

    return {"views": video.views}

# Like/Dislike system
@app.post("/videos/{video_id}/like")
async def like_video(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Like a video (or remove like if already liked)"""
    video = db.query(models.Video).filter(models.Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Check if user already liked/disliked this video
    existing = db.query(models.VideoLike).filter(
        models.VideoLike.video_id == video_id,
        models.VideoLike.user_id == current_user.id
    ).first()

    if existing:
        if existing.is_like:
            # Remove like
            db.delete(existing)
            video.likes -= 1
            db.commit()
            return {"action": "removed", "likes": video.likes, "dislikes": video.dislikes}
        else:
            # Change from dislike to like
            existing.is_like = True
            video.dislikes -= 1
            video.likes += 1
            db.commit()
            return {"action": "liked", "likes": video.likes, "dislikes": video.dislikes}
    else:
        # Add new like
        new_like = models.VideoLike(
            user_id=current_user.id,
            video_id=video_id,
            is_like=True
        )
        db.add(new_like)
        video.likes += 1
        db.commit()
        return {"action": "liked", "likes": video.likes, "dislikes": video.dislikes}

@app.post("/videos/{video_id}/dislike")
async def dislike_video(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Dislike a video (or remove dislike if already disliked)"""
    video = db.query(models.Video).filter(models.Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Check if user already liked/disliked this video
    existing = db.query(models.VideoLike).filter(
        models.VideoLike.video_id == video_id,
        models.VideoLike.user_id == current_user.id
    ).first()

    if existing:
        if not existing.is_like:
            # Remove dislike
            db.delete(existing)
            video.dislikes -= 1
            db.commit()
            return {"action": "removed", "likes": video.likes, "dislikes": video.dislikes}
        else:
            # Change from like to dislike
            existing.is_like = False
            video.likes -= 1
            video.dislikes += 1
            db.commit()
            return {"action": "disliked", "likes": video.likes, "dislikes": video.dislikes}
    else:
        # Add new dislike
        new_dislike = models.VideoLike(
            user_id=current_user.id,
            video_id=video_id,
            is_like=False
        )
        db.add(new_dislike)
        video.dislikes += 1
        db.commit()
        return {"action": "disliked", "likes": video.likes, "dislikes": video.dislikes}

@app.get("/videos/{video_id}/like-status")
async def get_like_status(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get current user's like/dislike status for a video"""
    existing = db.query(models.VideoLike).filter(
        models.VideoLike.video_id == video_id,
        models.VideoLike.user_id == current_user.id
    ).first()

    if existing:
        return {"status": "liked" if existing.is_like else "disliked"}
    return {"status": "none"}

# Recommendation and feed endpoints
@app.get("/videos/trending", response_model=List[schemas.Video])
async def get_trending_videos(
    time_period: Optional[str] = None,  # "week", "month", or None (all time)
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional)
):
    """Get trending videos with weighted algorithm (views + likes + recency)"""
    from datetime import datetime, timedelta
    from sqlalchemy import case

    # Base query
    query = db.query(models.Video).filter(
        models.Video.processing_status == "completed"
    )

    # Apply time filter if specified
    if time_period == "week":
        cutoff_date = datetime.utcnow() - timedelta(days=7)
        query = query.filter(models.Video.upload_date >= cutoff_date)
    elif time_period == "month":
        cutoff_date = datetime.utcnow() - timedelta(days=30)
        query = query.filter(models.Video.upload_date >= cutoff_date)

    # Calculate trending score:
    # Score = views * 1 + likes * 5 + (like_ratio * 10) - (days_old * 0.1)
    # Like ratio = likes / (likes + dislikes) if total > 0, else 0.5
    # This weights: views (1x), likes (5x), engagement quality (10x), and recency
    now = func.now()
    days_old = func.extract('epoch', now - models.Video.upload_date) / 86400.0
    total_reactions = models.Video.likes + models.Video.dislikes
    like_ratio = case(
        (total_reactions > 0, models.Video.likes * 1.0 / total_reactions),
        else_=0.5
    )

    trending_score = (
        models.Video.views * 1.0 +
        models.Video.likes * 5.0 +
        like_ratio * 10.0 -
        days_old * 0.1
    )

    offset = (page - 1) * page_size
    videos = query.order_by(trending_score.desc()).offset(offset).limit(page_size).all()

    # Populate owner info
    for video in videos:
        if video.owner:
            video.owner.subscriber_count = len(video.owner.subscribers)
            video.owner.video_count = len(video.owner.videos)

    return videos

@app.get("/videos/trending/count")
async def get_trending_count(
    time_period: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get count of trending videos for pagination"""
    from datetime import datetime, timedelta

    query = db.query(models.Video).filter(
        models.Video.processing_status == "completed"
    )

    if time_period == "week":
        cutoff_date = datetime.utcnow() - timedelta(days=7)
        query = query.filter(models.Video.upload_date >= cutoff_date)
    elif time_period == "month":
        cutoff_date = datetime.utcnow() - timedelta(days=30)
        query = query.filter(models.Video.upload_date >= cutoff_date)

    count = query.count()
    return {"total": count}

@app.get("/videos/subscriptions-feed", response_model=List[schemas.Video])
async def get_subscriptions_feed(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get videos from subscribed channels"""
    # Get IDs of users current user is subscribed to
    subscribed_user_ids = [user.id for user in current_user.subscriptions]

    if not subscribed_user_ids:
        return []

    # Get videos from subscribed users
    videos = db.query(models.Video).filter(
        models.Video.owner_id.in_(subscribed_user_ids),
        models.Video.processing_status == "completed"
    ).order_by(models.Video.upload_date.desc()).all()

    # Populate owner info
    for video in videos:
        if video.owner:
            video.owner.subscriber_count = len(video.owner.subscribers)
            video.owner.video_count = len(video.owner.videos)

    return videos

@app.get("/videos/{video_id}/similar", response_model=List[schemas.Video])
async def get_similar_videos(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional)
):
    """Get similar videos based on shared tags and same channel"""
    from sqlalchemy import and_, or_

    # Get the current video
    current_video = db.query(models.Video).filter(models.Video.id == video_id).first()
    if not current_video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Get all completed videos except the current one
    all_videos = db.query(models.Video).filter(
        and_(
            models.Video.processing_status == "completed",
            models.Video.id != video_id
        )
    ).all()

    # Score videos by similarity
    scored_videos = []
    for video in all_videos:
        score = 0

        # Same channel bonus (very high weight)
        if video.owner_id == current_video.owner_id:
            score += 50

        # Shared tags (high weight)
        if current_video.tags and video.tags:
            shared_tags = set(current_video.tags) & set(video.tags)
            score += len(shared_tags) * 10

        # Recent videos get slight boost
        days_old = (func.now() - video.upload_date).total_seconds() / 86400.0
        if days_old < 7:
            score += 5
        elif days_old < 30:
            score += 2

        # Popular videos get boost
        score += video.likes * 0.5
        score += video.views * 0.01

        if score > 0:
            scored_videos.append((score, video))

    # Sort by score and get top 10
    scored_videos.sort(key=lambda x: x[0], reverse=True)
    similar_videos = [video for score, video in scored_videos[:10]]

    # Populate owner info
    for video in similar_videos:
        if video.owner:
            video.owner.subscriber_count = len(video.owner.subscribers)
            video.owner.video_count = len(video.owner.videos)

    return similar_videos

@app.get("/videos/popular-tags")
async def get_popular_tags(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional)
):
    """Get most popular tags based on video count"""
    # Get all videos with tags
    videos = db.query(models.Video).filter(
        and_(
            models.Video.processing_status == "completed",
            models.Video.tags.isnot(None)
        )
    ).all()

    # Count tag occurrences
    tag_counts = {}
    for video in videos:
        if video.tags:
            for tag in video.tags:
                tag = tag.strip().lower()
                if tag:
                    tag_counts[tag] = tag_counts.get(tag, 0) + 1

    # Sort by count and return top tags
    sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)
    return [{"tag": tag, "count": count} for tag, count in sorted_tags[:limit]]

@app.get("/videos/{video_id}", response_model=schemas.Video)
async def get_video(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional)
):
    """Get a specific video by ID"""
    video = db.query(models.Video).filter(models.Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Populate owner info
    if video.owner:
        video.owner.subscriber_count = len(video.owner.subscribers)
        video.owner.video_count = len(video.owner.videos)

    return video

# Playlist endpoints
@app.post("/playlists", response_model=schemas.Playlist)
async def create_playlist(
    playlist: schemas.PlaylistCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create a new playlist"""
    db_playlist = models.Playlist(
        name=playlist.name,
        description=playlist.description,
        is_public=playlist.is_public,
        owner_id=current_user.id
    )
    db.add(db_playlist)
    db.commit()
    db.refresh(db_playlist)
    db_playlist.video_count = 0
    return db_playlist

@app.get("/playlists", response_model=List[schemas.Playlist])
async def get_playlists(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get all playlists (public + user's private ones)"""
    playlists = db.query(models.Playlist).filter(
        or_(
            models.Playlist.is_public == True,
            models.Playlist.owner_id == current_user.id
        )
    ).all()

    # Add video count to each playlist
    for playlist in playlists:
        playlist.video_count = db.query(models.playlist_videos).filter(
            models.playlist_videos.c.playlist_id == playlist.id
        ).count()

    return playlists

@app.get("/playlists/my-playlists", response_model=List[schemas.Playlist])
async def get_my_playlists(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get current user's playlists"""
    playlists = db.query(models.Playlist).filter(
        models.Playlist.owner_id == current_user.id
    ).all()

    # Add video count to each playlist
    for playlist in playlists:
        playlist.video_count = db.query(models.playlist_videos).filter(
            models.playlist_videos.c.playlist_id == playlist.id
        ).count()

    return playlists

@app.get("/playlists/{playlist_id}", response_model=schemas.PlaylistWithVideos)
async def get_playlist(
    playlist_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get a specific playlist with its videos"""
    playlist = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    # Check access rights
    if not playlist.is_public and playlist.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get playlist videos in order
    playlist_video_records = db.query(models.playlist_videos).filter(
        models.playlist_videos.c.playlist_id == playlist_id
    ).order_by(models.playlist_videos.c.position).all()

    video_ids = [record.video_id for record in playlist_video_records]
    videos = []
    for video_id in video_ids:
        video = db.query(models.Video).filter(models.Video.id == video_id).first()
        if video and video.processing_status == "completed":
            if video.owner:
                video.owner.subscriber_count = len(video.owner.subscribers)
                video.owner.video_count = len(video.owner.videos)
            videos.append(video)

    playlist.videos = videos
    playlist.video_count = len(videos)
    return playlist

@app.patch("/playlists/{playlist_id}", response_model=schemas.Playlist)
async def update_playlist(
    playlist_id: int,
    playlist_update: schemas.PlaylistUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update playlist metadata"""
    playlist = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    if playlist.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if playlist_update.name is not None:
        playlist.name = playlist_update.name
    if playlist_update.description is not None:
        playlist.description = playlist_update.description
    if playlist_update.is_public is not None:
        playlist.is_public = playlist_update.is_public

    db.commit()
    db.refresh(playlist)

    playlist.video_count = db.query(models.playlist_videos).filter(
        models.playlist_videos.c.playlist_id == playlist.id
    ).count()

    return playlist

@app.delete("/playlists/{playlist_id}")
async def delete_playlist(
    playlist_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Delete a playlist"""
    playlist = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    if playlist.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Delete playlist-video associations first
    db.query(models.playlist_videos).filter(
        models.playlist_videos.c.playlist_id == playlist_id
    ).delete(synchronize_session=False)

    db.delete(playlist)
    db.commit()
    return {"message": "Playlist deleted successfully"}

@app.post("/playlists/{playlist_id}/videos/{video_id}")
async def add_video_to_playlist(
    playlist_id: int,
    video_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Add a video to a playlist"""
    playlist = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    if playlist.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    video = db.query(models.Video).filter(models.Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Check if video already in playlist
    existing = db.query(models.playlist_videos).filter(
        and_(
            models.playlist_videos.c.playlist_id == playlist_id,
            models.playlist_videos.c.video_id == video_id
        )
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Video already in playlist")

    # Get next position
    max_position = db.query(func.max(models.playlist_videos.c.position)).filter(
        models.playlist_videos.c.playlist_id == playlist_id
    ).scalar()
    next_position = (max_position or -1) + 1

    # Insert into playlist_videos
    db.execute(
        models.playlist_videos.insert().values(
            playlist_id=playlist_id,
            video_id=video_id,
            position=next_position
        )
    )
    db.commit()

    return {"message": "Video added to playlist"}

@app.delete("/playlists/{playlist_id}/videos/{video_id}")
async def remove_video_from_playlist(
    playlist_id: int,
    video_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Remove a video from a playlist"""
    playlist = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    if playlist.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Delete the association
    result = db.query(models.playlist_videos).filter(
        and_(
            models.playlist_videos.c.playlist_id == playlist_id,
            models.playlist_videos.c.video_id == video_id
        )
    ).delete(synchronize_session=False)

    if result == 0:
        raise HTTPException(status_code=404, detail="Video not in playlist")

    # Reorder remaining videos
    remaining_videos = db.query(models.playlist_videos).filter(
        models.playlist_videos.c.playlist_id == playlist_id
    ).order_by(models.playlist_videos.c.position).all()

    for idx, record in enumerate(remaining_videos):
        db.execute(
            models.playlist_videos.update().where(
                and_(
                    models.playlist_videos.c.playlist_id == playlist_id,
                    models.playlist_videos.c.video_id == record.video_id
                )
            ).values(position=idx)
        )

    db.commit()
    return {"message": "Video removed from playlist"}

@app.post("/videos/{video_id}/retry-processing")
async def retry_video_processing(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Manually retry processing for a failed or stuck video"""
    video = db.query(models.Video).filter(models.Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if video.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if video.processing_status == "completed":
        raise HTTPException(status_code=400, detail="Video already processed successfully")

    # Reset status and retry processing
    video.processing_status = "processing"
    db.commit()

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://video-processor:8002/process-video",
                json={
                    "video_path": video.file_path,
                    "video_id": video.id,
                    "skip_thumbnail": video.thumbnail_path is not None,
                    "delete_original": True
                }
            )
            response.raise_for_status()
            print(f"Retry processing triggered for video ID {video.id}")
    except Exception as e:
        print(f"Error retrying video processor for video ID {video.id}: {e}")
        video.processing_status = "failed"
        db.commit()
        raise HTTPException(status_code=500, detail="Failed to start processing")

    return {"message": "Processing restarted", "video_id": video_id}
