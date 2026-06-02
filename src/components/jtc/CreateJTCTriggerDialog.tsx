import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2, Shield } from 'lucide-react';
import { CreateJTCTriggerInput } from '@/hooks/useJTCTriggers';

interface CreateJTCTriggerDialogProps {
  voiceChannels: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  onCreate: (input: CreateJTCTriggerInput) => void;
  isCreating: boolean;
  existingTriggerChannels: string[];
}

export function CreateJTCTriggerDialog({
  voiceChannels,
  categories,
  roles,
  onCreate,
  isCreating,
  existingTriggerChannels
}: CreateJTCTriggerDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    trigger_channel_id: '',
    category_id: '',
    channel_name_template: '{username}s kanal',
    default_user_limit: 0,
    required_role_id: '',
    required_role_name: ''
  });

  const availableChannels = voiceChannels.filter(
    c => !existingTriggerChannels.includes(c.id)
  );

  const handleRoleChange = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    setFormData(prev => ({
      ...prev,
      required_role_id: roleId === 'none' ? '' : roleId,
      required_role_name: roleId === 'none' ? '' : (role?.name || '')
    }));
  };

  const handleCreate = () => {
    if (!formData.name || !formData.trigger_channel_id) return;

    onCreate({
      name: formData.name,
      trigger_channel_id: formData.trigger_channel_id,
      category_id: formData.category_id || null,
      channel_name_template: formData.channel_name_template || '{username}s kanal',
      default_user_limit: formData.default_user_limit,
      required_role_id: formData.required_role_id || null,
      required_role_name: formData.required_role_name || null
    });

    // Reset form
    setFormData({
      name: '',
      trigger_channel_id: '',
      category_id: '',
      channel_name_template: '{username}s kanal',
      default_user_limit: 0,
      required_role_id: '',
      required_role_name: ''
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Ny JTC Trigger
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Opret ny JTC Trigger</DialogTitle>
          <DialogDescription>
            Opret en ny Join to Create trigger kanal
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label>Navn *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="F.eks. Gaming, Staff, VIP..."
            />
          </div>

          {/* Trigger Channel */}
          <div className="space-y-2">
            <Label>Trigger Kanal *</Label>
            <Select
              value={formData.trigger_channel_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, trigger_channel_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vælg voice kanal..." />
              </SelectTrigger>
              <SelectContent>
                {availableChannels.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Ingen tilgængelige kanaler
                  </SelectItem>
                ) : (
                  availableChannels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      🔊 {channel.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {availableChannels.length === 0 && (
              <p className="text-xs text-destructive">
                Alle voice kanaler er allerede i brug som triggers
              </p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Kategori for nye kanaler</Label>
            <Select
              value={formData.category_id || 'none'}
              onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value === 'none' ? '' : value }))}
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
              value={formData.required_role_id || 'none'}
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
              value={formData.channel_name_template}
              onChange={(e) => setFormData(prev => ({ ...prev, channel_name_template: e.target.value }))}
              placeholder="{username}s kanal"
            />
            <p className="text-xs text-muted-foreground">
              Brug {'{username}'} for brugernavnet. Preview: {formData.channel_name_template.replace('{username}', 'Bruger')}
            </p>
          </div>

          {/* User Limit */}
          <div className="space-y-2">
            <Label>Standard Bruger Grænse</Label>
            <Input
              type="number"
              min={0}
              max={99}
              value={formData.default_user_limit}
              onChange={(e) => setFormData(prev => ({ ...prev, default_user_limit: parseInt(e.target.value) || 0 }))}
            />
            <p className="text-xs text-muted-foreground">0 = ingen grænse</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuller
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!formData.name || !formData.trigger_channel_id || isCreating}
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Opret Trigger'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
