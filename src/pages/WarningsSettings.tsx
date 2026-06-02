import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, AlertTriangle, Save, Plus, Trash2, Users, FileText } from 'lucide-react';
import { useWarningSettings, WarningThreshold } from '@/hooks/useWarningSettings';
import { useModerationTemplates, TemplateStep } from '@/hooks/useModerationTemplates';

export default function WarningsSettings() {
  const { settings, warningsByUser, isLoading, updateSettings, deactivateWarning } = useWarningSettings();
  const { templates, isLoading: templatesLoading, createTemplate, deleteTemplate } = useModerationTemplates();

  const [enabled, setEnabled] = useState(true);
  const [pointsPerWarn, setPointsPerWarn] = useState(1);
  const [decayDays, setDecayDays] = useState<number | null>(30);
  const [thresholds, setThresholds] = useState<WarningThreshold[]>([
    { points: 3, action: 'mute', duration_hours: 1 },
    { points: 5, action: 'mute', duration_hours: 24 },
    { points: 10, action: 'kick' },
    { points: 15, action: 'ban' },
  ]);

  // Template dialog state
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateSteps, setTemplateSteps] = useState<TemplateStep[]>([
    { points_threshold: 3, action: 'mute', duration_hours: 1 },
  ]);

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setPointsPerWarn(settings.points_per_warn);
      setDecayDays(settings.decay_days);
      setThresholds(settings.thresholds);
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate({
      enabled,
      points_per_warn: pointsPerWarn,
      decay_days: decayDays,
      thresholds,
    });
  };

  const addThreshold = () => {
    const maxPoints = Math.max(...thresholds.map((t) => t.points), 0);
    setThresholds([...thresholds, { points: maxPoints + 5, action: 'mute', duration_hours: 1 }]);
  };

  const removeThreshold = (index: number) => {
    setThresholds(thresholds.filter((_, i) => i !== index));
  };

  const updateThreshold = (index: number, updates: Partial<WarningThreshold>) => {
    setThresholds(
      thresholds.map((t, i) => (i === index ? { ...t, ...updates } : t))
    );
  };

  const addTemplateStep = () => {
    const maxPts = Math.max(...templateSteps.map((s) => s.points_threshold), 0);
    setTemplateSteps([...templateSteps, { points_threshold: maxPts + 5, action: 'mute', duration_hours: 1 }]);
  };

  const removeTemplateStep = (index: number) => {
    setTemplateSteps(templateSteps.filter((_, i) => i !== index));
  };

  const updateTemplateStep = (index: number, updates: Partial<TemplateStep>) => {
    setTemplateSteps(
      templateSteps.map((s, i) => (i === index ? { ...s, ...updates } : s))
    );
  };

  const handleCreateTemplate = () => {
    if (!templateName || templateSteps.length === 0) return;
    createTemplate.mutate(
      { name: templateName, steps: templateSteps },
      {
        onSuccess: () => {
          setTemplateOpen(false);
          setTemplateName('');
          setTemplateSteps([{ points_threshold: 3, action: 'mute', duration_hours: 1 }]);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Warning Points</h1>
        <p className="text-muted-foreground">
          Automatiseret straf baseret på advarsler med point-system
        </p>
      </div>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="settings">Indstillinger</TabsTrigger>
          <TabsTrigger value="users">Brugere ({warningsByUser.length})</TabsTrigger>
          <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* General Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Generelt
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Aktiver Warning System</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatiske straffe ved advarsler
                    </p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Points per advarsel</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={pointsPerWarn}
                      onChange={(e) => setPointsPerWarn(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Points udløber efter (dage)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={decayDays ?? ''}
                      onChange={(e) =>
                        setDecayDays(e.target.value ? parseInt(e.target.value) : null)
                      }
                      placeholder="Aldrig"
                    />
                  </div>
                </div>

                <Button onClick={handleSave} disabled={updateSettings.isPending} className="w-full">
                  {updateSettings.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Gem Indstillinger
                </Button>
              </CardContent>
            </Card>

            {/* Thresholds */}
            <Card>
              <CardHeader>
                <CardTitle>Straf Thresholds</CardTitle>
                <CardDescription>
                  Definer hvilke straffe der udløses ved specifikke point-niveauer
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {thresholds
                  .sort((a, b) => a.points - b.points)
                  .map((threshold, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 rounded-lg border p-3"
                    >
                      <Input
                        type="number"
                        min={1}
                        value={threshold.points}
                        onChange={(e) =>
                          updateThreshold(index, { points: parseInt(e.target.value) || 1 })
                        }
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">points →</span>
                      <Select
                        value={threshold.action}
                        onValueChange={(value) =>
                          updateThreshold(index, { action: value as 'mute' | 'kick' | 'ban' })
                        }
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mute">Mute</SelectItem>
                          <SelectItem value="kick">Kick</SelectItem>
                          <SelectItem value="ban">Ban</SelectItem>
                        </SelectContent>
                      </Select>
                      {threshold.action === 'mute' && (
                        <>
                          <Input
                            type="number"
                            min={1}
                            value={threshold.duration_hours ?? 1}
                            onChange={(e) =>
                              updateThreshold(index, {
                                duration_hours: parseInt(e.target.value) || 1,
                              })
                            }
                            className="w-16"
                          />
                          <span className="text-sm text-muted-foreground">timer</span>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeThreshold(index)}
                        className="ml-auto"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}

                <Button variant="outline" onClick={addThreshold} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Tilføj Threshold
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Brugere med advarsler
              </CardTitle>
            </CardHeader>
            <CardContent>
              {warningsByUser.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground/30" />
                  <p className="mt-4 text-muted-foreground">
                    Ingen aktive advarsler
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bruger</TableHead>
                      <TableHead>Total Points</TableHead>
                      <TableHead>Advarsler</TableHead>
                      <TableHead>Seneste</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {warningsByUser
                      .sort((a, b) => b.total_points - a.total_points)
                      .map((user) => (
                        <TableRow key={user.user_id}>
                          <TableCell className="font-medium">
                            {user.user_name ?? user.user_id}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                user.total_points >= 10
                                  ? 'destructive'
                                  : user.total_points >= 5
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {user.total_points} points
                            </Badge>
                          </TableCell>
                          <TableCell>{user.warnings.length}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {user.warnings[0]?.reason?.substring(0, 30) ?? 'Ingen grund'}...
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Moderation Templates</h2>
                <p className="text-sm text-muted-foreground">
                  Foruddefinerede eskaleringsregler for automatisk straf
                </p>
              </div>
              <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Ny Template
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Opret Template</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Template Navn</Label>
                      <Input
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="F.eks. Standard Eskalering"
                      />
                    </div>

                    <div className="space-y-3">
                      <Label>Trin</Label>
                      {templateSteps.map((step, index) => (
                        <div key={index} className="flex items-center gap-2 rounded-lg border p-3">
                          <Input
                            type="number"
                            min={1}
                            value={step.points_threshold}
                            onChange={(e) =>
                              updateTemplateStep(index, {
                                points_threshold: parseInt(e.target.value) || 1,
                              })
                            }
                            className="w-20"
                            placeholder="Points"
                          />
                          <span className="text-xs text-muted-foreground">pts →</span>
                          <Select
                            value={step.action}
                            onValueChange={(v) =>
                              updateTemplateStep(index, { action: v as 'mute' | 'kick' | 'ban' })
                            }
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="mute">Mute</SelectItem>
                              <SelectItem value="kick">Kick</SelectItem>
                              <SelectItem value="ban">Ban</SelectItem>
                            </SelectContent>
                          </Select>
                          {step.action === 'mute' && (
                            <>
                              <Input
                                type="number"
                                min={1}
                                value={step.duration_hours ?? 1}
                                onChange={(e) =>
                                  updateTemplateStep(index, {
                                    duration_hours: parseInt(e.target.value) || 1,
                                  })
                                }
                                className="w-16"
                              />
                              <span className="text-xs text-muted-foreground">t</span>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTemplateStep(index)}
                            disabled={templateSteps.length <= 1}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={addTemplateStep}>
                        <Plus className="mr-2 h-3 w-3" />
                        Tilføj Trin
                      </Button>
                    </div>

                    <Button
                      onClick={handleCreateTemplate}
                      disabled={!templateName || createTemplate.isPending}
                      className="w-full"
                    >
                      {createTemplate.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Opret Template
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {templatesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : templates.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/30" />
                  <p className="mt-4 text-muted-foreground">Ingen templates oprettet endnu</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {templates.map((template) => (
                  <Card key={template.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteTemplate.mutate(template.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <CardDescription>{template.steps.length} trin</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {template.steps
                          .sort((a, b) => a.points_threshold - b.points_threshold)
                          .map((step, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <Badge variant="outline">{step.points_threshold} pts</Badge>
                              <span className="text-muted-foreground">→</span>
                              <Badge
                                variant={
                                  step.action === 'ban'
                                    ? 'destructive'
                                    : step.action === 'kick'
                                    ? 'default'
                                    : 'secondary'
                                }
                              >
                                {step.action}
                                {step.action === 'mute' && step.duration_hours
                                  ? ` (${step.duration_hours}t)`
                                  : ''}
                              </Badge>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
