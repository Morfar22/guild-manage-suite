import { useState } from 'react';
import { useGuild } from '@/contexts/GuildContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  useServerTemplates,
  useExportTemplate,
  useDeleteTemplate,
  ServerTemplate,
} from '@/hooks/useServerClone';
import { useCloneWithProgress } from '@/hooks/useCloneWithProgress';
import { CloneProgressDialog } from '@/components/server-clone/CloneProgressDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Copy,
  Download,
  Upload,
  Trash2,
  Server,
  Hash,
  Users,
  FolderOpen,
  Loader2,
  Globe,
  Lock,
  ArrowRight,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { PremiumGate } from '@/components/premium/PremiumGate';

interface Guild {
  id: string;
  guild_id: string;
  guild_name: string;
  guild_icon: string | null;
}

export default function ServerClone() {
  const { selectedGuild } = useGuild();
  const { user } = useAuth();
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [selectedSourceGuild, setSelectedSourceGuild] = useState<string>('');
  const [selectedTargetGuild, setSelectedTargetGuild] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [cloneMode, setCloneMode] = useState<'guild' | 'template'>('template');
  const { data: templates, isLoading: templatesLoading } = useServerTemplates();
  const exportMutation = useExportTemplate();
  const { cloneServer, isCloning, progress } = useCloneWithProgress();
  const deleteMutation = useDeleteTemplate();

  // Fetch only guilds user has admin access to
  const { data: guilds } = useQuery({
    queryKey: ['user-guilds-for-clone', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Get guilds where user has admin permission
      const { data: userGuilds, error: ugError } = await supabase
        .from('user_guilds')
        .select('guild_id')
        .eq('user_id', user.id)
        .eq('has_admin_permission', true);
      
      if (ugError) throw ugError;
      if (!userGuilds?.length) return [];
      
      const guildIds = userGuilds.map(ug => ug.guild_id);
      
      const { data, error } = await supabase
        .from('guilds')
        .select('*')
        .in('id', guildIds)
        .order('guild_name');
      
      if (error) throw error;
      return data as Guild[];
    },
    enabled: !!user?.id,
  });

  const handleExport = async () => {
    if (!selectedGuild) {
      toast.error('Please select a guild first');
      return;
    }

    await exportMutation.mutateAsync({
      sourceGuildId: selectedGuild.id,
      templateName: templateName || `${selectedGuild.guild_name} Template`,
      templateDescription,
      isPublic,
    });

    setExportDialogOpen(false);
    setTemplateName('');
    setTemplateDescription('');
    setIsPublic(false);
  };

  const handleCloneClick = () => {
    if (!selectedTargetGuild) {
      toast.error('Please select a target guild');
      return;
    }

    if (cloneMode === 'guild' && !selectedSourceGuild) {
      toast.error('Please select a source guild');
      return;
    }

    if (cloneMode === 'template' && !selectedTemplate) {
      toast.error('Please select a template');
      return;
    }

    // Open confirmation dialog
    setCloneDialogOpen(false);
    setConfirmDialogOpen(true);
  };

  const handleConfirmClone = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }

    setConfirmDialogOpen(false);
    setDeleteConfirmText('');

    await cloneServer({
      sourceGuildId: cloneMode === 'guild' ? selectedSourceGuild : undefined,
      targetGuildId: selectedTargetGuild,
      templateId: cloneMode === 'template' ? selectedTemplate : undefined,
    });

    setSelectedSourceGuild('');
    setSelectedTargetGuild('');
    setSelectedTemplate('');
  };

  const targetGuildName = guilds?.find(g => g.id === selectedTargetGuild)?.guild_name || 'target server';

  const myTemplates = templates?.filter((t) => t.created_by === user?.id) || [];
  const publicTemplates = templates?.filter((t) => t.is_public && t.created_by !== user?.id) || [];

  return (
    <PremiumGate feature="server_clone">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Server Clone & Templates</h1>
          <p className="text-muted-foreground">
            Clone Discord server structures or create reusable templates
          </p>
        </div>
        <div className="flex gap-3">
          <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-blurple">
                <Download className="mr-2 h-4 w-4" />
                Export Template
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Export Server as Template</DialogTitle>
                <DialogDescription>
                  Save the current server's channels, categories, and roles as a reusable template.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Source Server</Label>
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3">
                    <Server className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{selectedGuild?.guild_name || 'No server selected'}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    placeholder={`${selectedGuild?.guild_name || 'My'} Template`}
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-description">Description (optional)</Label>
                  <Textarea
                    id="template-description"
                    placeholder="Describe what this template is for..."
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-base">Make Public</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow other users to use this template
                    </p>
                  </div>
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleExport}
                  disabled={exportMutation.isPending || !selectedGuild}
                  className="gradient-blurple"
                >
                  {exportMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Export Template
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Copy className="mr-2 h-4 w-4" />
                Clone Server
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Clone Server Structure</DialogTitle>
                <DialogDescription>
                  Copy channels, categories, and roles to another server.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Clone Mode Selection */}
                <div className="space-y-2">
                  <Label>Clone From</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={cloneMode === 'template' ? 'default' : 'outline'}
                      onClick={() => setCloneMode('template')}
                      className="justify-start"
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Template
                    </Button>
                    <Button
                      variant={cloneMode === 'guild' ? 'default' : 'outline'}
                      onClick={() => setCloneMode('guild')}
                      className="justify-start"
                    >
                      <Server className="mr-2 h-4 w-4" />
                      Another Server
                    </Button>
                  </div>
                </div>

                {cloneMode === 'template' ? (
                  <div className="space-y-2">
                    <Label>Select Template</Label>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates?.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            <div className="flex items-center gap-2">
                              {template.is_public ? (
                                <Globe className="h-3 w-3 text-muted-foreground" />
                              ) : (
                                <Lock className="h-3 w-3 text-muted-foreground" />
                              )}
                              {template.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Source Server</Label>
                    <Select value={selectedSourceGuild} onValueChange={setSelectedSourceGuild}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select source server..." />
                      </SelectTrigger>
                      <SelectContent>
                        {guilds?.map((guild) => (
                          <SelectItem key={guild.id} value={guild.id}>
                            {guild.guild_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center justify-center py-2">
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="space-y-2">
                  <Label>Target Server</Label>
                  <Select value={selectedTargetGuild} onValueChange={setSelectedTargetGuild}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select target server..." />
                    </SelectTrigger>
                    <SelectContent>
                      {guilds?.map((guild) => (
                        <SelectItem key={guild.id} value={guild.id}>
                          {guild.guild_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
                  <strong className="text-destructive">⚠️ Destruktiv handling:</strong>
                  <p className="mt-1 text-muted-foreground">
                    Dette vil <span className="font-semibold text-destructive">SLETTE alle eksisterende kanaler, kategorier og roller</span> i target serveren, 
                    og derefter oprette de nye fra kilden.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCloneDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCloneClick}
                  variant="destructive"
                >
                  Continue to Confirmation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* DELETE Confirmation Dialog */}
          <Dialog open={confirmDialogOpen} onOpenChange={(open) => {
            setConfirmDialogOpen(open);
            if (!open) setDeleteConfirmText('');
          }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Bekræft Destruktiv Handling
                </DialogTitle>
                <DialogDescription>
                  Du er ved at slette ALT indhold på <strong>{targetGuildName}</strong> og erstatte det med nyt.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                  <p className="text-sm font-medium text-destructive">
                    Følgende vil blive slettet:
                  </p>
                  <ul className="mt-2 list-disc list-inside text-sm text-muted-foreground">
                    <li>Alle kanaler og kategorier</li>
                    <li>Alle roller (undtagen @everyone og bot-roller)</li>
                    <li>Alle beskeder i kanalerne</li>
                  </ul>
                  <p className="mt-2 text-sm font-semibold text-destructive">
                    Denne handling kan IKKE fortrydes!
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delete-confirm">
                    Skriv <span className="font-mono font-bold text-destructive">DELETE</span> for at bekræfte:
                  </Label>
                  <Input
                    id="delete-confirm"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="font-mono"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setConfirmDialogOpen(false);
                  setDeleteConfirmText('');
                }}>
                  Annuller
                </Button>
                <Button
                  onClick={handleConfirmClone}
                  disabled={deleteConfirmText !== 'DELETE' || isCloning}
                  variant="destructive"
                >
                  {isCloning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Bekræft og Klon
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Progress Dialog */}
          <CloneProgressDialog
            open={isCloning}
            progress={progress}
            targetGuildName={targetGuildName}
          />
        </div>
      </div>

      {/* My Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            My Templates
          </CardTitle>
          <CardDescription>Templates you've created from your servers</CardDescription>
        </CardHeader>
        <CardContent>
          {templatesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : myTemplates.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <FolderOpen className="mx-auto mb-2 h-12 w-12 opacity-50" />
              <p>No templates yet</p>
              <p className="text-sm">Export a server to create your first template</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {myTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onDelete={() => deleteMutation.mutate(template.id)}
                  onUse={() => {
                    setSelectedTemplate(template.id);
                    setCloneMode('template');
                    setCloneDialogOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Public Templates */}
      {publicTemplates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Public Templates
            </CardTitle>
            <CardDescription>Templates shared by other users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {publicTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isPublic
                  onUse={() => {
                    setSelectedTemplate(template.id);
                    setCloneMode('template');
                    setCloneDialogOpen(true);
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </PremiumGate>
  );
}

interface TemplateCardProps {
  template: ServerTemplate;
  isPublic?: boolean;
  onDelete?: () => void;
  onUse: () => void;
}

function TemplateCard({ template, isPublic, onDelete, onUse }: TemplateCardProps) {
  return (
    <Card className="group transition-all hover:border-primary/50">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">{template.name}</CardTitle>
          <Badge variant={template.is_public ? 'default' : 'secondary'}>
            {template.is_public ? (
              <>
                <Globe className="mr-1 h-3 w-3" /> Public
              </>
            ) : (
              <>
                <Lock className="mr-1 h-3 w-3" /> Private
              </>
            )}
          </Badge>
        </div>
        {template.description && (
          <CardDescription className="line-clamp-2">{template.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <FolderOpen className="h-4 w-4" />
            <span>{template.categories?.length || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <Hash className="h-4 w-4" />
            <span>{template.channels?.length || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{template.roles?.length || 0}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Created {format(new Date(template.created_at), 'MMM d, yyyy')}
        </p>
        <Separator />
        <div className="flex gap-2">
          <Button onClick={onUse} size="sm" className="flex-1">
            <Upload className="mr-1 h-3 w-3" />
            Use Template
          </Button>
          {!isPublic && onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Template</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{template.name}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
