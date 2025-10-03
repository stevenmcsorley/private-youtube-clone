#!/usr/bin/env python3
from app.database import SessionLocal
from app.models import Video

def get_video_path():
    db = SessionLocal()
    video = db.query(Video).filter(Video.id == 14).first()
    if video:
        print(video.file_path)
    db.close()

if __name__ == "__main__":
    get_video_path()
