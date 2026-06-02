import { createContext, useContext, useState, ReactNode } from 'react';
import { Guild } from '@/types/discord';

interface GuildContextType {
  selectedGuild: Guild | null;
  setSelectedGuild: (guild: Guild | null) => void;
}

const GuildContext = createContext<GuildContextType | undefined>(undefined);

export function GuildProvider({ children }: { children: ReactNode }) {
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);

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
