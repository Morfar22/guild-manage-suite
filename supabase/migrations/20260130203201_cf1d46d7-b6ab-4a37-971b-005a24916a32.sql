-- Add unique constraint for upsert to work correctly
ALTER TABLE public.fivem_online_players 
ADD CONSTRAINT fivem_online_players_guild_server_player_unique 
UNIQUE (guild_id, server_id, player_id);