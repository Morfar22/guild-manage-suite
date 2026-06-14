import { useState, useEffect } from 'react';
import { Plus, FileText, Settings, Send, Trash2, Edit, ToggleLeft, ToggleRight, LayoutTemplate, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ChannelSelect } from '@/components/ui/channel-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApplicationForms, useCreateApplicationForm, useUpdateApplicationForm, useDeleteApplicationForm, ApplicationForm } from '@/hooks/useApplicationForms';
import { useApplicationSettings, useUpsertApplicationSettings } from '@/hooks/useApplicationSettings';
import { useSendApplicationPanel } from '@/hooks/useApplicationSubmissions';
import { useNavigate } from 'react-router-dom';
import { APPLICATION_TEMPLATES, ApplicationFormTemplate } from '@/components/applications/FormTemplates';
import { toast } from 'sonner';

export default function ApplicationSettingsPage() {
  const navigate = useNavigate();
  const { data: forms, isLoading: formsLoading } = useApplicationForms();
  const { data: settings } = useApplicationSettings();
  const createForm = useCreateApplicationForm();
  const updateForm = useUpdateApplicationForm();
  const deleteForm = useDeleteApplicationForm();
  const upsertSettings = useUpsertApplicationSettings();
  const sendPanel = useSendApplicationPanel();

  const [newFormName, setNewFormName] = useState('');
  const [newFormEmoji, setNewFormEmoji] = useState('📝');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  const [panelChannelId, setPanelChannelId] = useState('');
  const [logChannelId, setLogChannelId] = useState('');
  const [panelType, setPanelType] = useState<'buttons' | 'dropdown'>('buttons');
  const [dmOnSubmit, setDmOnSubmit] = useState(true);
  const [dmOnApproval, setDmOnApproval] = useState(true);
  const [dmOnDenial, setDmOnDenial] = useState(true);
  const [approvalMessage, setApprovalMessage] = useState('Congratulations! Your {form_name} application has been approved.');
  const [denialMessage, setDenialMessage] = useState('Unfortunately, your {form_name} application has been denied.');

  useEffect(() => {
    if (settings) {
      setPanelChannelId(settings.panel_channel_id || '');
      setLogChannelId(settings.log_channel_id || '');
      setPanelType(settings.panel_type || 'buttons');
      setDmOnSubmit(settings.dm_on_submit);
      setDmOnApproval(settings.dm_on_approval);
      setDmOnDenial(settings.dm_on_denial);
      setApprovalMessage(settings.approval_message || 'Congratulations! Your {form_name} application has been approved.');
      setDenialMessage(settings.denial_message || 'Unfortunately, your {form_name} application has been denied.');
    }
  }, [settings]);

  const handleCreateForm = async () => {
    if (!newFormName.trim()) return;

    await createForm.mutateAsync({
      name: newFormName,
      emoji: newFormEmoji || '📝',
      questions: [],
    });

    setNewFormName('');
    setNewFormEmoji('📝');
    setCreateDialogOpen(false);
  };

  const handleUseTemplate = async (tpl: ApplicationFormTemplate) => {
    const withIds = tpl.questions.map(q => ({ ...q, id: Math.random().toString(36).slice(2, 11) }));
    try {
      await createForm.mutateAsync({
        name: tpl.name,
        emoji: tpl.emoji,
        description: tpl.description,
        questions: withIds as any,
      });
      setTemplateDialogOpen(false);
      toast.success(`Template "${tpl.name}" oprettet`);
    } catch (e) {
      toast.error('Kunne ikke oprette template');
    }
  };

  const handleToggleForm = async (form: ApplicationForm) => {
    await updateForm.mutateAsync({
      id: form.id,
      enabled: !form.enabled,
    });
  };

  const handleSaveSettings = async () => {
    await upsertSettings.mutateAsync({
      panel_channel_id: panelChannelId || null,
      log_channel_id: logChannelId || null,
      panel_type: panelType,
      dm_on_submit: dmOnSubmit,
      dm_on_approval: dmOnApproval,
      dm_on_denial: dmOnDenial,
      approval_message: approvalMessage,
      denial_message: denialMessage,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Applications</h1>
          <p className="text-muted-foreground">Create and manage application forms for whitelist, staff, and more</p>
        </div>
        <Button onClick={() => navigate('/dashboard/applications')}>
          <FileText className="h-4 w-4 mr-2" />
          View Submissions
        </Button>
      </div>

      <Tabs defaultValue="forms" className="space-y-4">
        <TabsList>
          <TabsTrigger value="forms">Application Forms</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="forms" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Create different application types for your server
            </p>
            <div className="flex gap-2">
            <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <LayoutTemplate className="h-4 w-4 mr-2" />
                  Use Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Vælg en template</DialogTitle>
                  <DialogDescription>
                    Færdig-byggede ansøgningsskemaer du kan bruge med det samme. Du kan altid redigere spørgsmålene bagefter.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 py-4">
                  {APPLICATION_TEMPLATES.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="flex flex-col justify-between rounded-lg border border-border/50 bg-background/50 p-4 space-y-3 hover:border-primary/50 transition-colors"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{tpl.emoji}</span>
                          <span className="font-medium text-sm">{tpl.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{tpl.description}</p>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-[10px] capitalize">{tpl.category}</Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {tpl.questions.length} spørgsmål
                          </Badge>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => handleUseTemplate(tpl)}
                        disabled={createForm.isPending}
                      >
                        Brug template
                      </Button>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Form
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Application Form</DialogTitle>
                  <DialogDescription>
                    Create a new application form. You can add questions after creating it.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Form Name</Label>
                    <Input
                      placeholder="e.g. Whitelist Application"
                      value={newFormName}
                      onChange={(e) => setNewFormName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Emoji</Label>
                    <Input
                      placeholder="📝"
                      value={newFormEmoji}
                      onChange={(e) => setNewFormEmoji(e.target.value)}
                      className="w-20"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateForm} disabled={!newFormName.trim() || createForm.isPending}>
                    Create Form
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
          </div>


          {formsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="h-20 bg-muted/50" />
                  <CardContent className="h-16" />
                </Card>
              ))}
            </div>
          ) : forms?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No application forms yet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Create your first application form to get started
                </p>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Form
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {forms?.map((form) => (
                <Card key={form.id} className={!form.enabled ? 'opacity-60' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{form.emoji}</span>
                        <CardTitle className="text-lg">{form.name}</CardTitle>
                      </div>
                      <Badge variant={form.enabled ? 'default' : 'secondary'}>
                        {form.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                    </div>
                    {form.description && (
                      <CardDescription>{form.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground mb-4">
                      {form.questions?.length || 0} questions
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/dashboard/applications/forms/${form.id}`)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleForm(form)}
                      >
                        {form.enabled ? (
                          <ToggleRight className="h-4 w-4" />
                        ) : (
                          <ToggleLeft className="h-4 w-4" />
                        )}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Form</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{form.name}"? This will also delete all submissions for this form.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteForm.mutate(form.id)}
                              className="bg-destructive text-destructive-foreground"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Panel Settings
              </CardTitle>
              <CardDescription>
                Configure where the application panel is displayed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Panel Channel</Label>
                  <ChannelSelect
                    value={panelChannelId}
                    onValueChange={setPanelChannelId}
                    placeholder="Select channel for application panel"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Log Channel</Label>
                  <ChannelSelect
                    value={logChannelId}
                    onValueChange={setLogChannelId}
                    placeholder="Select channel for application logs"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Panel Type</Label>
                <Select value={panelType} onValueChange={(v) => setPanelType(v as 'buttons' | 'dropdown')}>
                  <SelectTrigger className="w-full md:w-[250px]">
                    <SelectValue placeholder="Select panel type" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="buttons">Buttons</SelectItem>
                    <SelectItem value="dropdown">Dropdown Menu</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {panelType === 'buttons' 
                    ? 'Each form gets its own button (max 25 forms)' 
                    : 'All forms in a single dropdown menu'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    await handleSaveSettings();
                    await sendPanel.mutateAsync();
                  }}
                  disabled={!panelChannelId || sendPanel.isPending || upsertSettings.isPending}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Panel
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Configure when users receive DMs about their applications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>DM on Submit</Label>
                  <p className="text-sm text-muted-foreground">Send confirmation when application is submitted</p>
                </div>
                <Switch checked={dmOnSubmit} onCheckedChange={setDmOnSubmit} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>DM on Approval</Label>
                  <p className="text-sm text-muted-foreground">Notify user when their application is approved</p>
                </div>
                <Switch checked={dmOnApproval} onCheckedChange={setDmOnApproval} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>DM on Denial</Label>
                  <p className="text-sm text-muted-foreground">Notify user when their application is denied</p>
                </div>
                <Switch checked={dmOnDenial} onCheckedChange={setDmOnDenial} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Message Templates</CardTitle>
              <CardDescription>
                Customize messages sent to users. Use {'{form_name}'} for the application name, {'{user}'} for mention.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Approval Message</Label>
                <Textarea
                  value={approvalMessage}
                  onChange={(e) => setApprovalMessage(e.target.value)}
                  placeholder="Message sent when application is approved"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Denial Message</Label>
                <Textarea
                  value={denialMessage}
                  onChange={(e) => setDenialMessage(e.target.value)}
                  placeholder="Message sent when application is denied"
                  rows={3}
                />
              </div>
              <Button onClick={handleSaveSettings} disabled={upsertSettings.isPending}>
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
