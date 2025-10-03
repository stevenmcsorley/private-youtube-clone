# Video Streaming Service

This project is a video streaming service built with FastAPI (Python), React, PostgreSQL, and Docker.

## Getting Started

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd vid_stream
    ```

2.  **Configure environment variables:**
    Create a `.env` file in the root directory based on the `.env.example` (if provided) or the `docker-compose.yml` file.

3.  **Build and run the Docker containers:**
    ```bash
    docker-compose up --build
    ```

## Services

*   **Backend:** FastAPI application (Python)
*   **Frontend:** React application
*   **Database:** PostgreSQL
*   **Video Processor:** Handles video transcoding using FFmpeg

## Ports

The services will be accessible on the following default ports (configurable in `.env`):

*   **Frontend:** `http://localhost:3000`
*   **Backend:** `http://localhost:8000`

## Development

Each service has its own directory (`backend`, `frontend`, `video-processor`) with its respective `Dockerfile` and source code.
