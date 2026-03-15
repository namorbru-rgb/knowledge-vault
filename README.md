# 🗄️ KnowledgeVault

Personal knowledge archive for videos, links, photos, and notes with AI-powered semantic search.

## Stack

- **Frontend**: React + Vite + Tailwind → GitHub Pages
- **Backend**: Node.js + Express (Port 3100, PM2)
- **Database**: Supabase PostgreSQL + pgvector
- **AI**: OpenAI embeddings, Claude Haiku vision, Whisper transcription

## Live App

🌐 https://namorbru-rgb.github.io/knowledge-vault

## Setup

### 1. Supabase Schema

Enable pgvector in Supabase Dashboard → Database → Extensions → Vector.

Then run `database/schema.sql` in the Supabase SQL Editor.

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env  # Fill in your keys
pm2 start src/server.js --name knowledge-vault-api
pm2 start src/workers/videoWorker.js --name kv-video-worker
pm2 start src/workers/linkWorker.js --name kv-link-worker
pm2 start src/workers/photoWorker.js --name kv-photo-worker
pm2 save
```

### 3. Frontend (GitHub Pages)

Set secret `VITE_SUPABASE_ANON_KEY` in repo settings, then push to main.

## Features

- 🎬 **Videos**: Add YouTube URLs → auto-download, transcribe with Whisper, semantic search
- 🔗 **Links**: Save URLs → auto-scrape, summarize with GPT, tag and embed
- 📷 **Photos**: Upload images → analyze with Claude Haiku, OCR, describe
- 📝 **Notes**: Quick notes with embeddings
- 🔍 **Search**: Semantic search across all content types
