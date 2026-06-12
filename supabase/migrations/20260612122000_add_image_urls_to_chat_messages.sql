-- Migration: Add image_urls to chat_messages table to store attachments
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';
