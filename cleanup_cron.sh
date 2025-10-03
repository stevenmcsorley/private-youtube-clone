#!/bin/bash

# Cleanup Cron Script for VidStream
# Removes old, unwatched bot videos to keep content fresh
# Runs daily to clean up videos older than 7 days with 0 views/likes

echo "$(date): Starting cleanup of old bot videos..."

# Clean up all bot users at once
curl -X POST "http://192.168.1.198:8001/admin/cleanup-bot-videos" \
  -H "Content-Type: application/json" \
  -d '{"username": "all", "days_old": 7, "max_videos": 50}'

echo ""
echo "$(date): Cleanup completed"
