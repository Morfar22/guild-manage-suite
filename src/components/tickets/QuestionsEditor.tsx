import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { CategoryQuestion } from '@/hooks/useTickets';

interface QuestionsEditorProps {
  questions: CategoryQuestion[];
  onChange: (questions: CategoryQuestion[]) => void;
}

export default function QuestionsEditor({ questions, onChange }: QuestionsEditorProps) {
  const addQuestion = () => {
    if (questions.length >= 5) return; // Discord modal limit (per interaction step)
    onChange([
      ...questions,
      { label: '', placeholder: '', required: true, style: 'short' },
    ]);
  };

  const updateQuestion = (index: number, updates: Partial<CategoryQuestion>) => {
    const updated = questions.map((q, i) => (i === index ? { ...q, ...updates } : q));
    onChange(updated);
  };

  const removeQuestion = (index: number) => {
    onChange(questions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">User Questions (max 5)</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addQuestion}
          disabled={questions.length >= 5}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No questions yet. Add questions that users must answer before creating a ticket.
        </p>
      ) : (
        <div className="space-y-4">
          {questions.map((question, index) => {
            const isSelect = question.style === 'select';
            return (
              <div
                key={index}
                className="rounded-lg border border-border/50 bg-background/50 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <GripVertical className="h-4 w-4" />
                    <span className="text-sm font-medium">Question {index + 1}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeQuestion(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-3">
                  <div>
                    <Label htmlFor={`q-label-${index}`} className="text-xs">
                      Question (max 45 characters)
                    </Label>
                    <Input
                      id={`q-label-${index}`}
                      value={question.label}
                      onChange={(e) => updateQuestion(index, { label: e.target.value.slice(0, 45) })}
                      placeholder="e.g. What is your age?"
                      maxLength={45}
                    />
                  </div>

                  {!isSelect && (
                    <div>
                      <Label htmlFor={`q-placeholder-${index}`} className="text-xs">
                        Placeholder text (optional)
                      </Label>
                      <Input
                        id={`q-placeholder-${index}`}
                        value={question.placeholder}
                        onChange={(e) => updateQuestion(index, { placeholder: e.target.value.slice(0, 100) })}
                        placeholder="e.g. Enter your age here..."
                        maxLength={100}
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label htmlFor={`q-style-${index}`} className="text-xs">
                        Answer Type
                      </Label>
                      <Select
                        value={question.style}
                        onValueChange={(v) => updateQuestion(index, {
                          style: v as CategoryQuestion['style'],
                          options: v === 'select' ? (question.options || ['Option 1', 'Option 2']) : question.options,
                        })}
                      >
                        <SelectTrigger id={`q-style-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="short">Short answer (1 line)</SelectItem>
                          <SelectItem value="paragraph">Long answer (multiple lines)</SelectItem>
                          <SelectItem value="select">Dropdown / choice list</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2 pt-5">
                      <Switch
                        id={`q-required-${index}`}
                        checked={question.required}
                        onCheckedChange={(checked) => updateQuestion(index, { required: checked })}
                      />
                      <Label htmlFor={`q-required-${index}`} className="text-xs">
                        Required
                      </Label>
                    </div>
                  </div>

                  {isSelect && (
                    <div className="space-y-2 rounded-md border border-border/50 bg-muted/30 p-3">
                      <Label className="text-xs">Options (one per line, max 25)</Label>
                      <Textarea
                        rows={4}
                        value={(question.options || []).join('\n')}
                        onChange={(e) => {
                          const opts = e.target.value
                            .split('\n')
                            .map((s) => s.trim())
                            .filter(Boolean)
                            .slice(0, 25)
                            .map((s) => s.slice(0, 100));
                          updateQuestion(index, { options: opts });
                        }}
                        placeholder={'Option 1\nOption 2\nOption 3'}
                      />
                      <div className="flex items-center gap-2 pt-1">
                        <Switch
                          id={`q-multi-${index}`}
                          checked={!!question.multi}
                          onCheckedChange={(checked) => updateQuestion(index, { multi: checked })}
                        />
                        <Label htmlFor={`q-multi-${index}`} className="text-xs">
                          Allow multiple selections (checkbox)
                        </Label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {questions.length > 0 && (
        <p className="text-xs text-muted-foreground">
          💡 Text questions show in a Discord modal. Dropdown questions are asked one at a time with select menus before the modal opens.
        </p>
      )}
    </div>
  );
}
