import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Guild } from '@/types/discord';

interface GuildContextType {
  selectedGuild: Guild | null;
  setSelectedGuild: (guild: Guild | null) => void;
}

const GuildContext = createContext<GuildContextType | undefined>(undefined);

const STORAGE_KEY = 'selectedGuild';

export function GuildProvider({ children }: { children: ReactNode }) {
  const [selectedGuild, setSelectedGuildState] = useState<Guild | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Guild) : null;
    } catch {
      return null;
    }
  });

  const setSelectedGuild = (guild: Guild | null) => {
    setSelectedGuildState(guild);
    try {
      if (guild) localStorage.setItem(STORAGE_KEY, JSON.stringify(guild));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        try {
          setSelectedGuildState(e.newValue ? (JSON.parse(e.newValue) as Guild) : null);
        } catch {
          setSelectedGuildState(null);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <GuildContext.Provider value={{ selectedGuild, setSelectedGuild }}>
      {children}
    </GuildContext.Provider>
  );
}

export function useGuild() {
  const context = useContext(GuildContext);
  if (context === undefined) {
    throw new Error('useGuild must be used within a GuildProvider');
  }
  return context;
}
