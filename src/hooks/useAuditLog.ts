import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { useAuth } from '@/contexts/AuthContext';

export function useAuditLog() {
  const { selectedGuild } = useGuild();
  const { user } = useAuth();

  const logAction = useCallback(async (
    action: 'create' | 'update' | 'delete' | 'enable' | 'disable',
    targetType: string,
    targetId?: string,
    details?: Record<string, unknown>
  ) => {
    if (!selectedGuild?.id || !user?.id) return;

    try {
      await supabase.from('dashboard_audit_log' as any).insert({
        guild_id: selectedGuild.id,
        user_id: user.id,
        user_email: user.email ?? null,
        action,
        target_type: targetType,
        target_id: targetId ?? null,
        details: details ?? {},
      });
    } catch (e) {
      console.error('Failed to log audit action:', e);
    }
  }, [selectedGuild?.id, user?.id, user?.email]);

  return { logAction };
}
