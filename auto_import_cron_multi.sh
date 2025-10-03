#!/bin/bash

# Multi-User Auto-Import Cron Script for VidStream
# This script triggers YouTube video imports for different bot users at different times
# Runs every 2 hours for better distribution

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Determine which user to run based on hour of day
HOUR=$(date +%H)
USERNAME=""
CATEGORIES=""

# Schedule different users throughout the day (hourly)
case $HOUR in
    # 00:00 - Tech Reviewer
    00)
        USERNAME="techreviewer"
        CATEGORIES='["technology news today", "gadget review 2024", "tech unboxing", "programming tutorial"]'
        ;;

    # 01:00 - Crypto Finance
    01)
        USERNAME="cryptofinance"
        CATEGORIES='["cryptocurrency news", "bitcoin trading", "blockchain tutorial", "crypto investing"]'
        ;;

    # 02:00 - DevOps Guru
    02)
        USERNAME="devopsguru"
        CATEGORIES='["devops tutorial", "kubernetes tutorial", "docker tutorial", "CI CD pipeline"]'
        ;;

    # 03:00 - Photography Geek
    03)
        USERNAME="photogeek"
        CATEGORIES='["photography tutorial", "camera review", "videography tips", "photo editing"]'
        ;;

    # 04:00 - Cleanup runs here (handled by separate cron)
    04)
        echo "Cleanup hour - no content import"
        exit 0
        ;;

    # 05:00 - Mindful Zen
    05)
        USERNAME="mindfulzen"
        CATEGORIES='["meditation guide", "mindfulness practice", "stress relief", "mental wellness"]'
        ;;

    # 06:00 - Fitness Guru
    06)
        USERNAME="fitnessguru"
        CATEGORIES='["fitness workout routine", "yoga for beginners", "workout motivation", "martial arts training"]'
        ;;

    # 07:00 - News Today
    07)
        USERNAME="newstoday"
        CATEGORIES='["breaking news", "world news today", "current events", "news analysis"]'
        ;;

    # 08:00 - AI Enthusiast
    08)
        USERNAME="aienthusiast"
        CATEGORIES='["ChatGPT tutorial", "AI news 2024", "machine learning tutorial", "AI artificial intelligence explained"]'
        ;;

    # 09:00 - DIY Crafter
    09)
        USERNAME="diycrafter"
        CATEGORIES='["DIY projects", "crafts tutorial", "handmade ideas", "creative projects"]'
        ;;

    # 10:00 - Outdoor Explorer
    10)
        USERNAME="outdoorexplorer"
        CATEGORIES='["hiking adventure", "camping survival", "backpacking guide", "outdoor survival tips"]'
        ;;

    # 11:00 - Business Tips
    11)
        USERNAME="biztips"
        CATEGORIES='["business tips", "entrepreneurship advice", "startup guide", "business success"]'
        ;;

    # 12:00 - Science Geek
    12)
        USERNAME="sciencegeek"
        CATEGORIES='["science experiments", "space exploration documentary", "history documentary", "math explained simply"]'
        ;;

    # 13:00 - Polyglot Academy
    13)
        USERNAME="polyglot"
        CATEGORIES='["language learning", "learn spanish", "learn french", "language tutorial"]'
        ;;

    # 14:00 - Politics Now
    14)
        USERNAME="politicsnow"
        CATEGORIES='["political news today", "world politics", "political debate", "election news"]'
        ;;

    # 15:00 - Film Critic
    15)
        USERNAME="filmcritic"
        CATEGORIES='["movie review 2024", "film analysis", "cinema discussion", "best movies"]'
        ;;

    # 16:00 - Foodie Chef
    16)
        USERNAME="foodiechef"
        CATEGORIES='["cooking tutorial easy", "baking recipe", "chef cooking tips", "dinner recipe"]'
        ;;

    # 17:00 - True Crime
    17)
        USERNAME="truecrime"
        CATEGORIES='["true crime documentary", "crime mystery", "unsolved cases", "detective stories"]'
        ;;

    # 18:00 - Nature Wild
    18)
        USERNAME="naturewild"
        CATEGORIES='["wildlife documentary", "nature photography", "ocean life documentary", "cute animals compilation"]'
        ;;

    # 19:00 - Star Gazer
    19)
        USERNAME="stargazer"
        CATEGORIES='["astronomy tutorial", "space documentary", "planets exploration", "telescope guide"]'
        ;;

    # 20:00 - Gaming Pro
    20)
        USERNAME="gamingpro"
        CATEGORIES='["gaming highlights 2024", "esports tournament", "speedrun gameplay", "game review"]'
        ;;

    # 21:00 - Podcast Clips
    21)
        USERNAME="podcastclips"
        CATEGORIES='["podcast highlights", "podcast clips", "interview clips", "best podcast moments"]'
        ;;

    # 22:00 - Music Lover
    22)
        USERNAME="musiclover"
        CATEGORIES='["music video 2024", "live concert performance", "guitar tutorial", "cover songs"]'
        ;;

    # 23:00 - Late Night Comedy
    23)
        USERNAME="latenightcomedy"
        CATEGORIES='["late night show", "comedy sketches", "stand up comedy clips", "comedy monologue"]'
        ;;

    # Default - no import this hour
    *)
        echo "No import scheduled for hour $HOUR"
        exit 0
        ;;
esac

echo "$(date): Starting import for $USERNAME..."

# Make API call to import videos (using query parameters)
curl -X POST "http://192.168.1.198:8001/admin/auto-import-youtube?username=$USERNAME&videos_per_category=2" \
  -H "Content-Type: application/json" \
  -d "$CATEGORIES"

echo ""
echo "$(date): Import request completed for $USERNAME"
