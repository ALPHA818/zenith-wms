import React, { useEffect, useState, useMemo, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/wms/PageHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DndContext, closestCenter, DragEndEvent, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Job, JobCard, JobCardStatus, JobCardFormData } from "@shared/types";
import { api } from "@/lib/api-client";
import { Toaster, toast } from "sonner";
import { useAuthStore } from "@/stores/authStore";
import { PlusCircle, MoreHorizontal, Edit, Trash2, FileText, Upload } from "lucide-react";
import { JobCardFormSheet } from "@/components/wms/JobCardFormSheet";
import { JobCardActionDialog } from "@/components/wms/JobCardActionDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
const KANBAN_COLUMNS: JobCardStatus[] = ["To Do", "In Progress", "Awaiting QC", "Done"];
const SortableJobCard = ({ card, onEdit, onDelete, onViewActions }: { card: JobCard, onEdit: (card: JobCard) => void, onDelete: (card: JobCard) => void, onViewActions: (card: JobCard) => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: card.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  
  const hasDocument = !!card.documentUrl;
  const needsAction = (card.status === 'In Progress' && !hasDocument) || card.status === 'Awaiting QC';
  
  return (
    <Card ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-4 bg-card touch-none">
      <CardHeader className="p-4 flex flex-row items-center justify-between">
        <div className="flex-1">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            {card.title}
            {hasDocument && <FileText className="h-4 w-4 text-muted-foreground" />}
          </CardTitle>
          {card.orderId && (
            <p className="text-xs text-muted-foreground mt-1">Order: {card.orderId}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {needsAction && (
            <Button 
              variant={card.status === 'Awaiting QC' ? "default" : "outline"} 
              size="sm" 
              onClick={(e) => { e.stopPropagation(); onViewActions(card); }}
            >
              <Upload className="h-3 w-3 mr-1" />
              {card.status === 'Awaiting QC' ? 'Review' : 'Upload'}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onViewActions(card)}><FileText className="mr-2 h-4 w-4" />View Details</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(card)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(card)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      {card.description && <CardContent className="p-4 pt-0 text-sm text-muted-foreground">{card.description}</CardContent>}
    </Card>
  );
};
const KanbanColumn = ({ title, cards, onEdit, onDelete, onViewActions }: { title: string, cards: JobCard[], onEdit: (card: JobCard) => void, onDelete: (card: JobCard) => void, onViewActions: (card: JobCard) => void }) => {
  const { setNodeRef } = useSortable({ id: title });
  return (
    <div ref={setNodeRef} className="flex-1 min-w-[300px] bg-muted/50 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
        {cards.map(card => <SortableJobCard key={card.id} card={card} onEdit={onEdit} onDelete={onDelete} onViewActions={onViewActions} />)}
      </SortableContext>
    </div>
  );
};
export function JobCardsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [cards, setCards] = useState<JobCard[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [loading, setLoading] = useState({ jobs: true, cards: false });
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<JobCard | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<JobCard | null>(null);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [cardForAction, setCardForAction] = useState<JobCard | null>(null);
  const user = useAuthStore((state) => state.user);
  const canManage = user?.permissions.includes('manage:job-cards') ?? false;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const fetchJobs = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, jobs: true }));
      const data = await api<Job[]>('/api/wms/jobs');
      setJobs(data);
      if (data.length > 0 && !selectedJobId) {
        setSelectedJobId(data[0].id);
      }
    } catch (error) {
      toast.error("Failed to fetch jobs.");
    } finally {
      setLoading(prev => ({ ...prev, jobs: false }));
    }
  }, [selectedJobId]);
  const fetchCards = useCallback(async (jobId: string) => {
    if (!jobId) return;
    try {
      setLoading(prev => ({ ...prev, cards: true }));
      const data = await api<JobCard[]>(`/api/wms/job-cards?jobId=${jobId}`);
      setCards(data);
    } catch (error) {
      toast.error("Failed to fetch job cards.");
    } finally {
      setLoading(prev => ({ ...prev, cards: false }));
    }
  }, []);
  useEffect(() => { fetchJobs(); }, [fetchJobs]);
  useEffect(() => { fetchCards(selectedJobId); }, [selectedJobId, fetchCards]);
  const columns = useMemo(() => KANBAN_COLUMNS.map(status => ({
    id: status,
    cards: cards.filter(card => card.status === status)
  })), [cards]);
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeCard = cards.find(c => c.id === active.id);
    const newStatus = over.id as JobCardStatus;
    if (activeCard && activeCard.status !== newStatus) {
      const originalCards = cards;
      const updatedCards = cards.map(c => c.id === active.id ? { ...c, status: newStatus } : c);
      setCards(updatedCards);
      try {
        await api(`/api/wms/job-cards/${active.id}`, {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus }),
        });
        toast.success(`Card "${activeCard.title}" moved to ${newStatus}.`);
      } catch (error) {
        setCards(originalCards);
        toast.error("Failed to update card status.");
      }
    }
  };
  const handleAddCard = () => { setSelectedCard(null); setIsSheetOpen(true); };
  const handleEditCard = (card: JobCard) => { setSelectedCard(card); setIsSheetOpen(true); };
  const handleDeleteClick = (card: JobCard) => { setCardToDelete(card); setIsDeleteDialogOpen(true); };
  const handleViewActions = (card: JobCard) => { setCardForAction(card); setIsActionDialogOpen(true); };
  const handleConfirmDelete = async () => {
    if (!cardToDelete) return;
    try {
      await api(`/api/wms/job-cards/${cardToDelete.id}`, { method: 'DELETE' });
      toast.success(`Card "${cardToDelete.title}" deleted.`);
      fetchCards(selectedJobId);
    } catch (error) {
      toast.error("Failed to delete card.");
    } finally {
      setIsDeleteDialogOpen(false);
      setCardToDelete(null);
    }
  };
  const handleFormSubmit = async (data: JobCardFormData) => {
    try {
      const url = selectedCard ? `/api/wms/job-cards/${selectedCard.id}` : '/api/wms/job-cards';
      const method = selectedCard ? 'PUT' : 'POST';
      await api(url, { method, body: JSON.stringify(data) });
      toast.success(`Card "${data.title}" ${selectedCard ? 'updated' : 'created'}.`);
      setIsSheetOpen(false);
      fetchCards(selectedJobId);
    } catch (error) {
      toast.error("Failed to save card.");
    }
  };
  return (
    <AppLayout container contentClassName="flex flex-col h-full">
      <PageHeader title="Job Cards" subtitle="Manage and track individual job cards.">
        <div className="flex items-center gap-4">
          <Select value={selectedJobId} onValueChange={setSelectedJobId} disabled={loading.jobs}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select a job..." />
            </SelectTrigger>
            <SelectContent>
              {loading.jobs ? <SelectItem value="loading" disabled>Loading jobs...</SelectItem> :
                jobs.map(job => <SelectItem key={job.id} value={job.id}>{job.id} - {job.customerName}</SelectItem>)}
            </SelectContent>
          </Select>
          {canManage && (
            <Button onClick={handleAddCard} disabled={!selectedJobId}>
              <PlusCircle className="mr-2 h-4 w-4" /> Create Card
            </Button>
          )}
        </div>
      </PageHeader>
      {loading.cards ? (
        <div className="flex gap-6 flex-1 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map(col => (
            <div key={col} className="flex-1 min-w-[300px] space-y-4">
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="flex gap-6 flex-1 overflow-x-auto pb-4">
            {columns.map(({ id, cards }) => (
              <KanbanColumn key={id} title={id} cards={cards} onEdit={handleEditCard} onDelete={handleDeleteClick} onViewActions={handleViewActions} />
            ))}
          </div>
        </DndContext>
      )}
      {canManage && (
        <JobCardFormSheet
          isOpen={isSheetOpen}
          onClose={() => setIsSheetOpen(false)}
          onSubmit={handleFormSubmit}
          card={selectedCard}
          jobs={jobs}
          selectedJobId={selectedJobId}
        />
      )}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the card "{cardToDelete?.title}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <JobCardActionDialog 
        card={cardForAction} 
        isOpen={isActionDialogOpen} 
        onClose={() => setIsActionDialogOpen(false)} 
        onUpdate={() => fetchCards(selectedJobId)} 
      />
      <Toaster richColors />
    </AppLayout>
  );
}