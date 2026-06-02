import { useState, useEffect } from 'react';
import { useGuild } from '@/contexts/GuildContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { ModuleCard, ModuleStatus } from '@/components/dashboard/ModuleCard';
import { DbModuleType, MODULE_INFO } from '@/types/discord';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const DEFAULT_MODULES: Record<DbModuleType, boolean> = {
  moderation: true, music: true, leveling: true, utility: true,
  fun: true, economy: true, tickets: true, giveaway: true, tebex: true,
};

export default function Modules() {
  const { selectedGuild } = useGuild();
  const { t } = useLanguage();
  const [modules, setModules] = useState<Record<DbModuleType, boolean>>(DEFAULT_MODULES);
  const [statuses, setStatuses] = useState<Record<DbModuleType, ModuleStatus | undefined>>({} as any);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<DbModuleType | null>(null);

  useEffect(() => {
    if (!selectedGuild) return;
    fetchModules();

    // Realtime subscription for module changes
    const channel = supabase
      .channel(`guild_modules:${selectedGuild.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guild_modules',
          filter: `guild_id=eq.${selectedGuild.id}`,
        },
        (payload) => {
          const row: any = payload.new ?? payload.old;
          if (!row?.module_type) return;
          const mt = row.module_type as DbModuleType;
          if (!(mt in DEFAULT_MODULES)) return;
          setModules((prev) => ({ ...prev, [mt]: payload.new ? !!(payload.new as any).enabled : prev[mt] }));
          setStatuses((prev) => ({
            ...prev,
            [mt]: payload.new ? ((payload.new as any).enabled ? 'enabled' : 'disabled') : 'disabled',
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedGuild]);

  const fetchModules = async () => {
    if (!selectedGuild) return;
    try {
      const { data, error } = await supabase
        .from('guild_modules').select('*').eq('guild_id', selectedGuild.id);
      if (error) throw error;
      const moduleState: Record<DbModuleType, boolean> = { ...DEFAULT_MODULES };
      const statusState: Record<DbModuleType, ModuleStatus> = {} as any;
      (Object.keys(DEFAULT_MODULES) as DbModuleType[]).forEach((mt) => {
        statusState[mt] = moduleState[mt] ? 'enabled' : 'disabled';
      });
      data?.forEach((m) => {
        if (m.module_type in moduleState) {
          moduleState[m.module_type as DbModuleType] = m.enabled;
          statusState[m.module_type as DbModuleType] = m.enabled ? 'enabled' : 'disabled';
        }
      });
      setModules(moduleState);
      setStatuses(statusState);
    } catch (err) {
      console.error('Error fetching modules:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (moduleType: DbModuleType, enabled: boolean) => {
    if (!selectedGuild) return;
    setUpdating(moduleType);
    setStatuses((prev) => ({ ...prev, [moduleType]: 'syncing' }));
    try {
      const { error } = await supabase
        .from('guild_modules')
        .upsert({ guild_id: selectedGuild.id, module_type: moduleType, enabled }, { onConflict: 'guild_id,module_type' });
      if (error) throw error;
      setModules((prev) => ({ ...prev, [moduleType]: enabled }));
      setStatuses((prev) => ({ ...prev, [moduleType]: enabled ? 'enabled' : 'disabled' }));
      toast.success(t(enabled ? 'modules.activated' : 'modules.deactivated', { name: MODULE_INFO[moduleType].name }));
    } catch (err) {
      console.error('Error updating module:', err);
      setStatuses((prev) => ({ ...prev, [moduleType]: 'error' }));
      toast.error(t('modules.updateError'));
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('modules.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('modules.subtitle')}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {(Object.keys(MODULE_INFO) as DbModuleType[]).map((moduleType) => (
          <ModuleCard
            key={moduleType}
            moduleType={moduleType}
            enabled={modules[moduleType]}
            onToggle={(enabled) => handleToggle(moduleType, enabled)}
            loading={updating === moduleType}
            status={statuses[moduleType]}
          />
        ))}
      </div>
    </div>
  );
}
