import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json, Tables } from '@/integrations/supabase/types';
import { useGuild } from '@/contexts/GuildContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type ModerationCase = Tables<'moderation_logs'>;
export type ModerationEvidence = Tables<'moderation_evidence'>;
export type ModerationAppeal = Tables<'moderation_appeals'>;
export type Workflow = Tables<'automation_workflows'>;
export type PermissionProfile = Tables<'command_permission_profiles'>;
export type CommandPreset = Tables<'command_presets'>;
export type DashboardAlert = Tables<'dashboard_notifications'>;
export type AuditEntry = Tables<'dashboard_audit_log'>;
export type CommandHealth = Tables<'command_health_7d'>;
export type StaffPerformance = Tables<'staff_performance_30d'>;

type CaseUpdate = Partial<Pick<
  ModerationCase,
  'status' | 'severity' | 'assigned_to_id' | 'assigned_to_name' | 'resolution' | 'closed_at' | 'reopened_at'
>>;

type User360Result = {
  query: string;
  userId: string | null;
  displayName: string | null;
  cases: ModerationCase[];
  notes: Tables<'moderation_notes'>[];
  tickets: Tables<'tickets'>[];
  warnings: Tables<'warnings'>[];
  summary: {
    totalCases: number;
    activeCases: number;
    criticalCases: number;
    tickets: number;
    warnings: number;
    riskScore: number;
    riskLabel: 'Lav' | 'Mellem' | 'Høj' | 'Kritisk';
  };
};

function json(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function riskLabel(score: number): User360Result['summary']['riskLabel'] {
  if (score >= 18) return 'Kritisk';
  if (score >= 10) return 'Høj';
  if (score >= 4) return 'Mellem';
  return 'Lav';
}

export function useOperationsCenter() {
  const { selectedGuild } = useGuild();
  const { user } = useAuth();
  const qc = useQueryClient();
  const guildId = selectedGuild?.id;

  const casesQuery = useQuery({
    queryKey: ['ops-cases', guildId],
    queryFn: async () => {
      if (!guildId) return [];
      const { data, error } = await supabase
        .from('moderation_logs')
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false })
        .limit(250);
      if (error) throw error;
      return data;
    },
    enabled: !!guildId,
    refetchInterval: 20_000,
  });

  const appealsQuery = useQuery({
    queryKey: ['ops-appeals', guildId],
    queryFn: async () => {
      if (!guildId) return [];
      const { data, error } = await supabase
        .from('moderation_appeals')
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!guildId,
    refetchInterval: 20_000,
  });

  const alertsQuery = useQuery({
    queryKey: ['ops-alerts', guildId],
    queryFn: async () => {
      if (!guildId) return [];
      const { data, error } = await supabase
        .from('dashboard_notifications')
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false })
        .limit(150);
      if (error) throw error;
      return data;
    },
    enabled: !!guildId,
    refetchInterval: 15_000,
  });

  const workflowsQuery = useQuery({
    queryKey: ['ops-workflows', guildId],
    queryFn: async () => {
      if (!guildId) return [];
      const { data, error } = await supabase
        .from('automation_workflows')
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!guildId,
  });

  const profilesQuery = useQuery({
    queryKey: ['ops-permission-profiles', guildId],
    queryFn: async () => {
      if (!guildId) return [];
      const { data, error } = await supabase
        .from('command_permission_profiles')
        .select('*')
        .eq('guild_id', guildId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!guildId,
  });

  const presetsQuery = useQuery({
    queryKey: ['ops-command-presets', guildId],
    queryFn: async () => {
      if (!guildId) return [];
      const { data, error } = await supabase
        .from('command_presets')
        .select('*')
        .eq('guild_id', guildId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!guildId,
  });

  const auditQuery = useQuery({
    queryKey: ['ops-audit', guildId],
    queryFn: async () => {
      if (!guildId) return [];
      const { data, error } = await supabase
        .from('dashboard_audit_log')
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false })
        .limit(150);
      if (error) throw error;
      return data;
    },
    enabled: !!guildId,
    refetchInterval: 30_000,
  });

  const staffQuery = useQuery({
    queryKey: ['ops-staff-performance', guildId],
    queryFn: async () => {
      if (!guildId) return [];
      const { data, error } = await supabase
        .from('staff_performance_30d')
        .select('*')
        .eq('guild_id', guildId)
        .order('moderation_actions', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!guildId,
  });

  const healthQuery = useQuery({
    queryKey: ['ops-command-health', guildId],
    queryFn: async () => {
      if (!guildId) return [];
      const { data, error } = await supabase
        .from('command_health_7d')
        .select('*')
        .eq('guild_id', guildId)
        .order('error_rate', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!guildId,
    refetchInterval: 30_000,
  });

  const scheduledModerationQuery = useQuery({
    queryKey: ['ops-moderation-scheduled', guildId],
    queryFn: async () => {
      if (!guildId) return [];
      const { data, error } = await supabase
        .from('moderation_scheduled_actions')
        .select('*')
        .eq('guild_id', guildId)
        .order('execute_at', { ascending: true })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!guildId,
    refetchInterval: 20_000,
  });

  const logAudit = async (
    action: string,
    targetType: string,
    targetId: string | null,
    details: Record<string, unknown>,
    undoPayload?: Record<string, unknown> | null,
  ) => {
    if (!guildId || !user?.id) return;
    await supabase.from('dashboard_audit_log').insert({
      guild_id: guildId,
      user_id: user.id,
      user_email: user.email ?? null,
      action,
      target_type: targetType,
      target_id: targetId,
      details: json(details),
      undo_payload: undoPayload ? json(undoPayload) : null,
    });
  };

  const updateCase = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: CaseUpdate }) => {
      if (!guildId) throw new Error('Ingen guild valgt');
      const current = casesQuery.data?.find((item) => item.id === id);
      const normalized = { ...updates };
      if (updates.status === 'resolved' || updates.status === 'dismissed') {
        normalized.closed_at = updates.closed_at ?? new Date().toISOString();
      }
      if (updates.status === 'open' && current?.status !== 'open') {
        normalized.reopened_at = new Date().toISOString();
        normalized.closed_at = null;
      }

      const { error } = await supabase
        .from('moderation_logs')
        .update(normalized)
        .eq('id', id)
        .eq('guild_id', guildId);
      if (error) throw error;

      await logAudit(
        'update',
        'moderation_case',
        id,
        { changes: normalized },
        current ? { table: 'moderation_logs', id, values: current } : null,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops-cases', guildId] });
      qc.invalidateQueries({ queryKey: ['ops-audit', guildId] });
      toast.success('Case opdateret');
    },
    onError: (error) => toast.error(error.message),
  });

  const addEvidence = useMutation({
    mutationFn: async (input: {
      case_id: string;
      evidence_type: 'note' | 'link' | 'message' | 'attachment';
      label?: string;
      content?: string;
      url?: string;
      message_id?: string;
      channel_id?: string;
      added_by_id: string;
      added_by_name?: string;
    }) => {
      if (!guildId) throw new Error('Ingen guild valgt');
      const { data, error } = await supabase
        .from('moderation_evidence')
        .insert({ ...input, guild_id: guildId })
        .select()
        .single();
      if (error) throw error;
      await logAudit('create', 'moderation_evidence', data.id, {
        case_id: input.case_id,
        evidence_type: input.evidence_type,
        label: input.label,
      });
      return data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['case-evidence', variables.case_id] });
      qc.invalidateQueries({ queryKey: ['ops-audit', guildId] });
      toast.success('Bevis tilføjet');
    },
    onError: (error) => toast.error(error.message),
  });

  const updateAppeal = useMutation({
    mutationFn: async ({ id, status, staff_response }: {
      id: string;
      status: ModerationAppeal['status'];
      staff_response?: string;
    }) => {
      if (!guildId) throw new Error('Ingen guild valgt');
      const { error } = await supabase
        .from('moderation_appeals')
        .update({
          status,
          staff_response: staff_response ?? null,
          reviewed_by_id: user?.id ?? null,
          reviewed_by_name: user?.email ?? null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('guild_id', guildId);
      if (error) throw error;
      await logAudit('update', 'moderation_appeal', id, { status, staff_response });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops-appeals', guildId] });
      qc.invalidateQueries({ queryKey: ['ops-audit', guildId] });
      toast.success('Appeal opdateret');
    },
    onError: (error) => toast.error(error.message),
  });

  const updateAlert = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'open' | 'acknowledged' | 'resolved' }) => {
      if (!guildId) throw new Error('Ingen guild valgt');
      const values: Record<string, unknown> = { status, is_read: true };
      if (status === 'acknowledged') {
        values.acknowledged_at = new Date().toISOString();
        values.acknowledged_by = user?.id ?? null;
      }
      if (status === 'resolved') {
        values.resolved_at = new Date().toISOString();
        values.resolved_by = user?.id ?? null;
      }
      const { error } = await supabase
        .from('dashboard_notifications')
        .update(values)
        .eq('id', id)
        .eq('guild_id', guildId);
      if (error) throw error;
      await logAudit('update', 'alert', id, { status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops-alerts', guildId] });
      qc.invalidateQueries({ queryKey: ['dashboard-notifications', guildId] });
      toast.success('Alert opdateret');
    },
    onError: (error) => toast.error(error.message),
  });

  const createWorkflow = useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      trigger_type: Workflow['trigger_type'];
      trigger_config?: Json;
      actions: Json;
    }) => {
      if (!guildId) throw new Error('Ingen guild valgt');
      const { data, error } = await supabase
        .from('automation_workflows')
        .insert({
          guild_id: guildId,
          name: input.name,
          description: input.description ?? null,
          trigger_type: input.trigger_type,
          trigger_config: input.trigger_config ?? {},
          actions: input.actions,
          created_by_id: user?.id ?? null,
          created_by_email: user?.email ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      await logAudit('create', 'workflow', data.id, { name: input.name, trigger_type: input.trigger_type });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops-workflows', guildId] });
      toast.success('Workflow oprettet');
    },
    onError: (error) => toast.error(error.message),
  });

  const updateWorkflow = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Workflow> }) => {
      if (!guildId) throw new Error('Ingen guild valgt');
      const current = workflowsQuery.data?.find((item) => item.id === id);
      const { error } = await supabase
        .from('automation_workflows')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('guild_id', guildId);
      if (error) throw error;
      await logAudit(
        'update',
        'workflow',
        id,
        { changes: updates },
        current ? { table: 'automation_workflows', id, values: current } : null,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops-workflows', guildId] }),
    onError: (error) => toast.error(error.message),
  });

  const deleteWorkflow = useMutation({
    mutationFn: async (id: string) => {
      if (!guildId) throw new Error('Ingen guild valgt');
      const current = workflowsQuery.data?.find((item) => item.id === id);
      const { error } = await supabase
        .from('automation_workflows')
        .delete()
        .eq('id', id)
        .eq('guild_id', guildId);
      if (error) throw error;
      await logAudit(
        'delete',
        'workflow',
        id,
        { name: current?.name },
        current ? { table: 'automation_workflows', insert: current } : null,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops-workflows', guildId] });
      toast.success('Workflow slettet');
    },
  });

  const createProfile = useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      role_ids: string[];
      command_names: string[];
      allowed_channel_ids?: string[];
      cooldown_seconds?: number | null;
    }) => {
      if (!guildId) throw new Error('Ingen guild valgt');
      const { data, error } = await supabase
        .from('command_permission_profiles')
        .insert({
          guild_id: guildId,
          name: input.name,
          description: input.description ?? null,
          role_ids: input.role_ids,
          command_names: input.command_names,
          allowed_channel_ids: input.allowed_channel_ids ?? [],
          cooldown_seconds: input.cooldown_seconds ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      await logAudit('create', 'permission_profile', data.id, { name: data.name });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops-permission-profiles', guildId] });
      toast.success('Permission profile oprettet');
    },
    onError: (error) => toast.error(error.message),
  });

  const applyProfile = useMutation({
    mutationFn: async (profile: PermissionProfile) => {
      if (!guildId) throw new Error('Ingen guild valgt');
      if (!profile.command_names.length) throw new Error('Profilen har ingen commands');

      const updates: Record<string, unknown> = {
        allowed_role_ids: profile.role_ids,
        allowed_channel_ids: profile.allowed_channel_ids,
        updated_at: new Date().toISOString(),
      };
      if (profile.cooldown_seconds != null) updates.cooldown_seconds = profile.cooldown_seconds;

      const { error } = await supabase
        .from('guild_commands')
        .update(updates)
        .eq('guild_id', guildId)
        .in('command_name', profile.command_names);
      if (error) throw error;

      await logAudit('update', 'permission_profile_apply', profile.id, {
        name: profile.name,
        commands: profile.command_names,
        roles: profile.role_ids,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guild-commands', guildId] });
      qc.invalidateQueries({ queryKey: ['ops-audit', guildId] });
      toast.success('Permission profile anvendt');
    },
    onError: (error) => toast.error(error.message),
  });

  const createPreset = useMutation({
    mutationFn: async (input: { name: string; description?: string; rules: Json }) => {
      if (!guildId) throw new Error('Ingen guild valgt');
      const { data, error } = await supabase
        .from('command_presets')
        .insert({
          guild_id: guildId,
          name: input.name,
          description: input.description ?? null,
          rules: input.rules,
        })
        .select()
        .single();
      if (error) throw error;
      await logAudit('create', 'command_preset', data.id, { name: data.name });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops-command-presets', guildId] }),
    onError: (error) => toast.error(error.message),
  });

  const applyPresetRules = useMutation({
    mutationFn: async (input: {
      name: string;
      enabledCommands?: string[];
      disabledCommands?: string[];
      cooldown?: number;
    }) => {
      if (!guildId) throw new Error('Ingen guild valgt');

      if (input.enabledCommands?.length) {
        const { error } = await supabase
          .from('guild_commands')
          .update({ enabled: true, updated_at: new Date().toISOString() })
          .eq('guild_id', guildId)
          .in('command_name', input.enabledCommands);
        if (error) throw error;
      }

      if (input.disabledCommands?.length) {
        const { error } = await supabase
          .from('guild_commands')
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq('guild_id', guildId)
          .in('command_name', input.disabledCommands);
        if (error) throw error;
      }

      if (input.cooldown != null && input.enabledCommands?.length) {
        const { error } = await supabase
          .from('guild_commands')
          .update({ cooldown_seconds: input.cooldown, updated_at: new Date().toISOString() })
          .eq('guild_id', guildId)
          .in('command_name', input.enabledCommands);
        if (error) throw error;
      }

      await logAudit('update', 'command_preset_apply', null, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guild-commands', guildId] });
      toast.success('Preset anvendt');
    },
    onError: (error) => toast.error(error.message),
  });

  const undoAudit = useMutation({
    mutationFn: async (entry: AuditEntry) => {
      if (!guildId || !user?.id) throw new Error('Ingen guild valgt');
      if (!entry.undo_payload || typeof entry.undo_payload !== 'object' || Array.isArray(entry.undo_payload)) {
        throw new Error('Denne ændring kan ikke fortrydes automatisk');
      }

      const payload = entry.undo_payload as Record<string, unknown>;
      const table = String(payload.table || '');
      const id = String(payload.id || '');
      const values = payload.values;
      const insert = payload.insert;

      const allowedTables = new Set(['guild_commands', 'moderation_logs', 'automation_workflows']);
      if (!allowedTables.has(table)) throw new Error('Undo understøttes ikke for denne type');

      if (insert && typeof insert === 'object' && !Array.isArray(insert)) {
        const { error } = await (supabase.from(table as 'automation_workflows') as any).insert(insert);
        if (error) throw error;
      } else if (
        table === 'guild_commands' &&
        payload.command_name &&
        values &&
        typeof values === 'object' &&
        !Array.isArray(values)
      ) {
        const { error } = await supabase
          .from('guild_commands')
          .update(values as any)
          .eq('guild_id', guildId)
          .eq('command_name', String(payload.command_name));
        if (error) throw error;
      } else if (id && values && typeof values === 'object' && !Array.isArray(values)) {
        const { error } = await (supabase.from(table as 'moderation_logs') as any)
          .update(values)
          .eq('id', id)
          .eq('guild_id', guildId);
        if (error) throw error;
      } else {
        throw new Error('Undo-data er ufuldstændig');
      }

      const { error: auditError } = await supabase
        .from('dashboard_audit_log')
        .update({ undone_at: new Date().toISOString(), undone_by: user.id })
        .eq('id', entry.id)
        .eq('guild_id', guildId);
      if (auditError) throw auditError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops-audit', guildId] });
      qc.invalidateQueries({ queryKey: ['ops-cases', guildId] });
      qc.invalidateQueries({ queryKey: ['ops-workflows', guildId] });
      toast.success('Ændringen er rullet tilbage');
    },
    onError: (error) => toast.error(error.message),
  });

  const searchUser = useMutation({
    mutationFn: async (rawQuery: string): Promise<User360Result> => {
      if (!guildId) throw new Error('Ingen guild valgt');
      const query = rawQuery.trim();
      if (!query) throw new Error('Skriv et Discord ID eller navn');

      const isId = /^\d{10,25}$/.test(query);

      let casesRequest = supabase
        .from('moderation_logs')
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false })
        .limit(100);
      casesRequest = isId
        ? casesRequest.eq('target_id', query)
        : casesRequest.ilike('target_name', `%${query}%`);

      let ticketsRequest = supabase
        .from('tickets')
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false })
        .limit(100);
      ticketsRequest = isId
        ? ticketsRequest.eq('creator_id', query)
        : ticketsRequest.ilike('creator_name', `%${query}%`);

      let notesRequest = supabase
        .from('moderation_notes')
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false })
        .limit(100);
      notesRequest = isId
        ? notesRequest.eq('user_id', query)
        : notesRequest.ilike('user_name', `%${query}%`);

      let warningsRequest = supabase
        .from('warnings')
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false })
        .limit(100);
      warningsRequest = isId
        ? warningsRequest.eq('user_id', query)
        : warningsRequest.ilike('user_name', `%${query}%`);

      const [casesResult, ticketsResult, notesResult, warningsResult] = await Promise.all([
        casesRequest,
        ticketsRequest,
        notesRequest,
        warningsRequest,
      ]);

      if (casesResult.error) throw casesResult.error;
      if (ticketsResult.error) throw ticketsResult.error;
      if (notesResult.error) throw notesResult.error;
      if (warningsResult.error) throw warningsResult.error;

      const cases = casesResult.data ?? [];
      const notes = notesResult.data ?? [];
      const tickets = ticketsResult.data ?? [];
      const warnings = warningsResult.data ?? [];

      const userId =
        (isId ? query : null) ||
        cases[0]?.target_id ||
        tickets[0]?.creator_id ||
        notes[0]?.user_id ||
        warnings[0]?.user_id ||
        null;
      const displayName =
        cases[0]?.target_name ||
        tickets[0]?.creator_name ||
        notes[0]?.user_name ||
        warnings[0]?.user_name ||
        null;

      const now = Date.now();
      const recent30 = cases.filter((item) => now - new Date(item.created_at).getTime() <= 30 * 86400000);
      const critical = cases.filter((item) => item.severity === 'critical').length;
      const high = cases.filter((item) => item.severity === 'high').length;
      const open = cases.filter((item) => !['resolved', 'dismissed'].includes(item.status)).length;
      const score = Math.min(
        30,
        recent30.length * 2 +
        critical * 5 +
        high * 3 +
        warnings.length +
        open * 2,
      );

      return {
        query,
        userId,
        displayName,
        cases,
        notes,
        tickets,
        warnings,
        summary: {
          totalCases: cases.length,
          activeCases: open,
          criticalCases: critical,
          tickets: tickets.length,
          warnings: warnings.length,
          riskScore: score,
          riskLabel: riskLabel(score),
        },
      };
    },
    onError: (error) => toast.error(error.message),
  });

  const openCases = (casesQuery.data ?? []).filter((item) => !['resolved', 'dismissed'].includes(item.status));
  const pendingAppeals = (appealsQuery.data ?? []).filter((item) => ['pending', 'needs_info'].includes(item.status));
  const openAlerts = (alertsQuery.data ?? []).filter((item) => item.status !== 'resolved');
  const unhealthyCommands = (healthQuery.data ?? []).filter((item) =>
    Number(item.executions ?? 0) >= 3 &&
    (Number(item.error_rate ?? 0) >= 20 || Number(item.avg_latency_ms ?? 0) >= 5000),
  );

  return {
    guildId,
    cases: casesQuery.data ?? [],
    openCases,
    appeals: appealsQuery.data ?? [],
    pendingAppeals,
    alerts: alertsQuery.data ?? [],
    openAlerts,
    workflows: workflowsQuery.data ?? [],
    profiles: profilesQuery.data ?? [],
    presets: presetsQuery.data ?? [],
    audit: auditQuery.data ?? [],
    staff: staffQuery.data ?? [],
    commandHealth: healthQuery.data ?? [],
    unhealthyCommands,
    scheduledModeration: scheduledModerationQuery.data ?? [],
    isLoading:
      casesQuery.isLoading ||
      appealsQuery.isLoading ||
      alertsQuery.isLoading ||
      workflowsQuery.isLoading ||
      profilesQuery.isLoading ||
      staffQuery.isLoading ||
      healthQuery.isLoading,
    updateCase,
    addEvidence,
    updateAppeal,
    updateAlert,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    createProfile,
    applyProfile,
    createPreset,
    applyPresetRules,
    undoAudit,
    searchUser,
  };
}

export function useCaseEvidence(caseId: string | null) {
  const { selectedGuild } = useGuild();
  return useQuery({
    queryKey: ['case-evidence', caseId],
    queryFn: async () => {
      if (!caseId || !selectedGuild?.id) return [];
      const { data, error } = await supabase
        .from('moderation_evidence')
        .select('*')
        .eq('guild_id', selectedGuild.id)
        .eq('case_id', caseId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!caseId && !!selectedGuild?.id,
  });
}
