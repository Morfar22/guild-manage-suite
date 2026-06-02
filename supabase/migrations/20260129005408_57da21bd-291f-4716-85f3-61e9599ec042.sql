-- Add unique constraint for guild_id + command_name if not exists
-- This allows upsert to work correctly
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'guild_commands_guild_id_command_name_key'
  ) THEN
    ALTER TABLE public.guild_commands 
    ADD CONSTRAINT guild_commands_guild_id_command_name_key 
    UNIQUE (guild_id, command_name);
  END IF;
END $$;