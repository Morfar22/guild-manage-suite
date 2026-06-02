import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Mic, Trash2, Save, Loader2, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { JTCTrigger, UpdateJTCTriggerInput } from '@/hooks/useJTCTriggers';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface JTCTriggerCardProps {
  trigger: JTCTrigger;
  voiceChannels: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  onUpdate: (input: UpdateJTCTriggerInput) => void;
  onDelete: (triggerId: string) => void;
  isUpdating: boolean;
  isDeleting: boolean;
}

export function JTCTriggerCard({
  trigger,
  voiceChannels,
  categories,
  roles,
  onUpdate,
  onDelete,
  isUpdating,
  isDeleting
}: JTCTriggerCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localTrigger, setLocalTrigger] = useState({
    name: trigger.name,
    trigger_channel_id: trigger.trigger_channel_id,
    category_id: trigger.category_id || '',
    channel_name_template: trigger.channel_name_template,
    default_user_limit: trigger.default_user_limit,
    required_role_id: trigger.required_role_id || '',
    required_role_name: trigger.required_role_name || '',
    enabled: trigger.enabled
  });
  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = <K extends keyof typeof localTrigger>(
    key: K,
    value: typeof localTrigger[K]
  ) => {
    setLocalTrigger(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleRoleChange = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    setLocalTrigger(prev => ({
      ...prev,
      required_role_id: roleId === 'none' ? '' : roleId,
      required_role_name: roleId === 'none' ? '' : (role?.name || '')
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onUpdate({
      id: trigger.id,
      name: localTrigger.name,
      trigger_channel_id: localTrigger.trigger_channel_id,
      category_id: localTrigger.category_id || null,
      channel_name_template: localTrigger.channel_name_template,
      default_user_limit: localTrigger.default_user_limit,
      required_role_id: localTrigger.required_role_id || null,
      required_role_name: localTrigger.required_role_name || null,
      enabled: localTrigger.enabled
    });
    setHasChanges(false);
  };

  const channelName = voiceChannels.find(c => c.id === trigger.trigger_channel_id)?.name || 'Ukendt kanal';

  return (
    <Card className="bg-card border-border">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Mic className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  {trigger.name}
                  {!trigger.enabled && (
                    <Badge variant="secondary" className="text-xs">Deaktiveret</Badge>
                  )}
                  {trigger.required_role_id && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Shield className="h-3 w-3" />
                      {trigger.required_role_name || 'Rolle låst'}
                    </Badge>
                  )}
                </CardTitle>
                <p className="text-sm text-muted-foreground">🔊 {channelName}</p>
              </div>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-4">
            {/* Enable Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Aktiver</Label>
                <p className="text-sm text-muted-foreground">Slå denne trigger til/fra</p>
              </div>
              <Switch
                checked={localTrigger.enabled}
                onCheckedChange={(checked) => handleChange('enabled', checked)}
              />
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label>Navn</Label>
              <Input
                value={localTrigger.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="JTC Kanal"
              />
            </div>

            {/* Trigger Channel */}
            <div className="space-y-2">
              <Label>Trigger Kanal</Label>
              <Select
                value={localTrigger.trigger_channel_id}
                onValueChange={(value) => handleChange('trigger_channel_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vælg voice kanal..." />
                </SelectTrigger>
                <SelectContent>
                  {voiceChannels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      🔊 {channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Kategori for nye kanaler</Label>
              <Select
                value={localTrigger.category_id || 'none'}
                onValueChange={(value) => handleChange('category_id', value === 'none' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vælg kategori..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ingen kategori</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      📁 {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Required Role */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Krævet Rolle
              </Label>
              <p className="text-sm text-muted-foreground">
                Kun brugere med denne rolle kan bruge denne trigger
              </p>
              <Select
                value={localTrigger.required_role_id || 'none'}
                onValueChange={handleRoleChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vælg rolle..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ingen rolle krævet</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      🛡️ {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Channel Name Template */}
            <div className="space-y-2">
              <Label>Kanal Navn Skabelon</Label>
              <Input
                value={localTrigger.channel_name_template}
                onChange={(e) => handleChange('channel_name_template', e.target.value)}
                placeholder="{username}s kanal"
              />
              <p className="text-xs text-muted-foreground">
                Preview: {localTrigger.channel_name_template.replace('{username}', 'Bruger')}
              </p>
            </div>

            {/* User Limit */}
            <div className="space-y-2">
              <Label>Standard Bruger Grænse</Label>
              <Input
                type="number"
                min={0}
                max={99}
                value={localTrigger.default_user_limit}
                onChange={(e) => handleChange('default_user_limit', parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">0 = ingen grænse</p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={!hasChanges || isUpdating}
                className="flex-1"
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Gem
                  </>
                )}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Slet trigger?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Dette vil permanent slette denne JTC trigger. Eksisterende kanaler
                      oprettet af denne trigger vil ikke blive påvirket.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuller</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(trigger.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Slet'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
