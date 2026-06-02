import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trophy, Medal, Crown, TrendingUp, MessageSquare, Star } from 'lucide-react';
import { useLeaderboard } from '@/hooks/useLeaderboard';

function xpForLevel(level: number): number {
  return level * level * 100;
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-700" />;
  return <span className="flex h-5 w-5 items-center justify-center text-xs font-bold text-muted-foreground">#{rank}</span>;
}

function getRankBg(rank: number) {
  if (rank === 1) return 'bg-yellow-500/10 border-yellow-500/30';
  if (rank === 2) return 'bg-gray-400/10 border-gray-400/30';
  if (rank === 3) return 'bg-amber-700/10 border-amber-700/30';
  return 'bg-card border-border/50';
}

export default function Leaderboard() {
  const { data: entries, isLoading } = useLeaderboard(50);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const topThree = entries?.slice(0, 3) ?? [];
  const rest = entries?.slice(3) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Trophy className="h-8 w-8 text-primary" />
          Leaderboard
        </h1>
        <p className="text-muted-foreground">Top XP-brugere og mest aktive medlemmer</p>
      </div>

      {/* Top 3 Podium */}
      {topThree.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {topThree.map((entry, i) => (
            <Card key={entry.id} className={`${getRankBg(i + 1)} transition-all hover:shadow-lg ${i === 0 ? 'md:order-2 md:scale-105' : i === 1 ? 'md:order-1' : 'md:order-3'}`}>
              <CardContent className="pt-6 text-center">
                <div className="flex justify-center mb-3">{getRankIcon(i + 1)}</div>
                <div className="w-14 h-14 mx-auto rounded-full bg-primary/20 flex items-center justify-center text-lg font-bold text-primary mb-2">
                  {(entry.discord_username ?? '?')[0].toUpperCase()}
                </div>
                <h3 className="font-bold text-lg truncate">{entry.discord_username ?? `User ${entry.user_id.slice(0, 6)}`}</h3>
                <div className="mt-2 space-y-1">
                  <Badge variant="secondary" className="text-xs">
                    <Star className="h-3 w-3 mr-1" />
                    Level {entry.level}
                  </Badge>
                  <p className="text-sm font-mono text-primary">{entry.xp.toLocaleString()} XP</p>
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {entry.total_messages.toLocaleString()} beskeder
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Rest of leaderboard */}
      {rest.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Rangering
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {rest.map((entry, i) => {
                const rank = i + 4;
                const nextLevelXp = xpForLevel(entry.level + 1);
                const currentLevelXp = xpForLevel(entry.level);
                const progress = Math.min(100, ((entry.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100);

                return (
                  <div key={entry.id} className="flex items-center gap-4 rounded-lg border border-border/50 bg-card/50 p-3 hover:bg-accent/30 transition-all">
                    <div className="w-8 text-center">
                      {getRankIcon(rank)}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                      {(entry.discord_username ?? '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{entry.discord_username ?? `User ${entry.user_id.slice(0, 6)}`}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">Lvl {entry.level}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono font-bold text-primary">{entry.xp.toLocaleString()} XP</p>
                      <p className="text-xs text-muted-foreground">{entry.total_messages.toLocaleString()} msg</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {(!entries || entries.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-muted-foreground">Ingen XP-data endnu</p>
            <p className="text-sm text-muted-foreground">Leaderboardet udfyldes når medlemmer optjener XP</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
