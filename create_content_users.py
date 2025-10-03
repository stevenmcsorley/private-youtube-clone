#!/usr/bin/env python3
"""
Script to create content creator bot accounts
Run this from the backend directory: python3 ../create_content_users.py
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app.database import SessionLocal
from backend.app.models import User
from backend.app.security import get_password_hash

# Content creator accounts with their specialties
CONTENT_CREATORS = [
    {
        "username": "techreviewer",
        "email": "tech@vidstream.local",
        "password": "tech2024!",
        "channel_name": "Tech Review Central",
        "channel_description": "Latest technology reviews and news",
        "categories": ["technology news today", "gadget review 2024", "tech unboxing", "AI artificial intelligence explained"]
    },
    {
        "username": "gamingpro",
        "email": "gaming@vidstream.local",
        "password": "game2024!",
        "channel_name": "Gaming Pro Network",
        "channel_description": "Gaming highlights, reviews, and esports",
        "categories": ["gaming highlights 2024", "game review", "esports tournament", "speedrun gameplay"]
    },
    {
        "username": "foodiechef",
        "email": "food@vidstream.local",
        "password": "food2024!",
        "channel_name": "Foodie Chef Kitchen",
        "channel_description": "Cooking tutorials and food reviews",
        "categories": ["cooking tutorial easy", "baking recipe", "chef cooking tips", "vegan recipe"]
    },
    {
        "username": "musiclover",
        "email": "music@vidstream.local",
        "password": "music2024!",
        "channel_name": "Music Lover Studio",
        "channel_description": "Music videos, covers, and tutorials",
        "categories": ["music video 2024", "live concert performance", "guitar tutorial", "cover songs"]
    },
    {
        "username": "sciencegeek",
        "email": "science@vidstream.local",
        "password": "science2024!",
        "channel_name": "Science Geek Lab",
        "channel_description": "Science experiments and educational content",
        "categories": ["science experiments", "space exploration documentary", "history documentary", "math explained simply"]
    },
    {
        "username": "fitnessguru",
        "email": "fitness@vidstream.local",
        "password": "fitness2024!",
        "channel_name": "Fitness Guru Hub",
        "channel_description": "Workout routines and fitness motivation",
        "categories": ["fitness workout routine", "yoga for beginners", "workout motivation", "martial arts training"]
    },
    {
        "username": "naturewild",
        "email": "nature@vidstream.local",
        "password": "nature2024!",
        "channel_name": "Nature & Wildlife",
        "channel_description": "Wildlife documentaries and nature photography",
        "categories": ["wildlife documentary", "cute animals compilation", "nature photography", "ocean life documentary"]
    },
    {
        "username": "autochannel",
        "email": "auto@vidstream.local",
        "password": "auto2024!",
        "channel_name": "Auto Channel Reviews",
        "channel_description": "Car and vehicle reviews",
        "categories": ["car review 2024", "electric vehicle", "classic car restoration", "motorcycle review"]
    },
    {
        "username": "cleanupbot",
        "email": "cleanup@vidstream.local",
        "password": "cleanup2024!",
        "channel_name": "System Cleanup",
        "channel_description": "Automated cleanup service",
        "categories": []  # This user only does cleanup, no content
    }
]

def create_users():
    db = SessionLocal()
    created_users = []

    try:
        for creator in CONTENT_CREATORS:
            # Check if user already exists
            existing = db.query(User).filter(User.username == creator["username"]).first()
            if existing:
                print(f"User '{creator['username']}' already exists, skipping...")
                continue

            # Create new user
            new_user = User(
                username=creator["username"],
                email=creator["email"],
                hashed_password=get_password_hash(creator["password"]),
                channel_name=creator["channel_name"],
                channel_description=creator["channel_description"],
                is_active=True
            )
            db.add(new_user)
            created_users.append(creator["username"])
            print(f"✓ Created user: {creator['username']} ({creator['channel_name']})")

        db.commit()
        print(f"\n✓ Successfully created {len(created_users)} users")

    except Exception as e:
        print(f"✗ Error creating users: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("Creating content creator bot accounts...\n")
    create_users()
    print("\nDone!")
