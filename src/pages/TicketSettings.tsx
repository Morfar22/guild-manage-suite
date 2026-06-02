import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTicketCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, TicketCategory } from '@/hooks/useTickets';
import PanelSettingsCard from '@/components/tickets/PanelSettingsCard';
import CategoryForm, { CategoryFormData, defaultCategoryFormData } from '@/components/tickets/CategoryForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Plus,
  Settings,
  Trash2,
  Edit,
  Tag,
  MessageSquare,
  FileText,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import CategoryTemplates from '@/components/tickets/CategoryTemplates';

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
      toast({ title: 'Category created', description: 'The new category is now active' });
      setIsCreateOpen(false);
      setFormData(defaultCategoryFormData);
    } catch {
      toast({ title: 'Error', description: 'Could not create category', variant: 'destructive' });
    }
  };

  const handleEditSubmit = async () => {
    if (!editingCategory) return;
    try {
      await updateCategory.mutateAsync({ id: editingCategory.id, ...formData });
      toast({ title: 'Category updated', description: 'Changes have been saved' });
      setEditingCategory(null);
      setFormData(defaultCategoryFormData);
    } catch {
      toast({ title: 'Error', description: 'Could not update category', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;
    try {
      await deleteCategory.mutateAsync(deletingCategory.id);
      toast({ title: 'Category deleted', description: 'The category has been removed' });
      setDeletingCategory(null);
    } catch {
      toast({ title: 'Error', description: 'Could not delete category', variant: 'destructive' });
    }
  };

  const openEdit = (category: TicketCategory) => {
    setFormData({
      name: category.name,
      description: category.description || '',
      ticket_type: category.ticket_type,
      emoji: category.emoji,
      welcome_message: category.welcome_message,
      staff_role_id: category.staff_role_id || '',
      questions: category.questions || [],
    });
    setEditingCategory(category);
  };

  const handleCreateOpenChange = (open: boolean) => {
    setIsCreateOpen(open);
    if (!open) {
      setFormData(defaultCategoryFormData);
    }
  };

  const handleEditOpenChange = (open: boolean) => {
    if (!open) {
      setEditingCategory(null);
      setFormData(defaultCategoryFormData);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/dashboard/tickets">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ticket Configuration</h1>
            <p className="text-sm text-muted-foreground">
              Set up categories and welcome messages
            </p>
          </div>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={handleCreateOpenChange}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Category
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Category</DialogTitle>
              <DialogDescription>
                Add a new ticket category to your server
              </DialogDescription>
            </DialogHeader>
            <CategoryForm 
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleCreateSubmit} 
              isLoading={createCategory.isPending} 
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Templates */}
      <CategoryTemplates
        onUseTemplate={(template) => {
          setFormData(template);
          setIsCreateOpen(true);
        }}
      />

      {/* Panel Settings */}
      <PanelSettingsCard />

      {/* Categories List */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Categories
          </CardTitle>
          <CardDescription>
            Manage your ticket categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : categories?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Settings className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No categories</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first category to get started
              </p>
              <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Category
              </Button>
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full space-y-2">
              {categories?.map((category) => (
                <AccordionItem
                  key={category.id}
                  value={category.id}
                  className="rounded-lg border border-border/50 bg-background/50 px-4"
                >
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-3 text-left">
                      <span className="text-xl">{category.emoji}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{category.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {category.ticket_type === 'support' ? 'Support' : 'Application'}
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="space-y-3 pt-2">
                      {category.description && (
                        <p className="text-sm text-muted-foreground">{category.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          Welcome message configured
                        </span>
                        {category.staff_role_id && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            Role: {category.staff_role_id}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-border/50">
                        <Button variant="outline" size="sm" onClick={() => openEdit(category)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeletingCategory(category)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={handleEditOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update category settings
            </DialogDescription>
          </DialogHeader>
          <CategoryForm 
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleEditSubmit} 
            isLoading={updateCategory.isPending} 
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingCategory} onOpenChange={() => setDeletingCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the "{deletingCategory?.name}" category. 
              Existing tickets will not be deleted, but will lose their category association.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
