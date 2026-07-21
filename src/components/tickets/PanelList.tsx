import { useState } from 'react';
import { useTicketPanels, useCreatePanel, useUpdatePanel, useDeletePanel, useSendPanel, TicketPanel } from '@/hooks/useTicketPanels';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Send, Edit, Trash2, Layers, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PanelEditor from './PanelEditor';

export default function PanelList() {
  const { data: panels, isLoading } = useTicketPanels();
  const create = useCreatePanel();
  const update = useUpdatePanel();
  const del = useDeletePanel();
  const send = useSendPanel();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TicketPanel | null>(null);
  const [deleting, setDeleting] = useState<TicketPanel | null>(null);

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> Ticket panels</CardTitle>
          <CardDescription>Create multiple panels with custom embeds and per-panel operating hours</CardDescription>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> New panel</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (panels || []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No panels yet. Create your first one.</p>
        ) : (
          (panels || []).map((p) => (
            <div key={p.id} className="rounded-lg border border-border/40 bg-background/50 p-4 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{p.name}</span>
                  {!p.enabled && <Badge variant="outline">Disabled</Badge>}
                  {p.operating_hours?.enabled && <Badge variant="secondary">Hours</Badge>}
                  <Badge variant="outline">{p.component_style === 'buttons' ? 'Buttons' : 'Dropdown'}</Badge>
                  {p.message_id && (
                    <Badge variant="outline" className="gap-1 text-primary border-primary/50">
                      <CheckCircle2 className="h-3 w-3" /> Live
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">{p.embed_title}</p>
                <p className="text-xs text-muted-foreground">
                  {p.category_ids.length > 0 ? `${p.category_ids.length} categories` : 'All categories'}
                  {p.channel_id ? ` · channel set` : ' · no channel'}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="outline" size="sm" className="gap-1"
                  disabled={!p.channel_id || send.isPending}
                  onClick={async () => {
                    try {
                      await send.mutateAsync(p.id);
                      toast({ title: p.message_id ? 'Panel updated in Discord' : 'Panel sent to Discord' });
                    } catch (e: any) {
                      toast({ title: 'Send failed', description: e?.message || 'Check bot is online', variant: 'destructive' });
                    }
                  }}
                >
                  <Send className="h-3.5 w-3.5" /> {p.message_id ? 'Update' : 'Send'}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setEditing(p)}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleting(p)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>New panel</DialogTitle>
            <DialogDescription>Configure embed, components and operating hours</DialogDescription>
          </DialogHeader>
          <PanelEditor
            onSubmit={async (input) => {
              try {
                await create.mutateAsync(input);
                toast({ title: 'Panel created' });
                setCreateOpen(false);
              } catch {
                toast({ title: 'Create failed', variant: 'destructive' });
              }
            }}
            isLoading={create.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Edit panel</DialogTitle>
          </DialogHeader>
          {editing && (
            <PanelEditor
              initial={editing}
              onSubmit={async (input) => {
                try {
                  await update.mutateAsync({ id: editing.id, ...input });
                  toast({ title: 'Panel updated' });
                  setEditing(null);
                } catch {
                  toast({ title: 'Update failed', variant: 'destructive' });
                }
              }}
              isLoading={update.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete panel?</AlertDialogTitle>
            <AlertDialogDescription>"{deleting?.name}" will be deleted. The Discord message is not removed automatically.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => { if (deleting) { await del.mutateAsync(deleting.id); setDeleting(null); toast({ title: 'Deleted' }); } }}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
