#!/usr/bin/env python3
import asyncio
import httpx
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os

# Database connection
DATABASE_URL = "postgresql://vidstream_user:vidstream_password@database:5432/vidstream_db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

async def reprocess_all():
    db = SessionLocal()

    # Get all videos
    videos = db.execute(text("SELECT id, file_path FROM videos WHERE thumbnail_path IS NULL OR hls_path IS NULL")).fetchall()

    print(f"Found {len(videos)} videos to reprocess")

    for video in videos:
        video_id, file_path = video
        print(f"Processing video ID {video_id}: {file_path}")

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "http://video-processor:8002/process-video",
                    json={
                        "video_path": os.path.basename(file_path),
                        "video_id": video_id
                    }
                )
                if response.status_code == 200:
                    print(f"  ✓ Video ID {video_id} queued for processing")
                else:
                    print(f"  ✗ Failed: {response.status_code}")
        except Exception as e:
            print(f"  ✗ Error: {e}")

    db.close()

if __name__ == "__main__":
    asyncio.run(reprocess_all())
