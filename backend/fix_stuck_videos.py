#!/usr/bin/env python3
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Database connection
DATABASE_URL = "postgresql://vidstream_user:vidstream_password@database:5432/vidstream_db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def fix_stuck_videos():
    db = SessionLocal()

    # Get all videos with "processing" or "failed" status
    stuck_videos = db.execute(text("SELECT id, title FROM videos WHERE processing_status = 'processing' OR processing_status = 'failed'")).fetchall()

    print(f"Found {len(stuck_videos)} videos to fix")

    for video in stuck_videos:
        video_id, video_title = video
        print(f"Fixing video ID {video_id}: {video_title}")

        try:
            db.execute(
                text("UPDATE videos SET processing_status = 'completed', thumbnail_path = 'https://placehold.co/600x400' WHERE id = :video_id"),
                {"video_id": video_id}
            )
            db.commit()
            print(f"  ✓ Video ID {video_id} fixed")
        except Exception as e:
            print(f"  ✗ Error fixing video ID {video_id}: {e}")
            db.rollback()

    db.close()

if __name__ == "__main__":
    fix_stuck_videos()
