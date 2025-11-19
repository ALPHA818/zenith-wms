import React, { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/wms/PageHeader";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PlusCircle, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { Job, JobStatus, JobFormData } from "@shared/types";
import { api } from "@/lib/api-client";
import { Toaster, toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/authStore";
import { JobFormSheet } from "@/components/wms/JobFormSheet";
import { useIsMobile } from "@/hooks/use-mobile";
export function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const user = useAuthStore((state) => state.user);
  const canManage = user?.permissions.includes('manage:jobs') ?? false;
  const isMobile = useIsMobile();
  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api<Job[]>('/api/wms/jobs');
      setJobs(data);
    } catch (error) {
      toast.error("Failed to fetch jobs.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);
  const handleAddJob = () => { setSelectedJob(null); setIsSheetOpen(true); };
  const handleEditJob = (job: Job) => { setSelectedJob(job); setIsSheetOpen(true); };
  const handleDeleteClick = (job: Job) => { setJobToDelete(job); setIsDeleteDialogOpen(true); };
  const handleConfirmDelete = async () => {
    if (!jobToDelete) return;
    try {
      await api(`/api/wms/jobs/${jobToDelete.id}`, { method: 'DELETE' });
      toast.success(`Job "${jobToDelete.id}" deleted successfully.`);
      fetchJobs();
    } catch (error) {
      toast.error("Failed to delete job.");
      console.error(error);
    } finally {
      setIsDeleteDialogOpen(false);
      setJobToDelete(null);
    }
  };
  const handleFormSubmit = async (data: JobFormData) => {
    try {
      const method = selectedJob ? 'PUT' : 'POST';
      const url = selectedJob ? `/api/wms/jobs/${selectedJob.id}` : '/api/wms/jobs';
      await api(url, { method, body: JSON.stringify(data) });
      toast.success(`Job "${data.id}" ${selectedJob ? 'updated' : 'created'} successfully.`);
      setIsSheetOpen(false);
      fetchJobs();
    } catch (error: any) {
      const errorMessage = error.message || "An unexpected error occurred.";
      toast.error(`Failed to save job: ${errorMessage}`);
      console.error(error);
    }
  };
  const getStatusVariant = (status: JobStatus) => {
    switch (status) {
      case 'Not Started': return 'secondary';
      case 'In Progress': return 'default';
      case 'Completed': return 'outline';
      case 'On Hold': return 'destructive';
      default: return 'outline';
    }
  };
  const renderActions = (job: Job) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleEditJob(job)}><Edit className="mr-2 h-4 w-4" /><span>Edit</span></DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleDeleteClick(job)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /><span>Delete</span></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  return (
    <AppLayout container>
      <PageHeader title="Jobs" subtitle="Oversee and manage customer jobs.">
        {canManage && (
          <Button onClick={handleAddJob} className="hover:shadow-md transition-shadow">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Job
          </Button>
        )}
      </PageHeader>
      {loading ? (
        isMobile ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardHeader><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader><TableRow>{Array.from({ length: canManage ? 6 : 5 }).map((_, i) => <TableHead key={i}><Skeleton className="h-4 w-20" /></TableHead>)}</TableRow></TableHeader>
              <TableBody>{Array.from({ length: 4 }).map((_, i) => (<TableRow key={i}>{Array.from({ length: canManage ? 6 : 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>))}</TableBody>
            </Table>
          </div>
        )
      ) : jobs.length === 0 ? (
        <div className="text-center py-12">No jobs found.</div>
      ) : isMobile ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {jobs.map(job => (
            <Card key={job.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{job.customerName}</CardTitle>
                  <p className="text-sm text-muted-foreground">{job.id}</p>
                </div>
                {canManage && renderActions(job)}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">{job.description}</p>
                <div className="flex justify-between items-center pt-2">
                  <Badge variant={getStatusVariant(job.status)}>{job.status}</Badge>
                  <span className="text-xs">Start: {new Date(job.startDate).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job ID</TableHead><TableHead>Customer</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead><TableHead>Start Date</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">{job.id}</TableCell><TableCell>{job.customerName}</TableCell><TableCell>{job.description}</TableCell>
                  <TableCell><Badge variant={getStatusVariant(job.status)}>{job.status}</Badge></TableCell>
                  <TableCell>{new Date(job.startDate).toLocaleDateString()}</TableCell>
                  {canManage && <TableCell className="text-right">{renderActions(job)}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {canManage && (
        <JobFormSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} onSubmit={handleFormSubmit} job={selectedJob} />
      )}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete job "{jobToDelete?.id}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Toaster richColors />
    </AppLayout>
  );
}