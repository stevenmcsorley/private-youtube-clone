#!/bin/bash
# Auto-import YouTube videos and cleanup old unwatched videos cron job
# Add to crontab: 0 */6 * * * /home/smcso/vid_stream/auto_import_cron.sh

# Change to the project directory
cd /home/smcso/vid_stream

echo "=== Starting auto-import at $(date) ===" >> /home/smcso/vid_stream/auto_import.log

# Call the auto-import endpoint (2 videos per category, 16 total)
curl -X POST http://localhost:8001/admin/auto-import-youtube \
  -H "Content-Type: application/json" \
  >> /home/smcso/vid_stream/auto_import.log 2>&1

echo "Import completed, starting cleanup..." >> /home/smcso/vid_stream/auto_import.log

# Cleanup old unwatched autobot videos (older than 7 days, max 100)
curl -X POST "http://localhost:8001/admin/cleanup-autobot-videos?days_old=7&max_videos=100" \
  >> /home/smcso/vid_stream/auto_import.log 2>&1

echo "=== Completed at $(date) ===" >> /home/smcso/vid_stream/auto_import.log
echo "" >> /home/smcso/vid_stream/auto_import.log
