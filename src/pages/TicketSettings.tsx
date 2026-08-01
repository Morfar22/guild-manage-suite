import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTicketCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, TicketCategory } from '@/hooks/useTickets';
import CategoryForm, { CategoryFormData, defaultCategoryFormData } from '@/components/tickets/CategoryForm';
import PanelList from '@/components/tickets/PanelList';
import GeneralSettingsCard from '@/components/tickets/GeneralSettingsCard';
import TicketInsights from '@/components/tickets/TicketInsights';
import CategoryTemplates from '@/components/tickets/CategoryTemplates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, Plus, Settings, Trash2, Edit, Tag, MessageSquare, FileText, Layers, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function TicketSettings() {
  const { data: categories, isLoading } = useTicketCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TicketCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<TicketCategory | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(defaultCategoryFormData);

  const handleCreateSubmit = async () => {
    try {
      await createCategory.mutateAsync(formData);
      toast({ title: 'Category created' });
      setIsCreateOpen(false);
      setFormData(defaultCategoryFormData);
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleEditSubmit = async () => {
    if (!editingCategory) return;
    try {
      await updateCategory.mutateAsync({ id: editingCategory.id, ...formData });
      toast({ title: 'Updated' });
      setEditingCategory(null);
      setFormData(defaultCategoryFormData);
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const openEdit = (c: TicketCategory) => {
    setFormData({
      name: c.name, description: c.description || '', ticket_type: c.ticket_type,
      emoji: c.emoji, welcome_message: c.welcome_message, staff_role_id: c.staff_role_id || '',
      questions: c.questions || [],
    });
    setEditingCategory(c);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/dashboard/tickets">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ticket configuration</h1>
          <p className="text-sm text-muted-foreground">Panels, categories, ratings, transcripts and insights</p>
        </div>
      </div>

      <Tabs defaultValue="panels" className="space-y-6">
        <TabsList>
          <TabsTrigger value="panels" className="gap-2"><Layers className="h-4 w-4" /> Panels</TabsTrigger>
          <TabsTrigger value="categories" className="gap-2"><Tag className="h-4 w-4" /> Categories</TabsTrigger>
          <TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4" /> Settings</TabsTrigger>
          <TabsTrigger value="insights" className="gap-2"><BarChart3 className="h-4 w-4" /> Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="panels" className="space-y-6">
          <PanelList />
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <CategoryTemplates onUseTemplate={(t) => { setFormData(t); setIsCreateOpen(true); }} />

          <Card className="border-border/50 bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> Categories</CardTitle>
                <CardDescription>Ticket types with their own form questions and welcome message</CardDescription>
              </div>
              <Dialog open={isCreateOpen} onOpenChange={(o) => { setIsCreateOpen(o); if (!o) setFormData(defaultCategoryFormData); }}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="h-4 w-4" /> New category</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>New category</DialogTitle>
                    <DialogDescription>Add a ticket category</DialogDescription>
                  </DialogHeader>
                  <CategoryForm formData={formData} setFormData={setFormData} onSubmit={handleCreateSubmit} isLoading={createCategory.isPending} />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
              ) : (categories || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Settings className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-sm text-muted-foreground">No categories yet</p>
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full space-y-2">
                  {categories?.map((category) => (
                    <AccordionItem key={category.id} value={category.id} className="rounded-lg border border-border/50 bg-background/50 px-4">
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center gap-3 text-left">
                          <span className="text-xl">{category.emoji}</span>
                          <span className="font-medium">{category.name}</span>
                          <Badge variant="outline" className="text-xs">{category.ticket_type === 'support' ? 'Support' : 'Application'}</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4">
                        <div className="space-y-3 pt-2">
                          {category.description && <p className="text-sm text-muted-foreground">{category.description}</p>}
                          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {category.questions?.length || 0} questions</span>
                            {category.staff_role_id && <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> Role set</span>}
                          </div>
                          <div className="flex gap-2 pt-2 border-t border-border/50">
                            <Button variant="outline" size="sm" onClick={() => openEdit(category)}><Edit className="h-4 w-4 mr-2" /> Edit</Button>
                            <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeletingCategory(category)}><Trash2 className="h-4 w-4 mr-2" /> Delete</Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings"><GeneralSettingsCard /></TabsContent>

        <TabsContent value="insights"><TicketInsights /></TabsContent>
      </Tabs>

      <Dialog open={!!editingCategory} onOpenChange={(o) => { if (!o) { setEditingCategory(null); setFormData(defaultCategoryFormData); } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Edit category</DialogTitle></DialogHeader>
          <CategoryForm formData={formData} setFormData={setFormData} onSubmit={handleEditSubmit} isLoading={updateCategory.isPending} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingCategory} onOpenChange={() => setDeletingCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>"{deletingCategory?.name}" will be permanently deleted. Existing tickets keep their history.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => { if (deletingCategory) { await deleteCategory.mutateAsync(deletingCategory.id); setDeletingCategory(null); toast({ title: 'Deleted' }); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
