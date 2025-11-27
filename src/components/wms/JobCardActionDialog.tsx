import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { JobCard } from "@shared/types";
import { Upload, CheckCircle, XCircle, FileText, Calendar, User } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useAuthStore } from "@/stores/authStore";

interface JobCardActionDialogProps {
  card: JobCard | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function JobCardActionDialog({ card, isOpen, onClose, onUpdate }: JobCardActionDialogProps) {
  const user = useAuthStore(state => state.user);
  const canQC = user?.permissions.includes('manage:qc') ?? false;
  
  const [documentUrl, setDocumentUrl] = useState("");
  const [qcNotes, setQcNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!card) return null;

  const handleUploadDocument = async () => {
    if (!documentUrl.trim()) {
      toast.error("Please enter a document URL");
      return;
    }

    try {
      setIsSubmitting(true);
      await api(`/api/wms/job-cards/${card.id}/upload-document`, {
        method: 'POST',
        body: JSON.stringify({
          documentUrl: documentUrl.trim(),
          userId: user?.id,
          userName: user?.name,
        }),
      });
      toast.success("Document uploaded successfully! Awaiting QC approval.");
      onUpdate();
      onClose();
      setDocumentUrl("");
    } catch (error) {
      toast.error("Failed to upload document");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQCApproval = async (approved: boolean) => {
    try {
      setIsSubmitting(true);
      await api(`/api/wms/job-cards/${card.id}/qc-approve`, {
        method: 'POST',
        body: JSON.stringify({
          approved,
          notes: qcNotes.trim() || undefined,
          userId: user?.id,
        }),
      });
      toast.success(approved ? "Job card approved and moved to Done!" : "Job card rejected and sent back to In Progress");
      onUpdate();
      onClose();
      setQcNotes("");
    } catch (error) {
      toast.error("Failed to process QC approval");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Show document upload interface for In Progress cards without documents
  const showUploadInterface = card.status === 'In Progress' && !card.documentUrl;
  
  // Show QC approval interface for Awaiting QC cards
  const showQCInterface = card.status === 'Awaiting QC' && canQC;
  
  // Show read-only document info for cards with documents
  const showDocumentInfo = card.documentUrl && !showQCInterface;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {card.title}
            <Badge variant={
              card.status === 'To Do' ? 'secondary' : 
              card.status === 'In Progress' ? 'default' : 
              card.status === 'Awaiting QC' ? 'outline' : 
              'default'
            } className={card.status === 'Done' ? 'bg-green-600' : ''}>
              {card.status}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {card.description || 'No description provided'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {card.orderId && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Order ID: <strong>{card.orderId}</strong></span>
            </div>
          )}

          {showUploadInterface && (
            <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Upload className="h-4 w-4" />
                Upload Confirmation Document
              </div>
              <div className="space-y-2">
                <Label htmlFor="documentUrl">Document URL</Label>
                <Input
                  id="documentUrl"
                  placeholder="https://example.com/document.pdf or file path"
                  value={documentUrl}
                  onChange={(e) => setDocumentUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the URL or file path to the completed work document
                </p>
              </div>
            </div>
          )}

          {showDocumentInfo && (
            <div className="space-y-3 border rounded-lg p-4 bg-muted/50">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4" />
                Document Information
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <strong>Document:</strong>{' '}
                  <a 
                    href={card.documentUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {card.documentUrl}
                  </a>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Uploaded: {formatDate(card.documentUploadedAt)}
                </div>
                {card.qcApproved !== undefined && (
                  <>
                    <div className="flex items-center gap-2">
                      {card.qcApproved ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-green-600 font-medium">QC Approved</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-destructive" />
                          <span className="text-destructive font-medium">QC Rejected</span>
                        </>
                      )}
                    </div>
                    {card.qcApprovedAt && (
                      <div className="flex items-center gap-2 text-muted-foreground text-xs">
                        <Calendar className="h-3 w-3" />
                        {formatDate(card.qcApprovedAt)}
                      </div>
                    )}
                    {card.qcNotes && (
                      <div className="mt-2 p-2 bg-background rounded border">
                        <strong className="text-xs">QC Notes:</strong>
                        <p className="text-sm mt-1">{card.qcNotes}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {showQCInterface && (
            <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle className="h-4 w-4" />
                QC Review
              </div>
              
              <div className="space-y-2 text-sm">
                <div>
                  <strong>Document:</strong>{' '}
                  <a 
                    href={card.documentUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    View Document
                  </a>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Calendar className="h-3 w-3" />
                  Uploaded: {formatDate(card.documentUploadedAt)}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="qcNotes">QC Notes (Optional)</Label>
                <Textarea
                  id="qcNotes"
                  placeholder="Add any comments or feedback..."
                  value={qcNotes}
                  onChange={(e) => setQcNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {showUploadInterface && (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleUploadDocument} disabled={isSubmitting}>
                <Upload className="h-4 w-4 mr-2" />
                Upload & Submit for QC
              </Button>
            </>
          )}
          
          {showQCInterface && (
            <>
              <Button 
                variant="destructive" 
                onClick={() => handleQCApproval(false)} 
                disabled={isSubmitting}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button 
                onClick={() => handleQCApproval(true)} 
                disabled={isSubmitting}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
            </>
          )}
          
          {!showUploadInterface && !showQCInterface && (
            <Button onClick={onClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
