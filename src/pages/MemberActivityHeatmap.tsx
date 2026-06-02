import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { Activity, Loader2, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';

const DAYS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

function getColor(value: number, max: number) {
  if (value === 0) return 'hsl(var(--muted) / 0.3)';
  const intensity = Math.min(value / Math.max(max, 1), 1);
  if (intensity < 0.25) return 'hsl(var(--primary) / 0.2)';
  if (intensity < 0.5) return 'hsl(var(--primary) / 0.4)';
  if (intensity < 0.75) return 'hsl(var(--primary) / 0.65)';
  return 'hsl(var(--primary) / 0.9)';
}

export default function MemberActivityHeatmap() {
  const { selectedGuild } = useGuild();

  const { data: events, isLoading } = useQuery({
    queryKey: ['activity-heatmap', selectedGuild?.id],
    queryFn: async () => {
      if (!selectedGuild?.id) return [];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('analytics_events')
        .select('created_at')
        .eq('guild_id', selectedGuild.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .limit(1000);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedGuild?.id,
  });

  const { heatmapData, maxValue, totalEvents, peakHour, peakDay } = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let max = 0;

    for (const event of events ?? []) {
      const d = new Date(event.created_at);
      const dayIndex = (d.getDay() + 6) % 7; // Mon=0
      const hour = d.getHours();
      grid[dayIndex][hour]++;
      if (grid[dayIndex][hour] > max) max = grid[dayIndex][hour];
    }

    // Find peak
    let peakD = 0, peakH = 0, peakVal = 0;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (grid[d][h] > peakVal) { peakVal = grid[d][h]; peakD = d; peakH = h; }
      }
    }

    return {
      heatmapData: grid,
      maxValue: max,
      totalEvents: events?.length ?? 0,
      peakHour: `${peakH.toString().padStart(2, '0')}:00`,
      peakDay: DAYS[peakD],
    };
  }, [events]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Activity className="h-8 w-8 text-primary" />
          Aktivitets Heatmap
        </h1>
        <p className="text-muted-foreground mt-1">Se hvornår din server er mest aktiv (sidste 30 dage)</p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Activity className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Total events</p>
              <p className="text-2xl font-bold">{totalEvents.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Clock className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Peak time</p>
              <p className="text-2xl font-bold">{peakDay} {peakHour}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Activity className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Max per slot</p>
              <p className="text-2xl font-bold">{maxValue}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Aktivitet per time & dag</CardTitle>
          <CardDescription>Mørkere = mere aktivitet</CardDescription>
        </CardHeader>
        <CardContent>
          {totalEvents === 0 ? (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-muted-foreground">Ingen aktivitetsdata endnu</p>
              <p className="text-sm text-muted-foreground mt-1">Data vises her, når botten tracker events</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                {/* Hour headers */}
                <div className="flex gap-1 mb-1 ml-12">
                  {HOURS.filter((_, i) => i % 2 === 0).map((h) => (
                    <div key={h} className="text-[10px] text-muted-foreground" style={{ width: '26px', textAlign: 'center' }}>
                      {h.split(':')[0]}
                    </div>
                  ))}
                </div>

                {/* Rows */}
                {DAYS.map((day, dayIndex) => (
                  <div key={day} className="flex items-center gap-1 mb-1">
                    <span className="text-xs text-muted-foreground w-10 text-right">{day}</span>
                    <div className="flex gap-[2px] ml-1">
                      {Array.from({ length: 24 }, (_, hour) => (
                        <div
                          key={hour}
                          className="rounded-sm transition-colors cursor-pointer hover:ring-1 hover:ring-primary"
                          style={{
                            width: '26px',
                            height: '26px',
                            backgroundColor: getColor(heatmapData[dayIndex][hour], maxValue),
                          }}
                          title={`${day} ${HOURS[hour]}: ${heatmapData[dayIndex][hour]} events`}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Legend */}
                <div className="flex items-center gap-2 mt-4 ml-12">
                  <span className="text-xs text-muted-foreground">Mindre</span>
                  {[0.3, 0.2, 0.4, 0.65, 0.9].map((opacity, i) => (
                    <div
                      key={i}
                      className="w-4 h-4 rounded-sm"
                      style={{ backgroundColor: i === 0 ? 'hsl(var(--muted) / 0.3)' : `hsl(var(--primary) / ${opacity})` }}
                    />
                  ))}
                  <span className="text-xs text-muted-foreground">Mere</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
