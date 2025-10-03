# Personalized Viewing & TV Channel Feature

## 🎯 Overview

Create a personalized viewing experience that tracks user watch history and creates a curated "TV Channel" for continuous viewing based on their interests. Users can see their viewing stats, discover patterns in their viewing habits, and manage content preferences.

## 📊 Core Components

### 1. Watch History Tracking
Track detailed viewing data for each user to build personalized recommendations and statistics.

### 2. Viewing Statistics Dashboard
Show users insights about their viewing habits across different time periods.

### 3. TV Channel (Continuous Viewing)
A curated feed of videos that plays back-to-back based on user preferences and viewing history.

### 4. Category/Creator Management
Allow users to customize their content preferences by subscribing/unsubscribing from bot creators or categories.

---

## 🗄️ Database Schema Changes

### New Table: `watch_history`
Tracks each time a user watches a video, including duration and completion percentage.

```sql
CREATE TABLE watch_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    watch_duration INTEGER NOT NULL,  -- Seconds watched
    video_duration INTEGER,  -- Total video duration at time of watch
    completion_percentage DECIMAL(5,2),  -- 0.00 to 100.00
    watch_source VARCHAR(50),  -- 'trending', 'search', 'channel', 'tv_channel', etc.
    INDEX idx_user_watched (user_id, watched_at),
    INDEX idx_video_watched (video_id, watched_at),
    UNIQUE(user_id, video_id, watched_at)  -- Prevent duplicate entries
);
```

### New Table: `user_category_preferences`
Stores which categories/bot creators a user wants to see or hide.

```sql
CREATE TABLE user_category_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bot_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,  -- Which bot creator
    category VARCHAR(255),  -- Or specific category tag
    preference VARCHAR(20) NOT NULL,  -- 'subscribed', 'unsubscribed', 'neutral'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, bot_user_id),
    UNIQUE(user_id, category),
    INDEX idx_user_prefs (user_id, preference)
);
```

### Modify Existing: Add to `videos` table (if needed)
```sql
-- Already have tags, but ensure we're using them effectively
-- tags: ARRAY of strings (already exists)
-- Can derive categories from tags
```

---

## 🔧 Backend API Endpoints

### Watch History Tracking

#### `POST /videos/{video_id}/watch`
Record a watch event (called when user watches a video).

**Request Body:**
```json
{
  "watch_duration": 245,  // seconds watched
  "video_duration": 300,   // total duration
  "watch_source": "trending"
}
```

**Response:**
```json
{
  "status": "recorded",
  "completion_percentage": 81.67
}
```

---

### Statistics Endpoints

#### `GET /users/me/stats?period={day|week|month|all}`
Get user's viewing statistics for specified period.

**Response:**
```json
{
  "period": "week",
  "total_videos_watched": 45,
  "total_watch_time": 12450,  // seconds
  "average_completion": 78.5,  // percentage
  "most_watched_creators": [
    {
      "username": "techreviewer",
      "channel_name": "Tech Review Central",
      "video_count": 12,
      "watch_time": 3600
    },
    {
      "username": "gamingpro",
      "channel_name": "Gaming Pro Network",
      "video_count": 8,
      "watch_time": 2400
    }
  ],
  "most_watched_categories": [
    {
      "category": "technology news today",
      "video_count": 15,
      "watch_time": 4200
    }
  ],
  "viewing_by_hour": {
    "00": 2,
    "08": 5,
    "14": 8,
    "20": 12
  }
}
```

#### `GET /users/me/watch-history?page=1&limit=20`
Get paginated watch history for the user.

**Response:**
```json
{
  "items": [
    {
      "video_id": 123,
      "title": "Tech News Today",
      "thumbnail_path": "/thumbnails/...",
      "creator": "techreviewer",
      "watched_at": "2025-10-03T14:30:00Z",
      "watch_duration": 300,
      "completion_percentage": 95.5
    }
  ],
  "total": 145,
  "page": 1,
  "pages": 8
}
```

---

### Category Preferences

#### `GET /users/me/preferences`
Get user's category and creator preferences.

**Response:**
```json
{
  "subscribed_creators": [
    {
      "bot_user_id": 5,
      "username": "techreviewer",
      "channel_name": "Tech Review Central"
    }
  ],
  "unsubscribed_creators": [
    {
      "bot_user_id": 8,
      "username": "politicsnow",
      "channel_name": "Politics Now"
    }
  ],
  "subscribed_categories": ["technology", "gaming"],
  "unsubscribed_categories": ["politics"]
}
```

#### `POST /users/me/preferences/creators/{bot_user_id}`
Subscribe/unsubscribe from a bot creator.

**Request Body:**
```json
{
  "preference": "subscribed"  // or "unsubscribed" or "neutral"
}
```

#### `POST /users/me/preferences/categories`
Subscribe/unsubscribe from a category.

**Request Body:**
```json
{
  "category": "politics",
  "preference": "unsubscribed"
}
```

---

### TV Channel Feed

#### `GET /users/me/tv-channel?limit=50`
Get personalized feed of videos for continuous watching.

**Algorithm:**
1. Get user's watch history and preferences
2. Weight videos by:
   - Categories from most-watched creators (40%)
   - Similar to recently completed videos (30%)
   - Popular videos in subscribed categories (20%)
   - Discovery/randomness factor (10%)
3. Filter out:
   - Already watched videos (within last 7 days)
   - Unsubscribed creators/categories
   - Videos from blocked users
4. Sort by relevance score + recency

**Response:**
```json
{
  "videos": [
    {
      "id": 456,
      "title": "Latest AI News 2025",
      "thumbnail_path": "/thumbnails/...",
      "creator": {
        "username": "aienthusiast",
        "channel_name": "AI Enthusiast"
      },
      "duration": 300,
      "relevance_score": 0.92,
      "reason": "Based on your interest in technology"
    }
  ],
  "total": 50,
  "refresh_token": "abc123"  // Use to get next batch
}
```

#### `GET /users/me/tv-channel/next?after_video_id=456&refresh_token=abc123`
Get next video(s) in the TV channel queue.

---

## 🎨 Frontend Components

### 1. Stats Dashboard Page (`/stats`)

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  My Viewing Stats          [Day|Week|Month|All] │
├─────────────────────────────────────────────────┤
│  📊 Overview Cards                              │
│  ┌───────────┐ ┌───────────┐ ┌──────────────┐ │
│  │ 45 Videos │ │ 12.5 hrs  │ │ 78% Avg      │ │
│  │ Watched   │ │ Watch Time│ │ Completion   │ │
│  └───────────┘ └───────────┘ └──────────────┘ │
├─────────────────────────────────────────────────┤
│  👥 Top Creators You Watch                      │
│  ┌─────────────────────────────────────────┐   │
│  │ 🎮 Gaming Pro Network        12 videos  │ [✓]
│  │ 💻 Tech Review Central       10 videos  │ [✓]
│  │ 🎬 Film Critic Reviews        8 videos  │ [✓]
│  │ 🗞️  Politics Now               2 videos  │ [✗]
│  └─────────────────────────────────────────┘   │
│      ✓ = Subscribed    ✗ = Unsubscribed        │
├─────────────────────────────────────────────────┤
│  🏷️  Top Categories                             │
│  ┌─────────────────────────────────────────┐   │
│  │ technology news       15 videos          │ [✓]
│  │ gaming highlights      8 videos          │ [✓]
│  │ movie review           6 videos          │ [✓]
│  └─────────────────────────────────────────┘   │
├─────────────────────────────────────────────────┤
│  📈 Viewing Pattern (by hour)                   │
│  [Bar chart showing activity by hour]           │
└─────────────────────────────────────────────────┘
```

**Features:**
- Time period selector (Day/Week/Month/All)
- Click on creator names to view their channel
- Toggle subscribe/unsubscribe buttons next to creators and categories
- Visual charts (bars, pie charts for category distribution)
- Recent watch history section (last 10-20 videos)

---

### 2. TV Channel Page (`/tv-channel`)

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  🎬 My TV Channel                               │
│  "Personalized continuous viewing for you"      │
├─────────────────────────────────────────────────┤
│  [=== VIDEO PLAYER (LARGE) ================]    │
│  [                                         ]    │
│  [     Currently Playing                   ]    │
│  [                                         ]    │
│  [=========================================]    │
│                                                 │
│  Latest AI News 2025                            │
│  AI Enthusiast • 5:30 • Based on your interests │
│                                                 │
│  [◀ Prev] [⏸ Pause] [Skip ▶] [🔀 Shuffle]      │
├─────────────────────────────────────────────────┤
│  📋 Up Next (Auto-play queue)                   │
│  ┌─────────────────────────────────────────┐   │
│  │ 1. Tech Review: New iPhone    [6:20]    │   │
│  │ 2. Gaming Highlights           [8:45]    │   │
│  │ 3. Cooking Tutorial            [5:15]    │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  [⚙️ Refine My Channel]  [📊 View My Stats]     │
└─────────────────────────────────────────────────┘
```

**Features:**
- Auto-play next video when current finishes
- Shuffle option to randomize order
- Skip button to move to next video
- "Up Next" queue showing next 5-10 videos
- Continuously loads more videos as queue depletes
- "Refine" button opens preferences modal
- Track watch time and completion for algorithm improvement

---

### 3. Preferences Modal/Section

**Can be accessed from:**
- Stats page (inline toggles)
- TV Channel page (modal/sidebar)
- User settings page

**Features:**
- List all bot creators with subscribe/unsubscribe toggles
- List popular categories with subscribe/unsubscribe toggles
- "Reset to defaults" option
- Visual feedback when preferences change
- Update TV channel feed in real-time

---

## 🔄 Implementation Phases

### Phase 1: Watch History Tracking (Foundation)
**Goal:** Start collecting data on what users watch

1. Create `watch_history` table migration
2. Add `POST /videos/{video_id}/watch` endpoint
3. Update VideoPlayer component to call watch endpoint:
   - When video plays for >5 seconds (to avoid accidental clicks)
   - Send watch duration when user leaves page or video ends
4. Store watch source (trending, search, channel, etc.)

**Acceptance Criteria:**
- Watch history is recorded in database
- No duplicate entries for same viewing session
- Completion percentage calculated correctly

---

### Phase 2: Stats Dashboard
**Goal:** Show users insights about their viewing habits

1. Create `GET /users/me/stats` endpoint with period filtering
2. Create Stats page component (`/stats`)
3. Display:
   - Overview cards (total videos, watch time, avg completion)
   - Top creators list
   - Top categories list
   - Viewing pattern chart (by hour/day)
4. Add recent watch history section

**Acceptance Criteria:**
- Stats page loads and displays user data
- Time period filtering works (day/week/month/all)
- Charts are clear and informative
- Mobile responsive design

---

### Phase 3: Category Preferences
**Goal:** Let users control what content they see

1. Create `user_category_preferences` table migration
2. Add preference management endpoints:
   - `GET /users/me/preferences`
   - `POST /users/me/preferences/creators/{id}`
   - `POST /users/me/preferences/categories`
3. Add subscribe/unsubscribe toggles to Stats page:
   - Next to each creator in "Top Creators" section
   - Next to each category in "Top Categories" section
4. Show visual feedback when preferences change
5. Add preferences section to user settings

**Acceptance Criteria:**
- Users can subscribe/unsubscribe from creators
- Users can subscribe/unsubscribe from categories
- Preferences persist across sessions
- UI shows current preference state

---

### Phase 4: TV Channel Feed
**Goal:** Create personalized continuous viewing experience

1. Implement recommendation algorithm:
   - Query watch history for user patterns
   - Apply preference filters (subscribed/unsubscribed)
   - Calculate relevance scores
   - Mix popular + personalized + discovery content
2. Create `GET /users/me/tv-channel` endpoint
3. Create TV Channel page component (`/tv-channel`)
4. Implement video player with auto-play queue:
   - Large video player at top
   - "Up Next" queue below
   - Auto-advance to next video
   - Skip/Previous controls
5. Add shuffle/randomize option
6. Continuously load more videos as queue depletes

**Acceptance Criteria:**
- TV channel loads personalized video feed
- Videos auto-play one after another
- Queue updates as videos are watched
- Preferences affect what videos are shown
- Skip/Previous controls work correctly
- Mobile responsive (maybe vertical scroll on mobile)

---

### Phase 5: Algorithm Refinement
**Goal:** Improve recommendations based on usage

1. Track additional metrics:
   - Skip rate (videos skipped vs watched)
   - Time of day preferences
   - Category co-occurrence (users who like X also like Y)
2. Implement feedback loop:
   - Videos watched fully = boost that creator/category
   - Videos skipped = reduce score
   - Adjust weights based on engagement
3. Add "Not interested" button to reduce similar content
4. Add "More like this" button to boost similar content
5. A/B test different recommendation strategies

**Acceptance Criteria:**
- Recommendations improve over time
- Skip rate decreases for active users
- Engagement metrics increase (watch time, completion)
- User feedback buttons work correctly

---

## 📈 Success Metrics

### User Engagement
- **Average watch time per session** (target: +30%)
- **Videos watched per session** (target: 5+ consecutive videos)
- **Return rate** (users coming back to TV Channel)
- **Completion rate** (% of videos watched to end)

### Content Discovery
- **Diversity score** (variety of creators/categories watched)
- **New creator discovery** (users finding new channels they like)
- **Subscription growth** (to bot creators)

### Platform Health
- **Total watch time** (across all users)
- **Active users** (using Stats or TV Channel features)
- **Content coverage** (% of videos being discovered)

---

## 🎨 UI/UX Considerations

### Stats Page
- Make it feel like a "Year in Review" style dashboard
- Use engaging visualizations (charts, graphs, animations)
- Show comparisons (you vs platform average)
- Highlight interesting patterns ("You watch most videos at 8 PM!")
- Make it shareable (social media friendly)

### TV Channel
- Minimize friction - one click to start watching
- Clear "Up Next" visibility so users know what's coming
- Easy controls to skip or shuffle
- Background loading so no buffering between videos
- Save position - resume where they left off
- Picture-in-picture support for multitasking

### Preferences
- Don't overwhelm - show most relevant options first
- Visual toggles (not just checkboxes)
- Immediate feedback when preferences change
- Explain what each preference does
- Smart defaults based on initial watch history

---

## 🔐 Privacy Considerations

### Data Collection
- Clearly communicate what data is collected
- Allow users to delete watch history
- Option to pause tracking temporarily
- Export watch history data (GDPR compliance)

### Recommendations
- Explain why videos are recommended
- Allow users to hide specific videos/creators
- No sharing of watch history with other users
- Anonymous aggregate stats only for platform metrics

---

## 🚀 Future Enhancements

### Social Features
- Share your TV channel with friends
- Collaborative playlists
- "Watch together" sessions

### Advanced Recommendations
- Time-aware recommendations (morning news, evening entertainment)
- Mood-based filtering ("Show me uplifting content")
- Series detection (part 1, 2, 3 of video series)

### Gamification
- Badges for watching milestones
- Streaks for daily viewing
- Challenges (watch 1 video from each category)

### Creator Tools
- Creators can see their viewer retention stats
- Understanding which tags perform best
- Peak viewing times for their content

---

## 📝 Technical Notes

### Performance Optimization
- Cache user stats (refresh every 5 minutes)
- Pre-compute TV channel feed (refresh when new videos arrive)
- Paginate watch history (don't load all at once)
- Use database indexes on user_id, watched_at columns
- Consider Redis for TV channel queue

### Scalability
- Watch history will grow quickly - plan for millions of rows
- Consider partitioning by date (monthly tables)
- Archive old history (>6 months) to separate table
- Batch process recommendation calculations

### Testing
- Unit tests for recommendation algorithm
- Integration tests for stats calculations
- E2E tests for TV channel auto-play flow
- Load testing for watch history endpoint

---

## 📅 Estimated Timeline

- **Phase 1:** 3-4 days (Watch history tracking)
- **Phase 2:** 4-5 days (Stats dashboard)
- **Phase 3:** 3-4 days (Preferences)
- **Phase 4:** 5-7 days (TV Channel feed)
- **Phase 5:** Ongoing (Algorithm refinement)

**Total:** ~3 weeks for initial launch (Phases 1-4)

---

**Last Updated:** 2025-10-03
**Status:** Planning Phase
**Priority:** High - Differentiating feature for platform
