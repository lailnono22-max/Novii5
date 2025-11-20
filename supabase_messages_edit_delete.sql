-- Migration: Add edit and delete functionality to messages table
-- Run this in your Supabase SQL Editor AFTER running supabase_schema.sql

-- Add new columns to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS original_content TEXT;

-- Create index for better performance on edited/deleted messages
CREATE INDEX IF NOT EXISTS idx_messages_is_deleted ON messages(is_deleted);
CREATE INDEX IF NOT EXISTS idx_messages_is_edited ON messages(is_edited);

-- Update RLS policy to allow users to update their own messages (already exists, but let's ensure it's correct)
-- The existing policy "Users can update own sent messages" should cover this

-- Add policy to prevent deleting messages (we use soft delete with is_deleted flag)
DROP POLICY IF EXISTS "Prevent hard delete of messages" ON messages;
CREATE POLICY "Prevent hard delete of messages" ON messages
  FOR DELETE USING (false);

-- Drop old functions if they exist (to change return type)
DROP FUNCTION IF EXISTS update_message(UUID, TEXT);
DROP FUNCTION IF EXISTS delete_message(UUID);

-- Function to update message (edit)
CREATE OR REPLACE FUNCTION update_message(
  message_id UUID,
  new_content TEXT
)
RETURNS TABLE(
  id UUID,
  sender_id UUID,
  receiver_id UUID,
  content TEXT,
  is_read BOOLEAN,
  is_deleted BOOLEAN,
  is_edited BOOLEAN,
  edited_at TIMESTAMP WITH TIME ZONE,
  original_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  message_record RECORD;
  current_user_id UUID;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  
  -- Check if user is the sender
  SELECT * INTO message_record FROM messages WHERE messages.id = message_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  
  IF message_record.sender_id != current_user_id THEN
    RAISE EXCEPTION 'Unauthorized: You can only edit your own messages';
  END IF;
  
  IF message_record.is_deleted THEN
    RAISE EXCEPTION 'Cannot edit a deleted message';
  END IF;
  
  -- Store original content if this is the first edit
  IF NOT message_record.is_edited THEN
    UPDATE messages 
    SET 
      original_content = message_record.content,
      content = new_content,
      is_edited = TRUE,
      edited_at = NOW(),
      updated_at = NOW()
    WHERE messages.id = message_id;
  ELSE
    -- Already edited before, just update content
    UPDATE messages 
    SET 
      content = new_content,
      edited_at = NOW(),
      updated_at = NOW()
    WHERE messages.id = message_id;
  END IF;
  
  -- Return updated message
  RETURN QUERY 
  SELECT 
    m.id,
    m.sender_id,
    m.receiver_id,
    m.content,
    m.is_read,
    m.is_deleted,
    m.is_edited,
    m.edited_at,
    m.original_content,
    m.created_at,
    m.updated_at
  FROM messages m 
  WHERE m.id = message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete message (soft delete)
CREATE OR REPLACE FUNCTION delete_message(
  message_id UUID
)
RETURNS TABLE(
  id UUID,
  sender_id UUID,
  receiver_id UUID,
  content TEXT,
  is_read BOOLEAN,
  is_deleted BOOLEAN,
  is_edited BOOLEAN,
  edited_at TIMESTAMP WITH TIME ZONE,
  original_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  message_record RECORD;
  current_user_id UUID;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  
  -- Check if user is the sender
  SELECT * INTO message_record FROM messages WHERE messages.id = message_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  
  IF message_record.sender_id != current_user_id THEN
    RAISE EXCEPTION 'Unauthorized: You can only delete your own messages';
  END IF;
  
  IF message_record.is_deleted THEN
    RAISE EXCEPTION 'Message already deleted';
  END IF;
  
  -- Soft delete the message
  UPDATE messages 
  SET 
    is_deleted = TRUE,
    updated_at = NOW()
  WHERE messages.id = message_id;
  
  -- Return updated message
  RETURN QUERY 
  SELECT 
    m.id,
    m.sender_id,
    m.receiver_id,
    m.content,
    m.is_read,
    m.is_deleted,
    m.is_edited,
    m.edited_at,
    m.original_content,
    m.created_at,
    m.updated_at
  FROM messages m 
  WHERE m.id = message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_message(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_message(UUID) TO authenticated;

COMMENT ON FUNCTION update_message IS 'Edit a message - only sender can edit their own messages';
COMMENT ON FUNCTION delete_message IS 'Soft delete a message - only sender can delete their own messages';
