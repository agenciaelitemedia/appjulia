# Feature: WhatsApp Media Download

## Status: ✅ Implemented

## Summary
Implemented automatic media download via `/message/download` API endpoint for images, videos, audio, and documents in WhatsApp chat messages.

## Changes Made

### 1. API Types (`src/lib/uazapi/types.ts`)
- Added `DownloadMediaRequest` interface
- Added `DownloadMediaResponse` interface

### 2. Message Endpoints (`src/lib/uazapi/endpoints/message.ts`)
- Added `download` method for POST `/message/download`

### 3. WhatsApp Messages Dialog (`src/pages/crm/components/WhatsAppMessagesDialog.tsx`)
- Converted `MessageBubble` to `forwardRef` component
- Added `downloadingMedia` state (Set) to track in-progress downloads
- Added `mediaUrls` state (Record) to cache downloaded URLs
- Added `downloadMedia` async function to call API
- Updated image/video/audio/document rendering with:
  - Loading spinner during download
  - Click to download overlay on thumbnails
  - Downloaded URL display when available

## User Flow
1. Message loads with empty `fileURL` but has `thumbnail`
2. User sees thumbnail with download overlay
3. User clicks → calls `/message/download`
4. API returns `fileURL` → stored in `mediaUrls`
5. Media renders with full resolution URL
