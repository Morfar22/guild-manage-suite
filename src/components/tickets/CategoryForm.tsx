import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DialogFooter } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { TicketType, CategoryQuestion } from '@/hooks/useTickets';
import QuestionsEditor from './QuestionsEditor';

export interface CategoryFormData {
  name: string;
  description: string;
  ticket_type: TicketType;
  emoji: string;
  welcome_message: string;
  staff_role_id: string;
  questions: CategoryQuestion[];
}

export const defaultCategoryFormData: CategoryFormData = {
  name: '',
  description: '',
  ticket_type: 'support',
  emoji: '🎫',
  welcome_message: 'Thank you for reaching out! A staff member will assist you shortly.',
  staff_role_id: '',
  questions: [],
};

interface CategoryFormProps {
  formData: CategoryFormData;
  setFormData: (data: CategoryFormData) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export default function CategoryForm({ formData, setFormData, onSubmit, isLoading }: CategoryFormProps) {
  const isApplication = formData.ticket_type === 'application';

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. General Support"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emoji">Emoji</Label>
          <Input
            id="emoji"
            value={formData.emoji}
            onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
            placeholder="🎫"
            className="w-24"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Short description of the category"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select
            value={formData.ticket_type}
            onValueChange={(v) => setFormData({ ...formData, ticket_type: v as TicketType })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="support">Support</SelectItem>
              <SelectItem value="application">Application</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Staff Role ID (optional)</Label>
          <Input
            id="role"
            value={formData.staff_role_id}
            onChange={(e) => setFormData({ ...formData, staff_role_id: e.target.value })}
            placeholder="Discord role ID"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="welcome">Welcome Message</Label>
        <Textarea
          id="welcome"
          value={formData.welcome_message}
          onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
          placeholder="Message shown when a ticket is created"
          rows={3}
        />
      </div>

      {/* Questions section - available for all categories */}
      <Separator />
      <QuestionsEditor
        questions={formData.questions}
        onChange={(questions) => setFormData({ ...formData, questions })}
      />

      <DialogFooter className="sticky bottom-0 bg-background pt-4">
        <Button onClick={onSubmit} disabled={isLoading || !formData.name}>
          {isLoading ? 'Saving...' : 'Save'}
        </Button>
      </DialogFooter>
    </div>
  );
}
