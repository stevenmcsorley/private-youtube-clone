import os
import subprocess
import json
import httpx
import re
import redis
from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel

app = FastAPI()

# Redis connection for persistent progress tracking
redis_client = redis.Redis(host=os.getenv('REDIS_URL', 'redis://redis:6379').replace('redis://', '').split(':')[0],
                           port=int(os.getenv('REDIS_URL', 'redis://redis:6379').replace('redis://', '').split(':')[1] if ':' in os.getenv('REDIS_URL', 'redis://redis:6379').replace('redis://', '') else 6379),
                           decode_responses=True)

def set_progress(video_id: int, progress: int, status: str = "processing"):
    """Store progress in Redis"""
    redis_client.setex(f"video_progress:{video_id}", 3600, json.dumps({"progress": progress, "status": status}))

def get_progress(video_id: int):
    """Get progress from Redis"""
    data = redis_client.get(f"video_progress:{video_id}")
    if data:
        return json.loads(data)
    return {"progress": 0, "status": "unknown"}

class VideoProcessRequest(BaseModel):
    video_path: str
    video_id: int
    skip_thumbnail: bool = False
    delete_original: bool = True  # Delete original after successful processing

def get_video_metadata(video_path: str) -> dict:
    """Extract video metadata using ffprobe"""
    try:
        result = subprocess.run([
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration:format_tags=title,comment,description",
            "-of", "json",
            video_path
        ], capture_output=True, text=True, check=True)

        data = json.loads(result.stdout)

        # Extract duration
        duration = int(float(data.get('format', {}).get('duration', 0)))

        # Extract metadata tags
        tags = data.get('format', {}).get('tags', {})
        title = tags.get('title', '')
        description = tags.get('comment', '') or tags.get('description', '')

        return {
            'duration': duration,
            'title': title,
            'description': description
        }
    except (subprocess.CalledProcessError, KeyError, ValueError) as e:
        print(f"Error extracting metadata: {e}")
        return {'duration': 0, 'title': '', 'description': ''}

@app.post("/extract-metadata")
async def extract_metadata_endpoint(video_path: str):
    """Extract metadata from a video file for auto-populating title/description"""
    metadata = get_video_metadata(video_path)
    return metadata

@app.get("/progress/{video_id}")
async def get_progress_endpoint(video_id: int):
    """Get processing progress for a video"""
    progress_data = get_progress(video_id)
    return {"video_id": video_id, **progress_data}

@app.post("/process-video")
async def process_video_endpoint(request: VideoProcessRequest, background_tasks: BackgroundTasks):
    print(f"Received request to process video: {request.video_path} (ID: {request.video_id})")
    background_tasks.add_task(
        process_video_task,
        request.video_path,
        request.video_id,
        request.skip_thumbnail,
        request.delete_original
    )
    return {"message": "Video processing started in background"}

async def update_video_metadata(video_id: int, thumbnail_path: str, hls_path: str, duration: int, status: str = "completed"):
    """Update video metadata in the backend database"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"http://backend:8000/videos/{video_id}/metadata",
                json={
                    "thumbnail_path": thumbnail_path,
                    "hls_path": hls_path,
                    "duration": duration,
                    "processing_status": status
                }
            )
            if response.status_code == 200:
                print(f"Successfully updated metadata for video ID {video_id}")
            else:
                print(f"Failed to update metadata for video ID {video_id}: {response.status_code}")
    except Exception as e:
        print(f"Error updating metadata for video ID {video_id}: {e}")

def process_video_task(video_path: str, video_id: int, skip_thumbnail: bool = False, delete_original: bool = True):
    print(f"Starting background processing for video: {video_path} (ID: {video_id})")

    # Initialize progress in Redis
    set_progress(video_id, 0, "processing")

    UPLOAD_DIR = "/app/uploads"
    PROCESSED_DIR = "/app/processed_videos"
    os.makedirs(PROCESSED_DIR, exist_ok=True)

    video_path = os.path.join(UPLOAD_DIR, video_path)
    base_name = os.path.basename(video_path)
    name_without_ext = os.path.splitext(base_name)[0]

    output_dir = os.path.join(PROCESSED_DIR, str(video_id))
    os.makedirs(output_dir, exist_ok=True)

    # Extract video metadata
    set_progress(video_id, 5)
    metadata = get_video_metadata(video_path)
    duration = metadata['duration']

    # --- FFmpeg commands ---
    # 1. Transcode to HLS (Adaptive Bitrate Streaming)
    set_progress(video_id, 10)
    hls_output_path = os.path.join(output_dir, f"{name_without_ext}.m3u8")
    cmd = [
            "ffmpeg",
            "-y", # Overwrite existing files
            "-i", video_path,
            # Scale to 720p max, force even dimensions (divisible by 2 for H.264)
            "-vf", "scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2",
            "-c:a", "aac", "-ar", "48000", "-b:a", "128k",
            "-c:v", "h264", "-profile:v", "main", "-crf", "20", "-g", "48", "-keyint_min", "48",
            "-sc_threshold", "0", "-b:v", "2500k", "-maxrate", "2675k", "-bufsize", "3750k",
            "-hls_time", "10", "-hls_playlist_type", "vod",
            "-hls_segment_filename", os.path.join(output_dir, f"{name_without_ext}_%03d.ts"),
            "-progress", "pipe:1",  # Output progress to stdout
            hls_output_path
        ]
    try:
        print(f"Executing ffmpeg command: {' '.join(cmd)}")
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)

        # Parse FFmpeg progress output (FFmpeg writes progress to stderr which we redirect to stdout)
        for line in process.stdout:
            if 'out_time_ms=' in line:
                try:
                    # Extract time in microseconds
                    time_str = line.split('out_time_ms=')[1].split()[0]
                    time_ms = int(time_str)
                    time_s = time_ms / 1000000
                    if duration > 0:
                        # Progress from 10% to 80% during HLS encoding
                        progress = min(10 + int((time_s / duration) * 70), 80)
                        set_progress(video_id, progress)
                        print(f"Progress: {progress}% ({time_s:.1f}s / {duration}s)")
                except (ValueError, IndexError) as e:
                    pass  # Skip malformed progress lines

        process.wait()
        if process.returncode != 0:
            raise subprocess.CalledProcessError(process.returncode, cmd)

        set_progress(video_id, 80)
        print(f"HLS transcoding complete for video ID {video_id}")
    except subprocess.CalledProcessError as e:
        print(f"Error during HLS transcoding for video ID {video_id}: {e}")
        set_progress(video_id, 0, "failed")
        # Update database to mark as failed
        import asyncio
        asyncio.run(update_video_metadata(video_id, None, None, 0, status="failed"))
        return

    # 2. Generate a thumbnail (only if not skipped)
    relative_thumbnail_path = None
    if not skip_thumbnail:
        set_progress(video_id, 85)
        thumbnail_path = os.path.join(output_dir, f"{name_without_ext}.jpg")
        try:
            subprocess.run([
                "ffmpeg",
                "-y", # Overwrite existing files
                "-i", video_path,
                "-ss", "00:00:01", # Take thumbnail at 1 second mark
                "-vframes", "1",
                thumbnail_path
            ], check=True)
            print(f"Thumbnail generated for video ID {video_id}")
            relative_thumbnail_path = f"/processed/{video_id}/{os.path.basename(thumbnail_path)}"
            set_progress(video_id, 90)
        except subprocess.CalledProcessError as e:
            print(f"Error during thumbnail generation for video ID {video_id}: {e}")
            # Continue processing even if thumbnail fails
    else:
        print(f"Skipping thumbnail generation for video ID {video_id} (custom thumbnail provided)")
        set_progress(video_id, 90)

    # Update video metadata in the database
    set_progress(video_id, 95)
    relative_hls_path = f"/processed/{video_id}/{os.path.basename(hls_output_path)}"

    import asyncio
    asyncio.run(update_video_metadata(video_id, relative_thumbnail_path, relative_hls_path, duration))

    # Delete original video file if requested (to save storage space)
    if delete_original:
        try:
            if os.path.exists(video_path):
                os.remove(video_path)
                print(f"Deleted original video file: {video_path}")
        except Exception as e:
            print(f"Error deleting original video file {video_path}: {e}")

    # Mark as completed
    set_progress(video_id, 100, "completed")
    print(f"Finished background processing for video ID {video_id}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002) # Using port 8002 for video-processor