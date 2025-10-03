--
-- PostgreSQL database dump
--

\restrict EbN0neva0k5JVrIoevdPZSECQqXrj7azVdcCwQ5cWVCw8WpEjWc2W9zZfNNKozs

-- Dumped from database version 13.22 (Debian 13.22-1.pgdg13+1)
-- Dumped by pg_dump version 13.22 (Debian 13.22-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: vidstream_user
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO vidstream_user;

--
-- Name: playlist_videos; Type: TABLE; Schema: public; Owner: vidstream_user
--

CREATE TABLE public.playlist_videos (
    playlist_id integer NOT NULL,
    video_id integer NOT NULL,
    "position" integer NOT NULL,
    added_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.playlist_videos OWNER TO vidstream_user;

--
-- Name: playlists; Type: TABLE; Schema: public; Owner: vidstream_user
--

CREATE TABLE public.playlists (
    id integer NOT NULL,
    name character varying NOT NULL,
    description character varying,
    owner_id integer NOT NULL,
    is_public boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.playlists OWNER TO vidstream_user;

--
-- Name: playlists_id_seq; Type: SEQUENCE; Schema: public; Owner: vidstream_user
--

CREATE SEQUENCE public.playlists_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.playlists_id_seq OWNER TO vidstream_user;

--
-- Name: playlists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vidstream_user
--

ALTER SEQUENCE public.playlists_id_seq OWNED BY public.playlists.id;


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: vidstream_user
--

CREATE TABLE public.subscriptions (
    subscriber_id integer NOT NULL,
    subscribed_to_id integer NOT NULL,
    subscribed_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.subscriptions OWNER TO vidstream_user;

--
-- Name: users; Type: TABLE; Schema: public; Owner: vidstream_user
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying,
    email character varying,
    hashed_password character varying,
    is_active boolean,
    channel_name character varying,
    channel_description character varying,
    avatar_url character varying,
    banner_url character varying
);


ALTER TABLE public.users OWNER TO vidstream_user;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: vidstream_user
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO vidstream_user;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vidstream_user
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: video_likes; Type: TABLE; Schema: public; Owner: vidstream_user
--

CREATE TABLE public.video_likes (
    id integer NOT NULL,
    user_id integer NOT NULL,
    video_id integer NOT NULL,
    is_like boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.video_likes OWNER TO vidstream_user;

--
-- Name: video_likes_id_seq; Type: SEQUENCE; Schema: public; Owner: vidstream_user
--

CREATE SEQUENCE public.video_likes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.video_likes_id_seq OWNER TO vidstream_user;

--
-- Name: video_likes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vidstream_user
--

ALTER SEQUENCE public.video_likes_id_seq OWNED BY public.video_likes.id;


--
-- Name: videos; Type: TABLE; Schema: public; Owner: vidstream_user
--

CREATE TABLE public.videos (
    id integer NOT NULL,
    title character varying,
    description character varying,
    file_path character varying,
    thumbnail_path character varying,
    upload_date timestamp with time zone DEFAULT now(),
    owner_id integer,
    hls_path character varying,
    duration integer,
    processing_status character varying,
    views integer,
    likes integer,
    dislikes integer,
    tags character varying[],
    stream_url character varying,
    is_live_stream boolean DEFAULT false,
    youtube_url character varying
);


ALTER TABLE public.videos OWNER TO vidstream_user;

--
-- Name: videos_id_seq; Type: SEQUENCE; Schema: public; Owner: vidstream_user
--

CREATE SEQUENCE public.videos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.videos_id_seq OWNER TO vidstream_user;

--
-- Name: videos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vidstream_user
--

ALTER SEQUENCE public.videos_id_seq OWNED BY public.videos.id;


--
-- Name: playlists id; Type: DEFAULT; Schema: public; Owner: vidstream_user
--

ALTER TABLE ONLY public.playlists ALTER COLUMN id SET DEFAULT nextval('public.playlists_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: vidstream_user
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: video_likes id; Type: DEFAULT; Schema: public; Owner: vidstream_user
--

ALTER TABLE ONLY public.video_likes ALTER COLUMN id SET DEFAULT nextval('public.video_likes_id_seq'::regclass);


--
-- Name: videos id; Type: DEFAULT; Schema: public; Owner: vidstream_user
--

ALTER TABLE ONLY public.videos ALTER COLUMN id SET DEFAULT nextval('public.videos_id_seq'::regclass);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: vidstream_user
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: playlist_videos playlist_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: vidstream_user
--

ALTER TABLE ONLY public.playlist_videos
    ADD CONSTRAINT playlist_videos_pkey PRIMARY KEY (playlist_id, video_id);


--
-- Name: playlists playlists_pkey; Type: CONSTRAINT; Schema: public; Owner: vidstream_user
--

ALTER TABLE ONLY public.playlists
    ADD CONSTRAINT playlists_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: vidstream_user
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (subscriber_id, subscribed_to_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: vidstream_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: video_likes video_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: vidstream_user
--

ALTER TABLE ONLY public.video_likes
    ADD CONSTRAINT video_likes_pkey PRIMARY KEY (id);


--
-- Name: videos videos_pkey; Type: CONSTRAINT; Schema: public; Owner: vidstream_user
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_pkey PRIMARY KEY (id);


--
-- Name: ix_playlists_id; Type: INDEX; Schema: public; Owner: vidstream_user
--

CREATE INDEX ix_playlists_id ON public.playlists USING btree (id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: vidstream_user
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: vidstream_user
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- Name: ix_users_username; Type: INDEX; Schema: public; Owner: vidstream_user
--

CREATE UNIQUE INDEX ix_users_username ON public.users USING btree (username);


--
-- Name: ix_video_likes_id; Type: INDEX; Schema: public; Owner: vidstream_user
--

CREATE INDEX ix_video_likes_id ON public.video_likes USING btree (id);


--
-- Name: ix_videos_id; Type: INDEX; Schema: public; Owner: vidstream_user
--

CREATE INDEX ix_videos_id ON public.videos USING btree (id);


--
-- Name: ix_videos_title; Type: INDEX; Schema: public; Owner: vidstream_user
--

CREATE INDEX ix_videos_title ON public.videos USING btree (title);


--
-- Name: playlist_videos playlist_videos_playlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vidstream_user
--

ALTER TABLE ONLY public.playlist_videos
    ADD CONSTRAINT playlist_videos_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.playlists(id);


--
-- Name: playlist_videos playlist_videos_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vidstream_user
--

ALTER TABLE ONLY public.playlist_videos
    ADD CONSTRAINT playlist_videos_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id);


--
-- Name: playlists playlists_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vidstream_user
--

ALTER TABLE ONLY public.playlists
    ADD CONSTRAINT playlists_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: subscriptions subscriptions_subscribed_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vidstream_user
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_subscribed_to_id_fkey FOREIGN KEY (subscribed_to_id) REFERENCES public.users(id);


--
-- Name: subscriptions subscriptions_subscriber_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vidstream_user
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_subscriber_id_fkey FOREIGN KEY (subscriber_id) REFERENCES public.users(id);


--
-- Name: video_likes video_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vidstream_user
--

ALTER TABLE ONLY public.video_likes
    ADD CONSTRAINT video_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: video_likes video_likes_video_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vidstream_user
--

ALTER TABLE ONLY public.video_likes
    ADD CONSTRAINT video_likes_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id);


--
-- Name: videos videos_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vidstream_user
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict EbN0neva0k5JVrIoevdPZSECQqXrj7azVdcCwQ5cWVCw8WpEjWc2W9zZfNNKozs

