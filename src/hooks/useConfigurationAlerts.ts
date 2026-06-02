import { useMemo } from 'react';
import { useGuild } from '@/contexts/GuildContext';
import { useWelcomeSettings } from './useWelcomeSettings';
import { useLevelingSettings } from './useLeveling';
import { useTicketSettings } from './useTicketSettings';
import { useTicketCategories } from './useTickets';
import { useFiveMSettings } from './useFiveM';
import { useLogSettings } from './useLogSettings';

export interface ConfigurationAlert {
  id: string;
  title: string;
  description: string;
  severity: 'warning' | 'info' | 'error';
  link: string;
  module: string;
}

export function useConfigurationAlerts() {
  const { selectedGuild } = useGuild();
  const welcomeQuery = useWelcomeSettings();
  const levelingQuery = useLevelingSettings();
  const ticketSettingsQuery = useTicketSettings();
  const ticketCategoriesQuery = useTicketCategories();
  const fivemQuery = useFiveMSettings();
  const logSettingsQuery = useLogSettings();

  const isLoading = welcomeQuery.isLoading || levelingQuery.isLoading || ticketSettingsQuery.isLoading || ticketCategoriesQuery.isLoading || fivemQuery.isLoading || logSettingsQuery.isLoading;

  const alerts = useMemo(() => {
    if (!selectedGuild || isLoading) return [];

    const result: ConfigurationAlert[] = [];
    
    const welcomeSettings = welcomeQuery.data;
    const levelingSettings = levelingQuery.data;
    const ticketSettings = ticketSettingsQuery.data;
    const ticketCategories = ticketCategoriesQuery.data;
    const fivemSettings = fivemQuery.data;
    const logSettings = logSettingsQuery.data;
    // Welcome module alerts
    if (welcomeSettings?.enabled && !welcomeSettings?.welcome_channel_id) {
      result.push({
        id: 'welcome-no-channel',
        title: 'Welcome-kanal mangler',
        description: 'Welcome-modulet er aktiveret, men der er ikke valgt en kanal til velkomstbeskeder.',
        severity: 'warning',
        link: '/dashboard/welcome',
        module: 'Welcome',
      });
    }

    // Leveling module alerts
    if (levelingSettings?.enabled && !levelingSettings?.level_up_channel_id) {
      result.push({
        id: 'leveling-no-channel',
        title: 'Level-up kanal mangler',
        description: 'Leveling er aktiveret, men der er ikke valgt en kanal til level-up beskeder.',
        severity: 'info',
        link: '/dashboard/leveling',
        module: 'Leveling',
      });
    }

    // Ticket module alerts
    if (ticketSettings && (!ticketCategories || ticketCategories.length === 0)) {
      result.push({
        id: 'tickets-no-categories',
        title: 'Ingen ticket-kategorier',
        description: 'Der er ikke oprettet nogen ticket-kategorier. Brugere kan ikke oprette tickets.',
        severity: 'warning',
        link: '/dashboard/tickets/settings',
        module: 'Tickets',
      });
    }

    // FiveM module alerts
    if (fivemSettings?.enabled) {
      if (!fivemSettings?.server_ip && !fivemSettings?.cfx_code) {
        result.push({
          id: 'fivem-no-server',
          title: 'FiveM server mangler',
          description: 'FiveM er aktiveret, men der er ikke konfigureret en server IP eller CFX kode.',
          severity: 'warning',
          link: '/dashboard/fivem',
          module: 'FiveM',
        });
      }
    }

    // Log channel alert
    if (!logSettings?.log_channel_id) {
      result.push({
        id: 'no-log-channel',
        title: 'Log-kanal ikke konfigureret',
        description: 'Der er ikke valgt en log-kanal. Bot-logs vil ikke blive sendt.',
        severity: 'info',
        link: '/dashboard/log-settings',
        module: 'Logs',
      });
    }

    return result;
  }, [selectedGuild, welcomeQuery.data, levelingQuery.data, ticketSettingsQuery.data, ticketCategoriesQuery.data, fivemQuery.data, logSettingsQuery.data, isLoading]);

  return {
    alerts,
    isLoading,
    hasAlerts: alerts.length > 0,
    warningCount: alerts.filter(a => a.severity === 'warning').length,
    errorCount: alerts.filter(a => a.severity === 'error').length,
  };
}
