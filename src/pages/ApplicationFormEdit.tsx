import { useState, useEffect } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Plus, Trash2, GripVertical, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ChannelSelect } from '@/components/ui/channel-select';
import { useApplicationForm, useUpdateApplicationForm, ApplicationQuestion } from '@/hooks/useApplicationForms';
import { useDiscordRoles } from '@/hooks/useDiscordRoles';

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

export default function ApplicationFormEdit() {
  const { formId } = useParams({ from: '/dashboard/applications/forms/$formId' });
  const navigate = useNavigate();
  const { data: form, isLoading } = useApplicationForm(formId);
  const updateForm = useUpdateApplicationForm();
  const { data: roles } = useDiscordRoles();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('📝');
  const [grantedRoleId, setGrantedRoleId] = useState('');
  const [approvalChannelId, setApprovalChannelId] = useState('');
  const [denialChannelId, setDenialChannelId] = useState('');
  const [allowReapply, setAllowReapply] = useState(false);
  const [reapplyCooldown, setReapplyCooldown] = useState(24);
  const [questions, setQuestions] = useState<ApplicationQuestion[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiAutoApprove, setAiAutoApprove] = useState<number | ''>('');
  const [aiAutoDeny, setAiAutoDeny] = useState<number | ''>('');

  useEffect(() => {
    if (form) {
      setName(form.name);
      setDescription(form.description || '');
      setEmoji(form.emoji || '📝');
      setGrantedRoleId(form.granted_role_id || '');
      setApprovalChannelId(form.approval_channel_id || '');
      setDenialChannelId(form.denial_channel_id || '');
      setAllowReapply(form.allow_reapply);
      setReapplyCooldown(form.reapply_cooldown_hours || 24);
      setQuestions(form.questions || []);
      setAiEnabled(!!form.ai_screening_enabled);
      setAiPrompt(form.ai_screening_prompt || '');
      setAiAutoApprove(form.ai_auto_approve_threshold ?? '');
      setAiAutoDeny(form.ai_auto_deny_threshold ?? '');
    }
  }, [form]);

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: generateId(),
        label: '',
        type: 'short',
        required: true,
      },
    ]);
  };

  const handleUpdateQuestion = (index: number, updates: Partial<ApplicationQuestion>) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], ...updates };
    setQuestions(newQuestions);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!formId) return;

    await updateForm.mutateAsync({
      id: formId,
      name,
      description: description || null,
      emoji,
      granted_role_id: grantedRoleId || null,
      approval_channel_id: approvalChannelId || null,
      denial_channel_id: denialChannelId || null,
      allow_reapply: allowReapply,
      reapply_cooldown_hours: reapplyCooldown,
      questions: questions,
      ai_screening_enabled: aiEnabled,
      ai_screening_prompt: aiPrompt || null,
      ai_auto_approve_threshold: aiAutoApprove === '' ? null : Number(aiAutoApprove),
      ai_auto_deny_threshold: aiAutoDeny === '' ? null : Number(aiAutoDeny),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-xl font-semibold mb-2">Form not found</h2>
        <Button onClick={() => navigate({ to: '/dashboard/applications/settings' })}>
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/dashboard/applications/settings' })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Edit Form</h1>
          <p className="text-muted-foreground">Configure your application form</p>
        </div>
        <Button onClick={handleSave} disabled={updateForm.isPending}>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Basic Info</CardTitle>
            <CardDescription>Form name and appearance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_80px]">
              <div className="space-y-2">
                <Label>Form Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Whitelist Application"
                />
              </div>
              <div className="space-y-2">
                <Label>Emoji</Label>
                <Input
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  className="text-center"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this application type"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approval Settings</CardTitle>
            <CardDescription>What happens when approved</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Role to Grant</Label>
              <Select 
                value={grantedRoleId || 'none'} 
                onValueChange={(v) => setGrantedRoleId(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role to grant on approval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No role</SelectItem>
                  {roles?.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Approval Announcement Channel</Label>
              <ChannelSelect
                value={approvalChannelId}
                onValueChange={setApprovalChannelId}
                placeholder="Channel to announce approvals"
              />
            </div>
            <div className="space-y-2">
              <Label>Denial Announcement Channel</Label>
              <ChannelSelect
                value={denialChannelId}
                onValueChange={setDenialChannelId}
                placeholder="Channel to announce denials (optional)"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reapplication</CardTitle>
            <CardDescription>Allow users to apply again after denial</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Allow Reapplication</Label>
                <p className="text-sm text-muted-foreground">Users can submit new applications after denial</p>
              </div>
              <Switch checked={allowReapply} onCheckedChange={setAllowReapply} />
            </div>
            {allowReapply && (
              <div className="space-y-2">
                <Label>Cooldown (hours)</Label>
                <Input
                  type="number"
                  min={0}
                  value={reapplyCooldown}
                  onChange={(e) => setReapplyCooldown(parseInt(e.target.value) || 0)}
                />
                <p className="text-sm text-muted-foreground">
                  Time users must wait before reapplying (0 = no cooldown)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Screening</CardTitle>
            <CardDescription>Lad AI vurdere ansøgninger automatisk (kræver Applications Pro)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Aktivér AI-screening</Label>
                <p className="text-sm text-muted-foreground">Giver score, resumé og flags på hver ansøgning</p>
              </div>
              <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
            </div>
            {aiEnabled && (
              <>
                <div className="space-y-2">
                  <Label>Ekstra kontekst til AI (valgfri)</Label>
                  <Textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Fx: Vi leder efter modne ansøgere med RP-erfaring..."
                    rows={3}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Auto-godkend over (0–100)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={aiAutoApprove}
                      onChange={(e) => setAiAutoApprove(e.target.value === '' ? '' : parseInt(e.target.value))}
                      placeholder="Tom = fra"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Auto-afvis under (0–100)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={aiAutoDeny}
                      onChange={(e) => setAiAutoDeny(e.target.value === '' ? '' : parseInt(e.target.value))}
                      placeholder="Tom = fra"
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Questions</CardTitle>
              <CardDescription>Add questions that applicants need to answer</CardDescription>
            </div>
            <Button onClick={handleAddQuestion}>
              <Plus className="h-4 w-4 mr-2" />
              Add Question
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-muted-foreground mb-4">No questions yet. Add some questions for applicants to answer.</p>
              <Button variant="outline" onClick={handleAddQuestion}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Question
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((question, index) => (
                <div key={question.id} className="flex gap-4 p-4 border rounded-lg">
                  <div className="flex items-center text-muted-foreground">
                    <GripVertical className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                      <Input
                        value={question.label}
                        onChange={(e) => handleUpdateQuestion(index, { label: e.target.value })}
                        placeholder="Question text"
                      />
                      <Select
                        value={question.type}
                        onValueChange={(v) => handleUpdateQuestion(index, { type: v as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="short">Short Text</SelectItem>
                          <SelectItem value="long">Long Text</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="select">Dropdown</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`required-${question.id}`}
                          checked={question.required}
                          onCheckedChange={(v) => handleUpdateQuestion(index, { required: v })}
                        />
                        <Label htmlFor={`required-${question.id}`} className="text-sm">Required</Label>
                      </div>
                      {(question.type === 'short' || question.type === 'long') && (
                        <Input
                          className="flex-1"
                          placeholder="Placeholder text (optional)"
                          value={question.placeholder || ''}
                          onChange={(e) => handleUpdateQuestion(index, { placeholder: e.target.value })}
                        />
                      )}
                      {question.type === 'select' && (
                        <Input
                          className="flex-1"
                          placeholder="Options (comma separated)"
                          value={question.options?.join(', ') || ''}
                          onChange={(e) => handleUpdateQuestion(index, { 
                            options: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                          })}
                        />
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => handleRemoveQuestion(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
