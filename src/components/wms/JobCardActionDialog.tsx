import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { JobCard } from "@shared/types";
import { Upload, CheckCircle, XCircle, FileText, Calendar, User, Image as ImageIcon, File, X } from "lucide-react";
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
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [qcNotes, setQcNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!card) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setUploadedFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl("");
    }

    // Clear the URL input when a file is selected
    setDocumentUrl("");
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setPreviewUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadDocument = async () => {
    // In a real app, you would upload the file to cloud storage (S3, etc.)
    // For now, we'll simulate it by creating a data URL or using the URL input
    let finalUrl = documentUrl.trim();

    if (uploadedFile) {
      // Simulate file upload - in production, upload to storage service
      if (uploadedFile.type.startsWith('image/')) {
        // For images, use the data URL as a demo
        finalUrl = previewUrl;
      } else {
        // For other files, create a mock URL
        finalUrl = `file://${uploadedFile.name}`;
      }
    }

    if (!finalUrl) {
      toast.error("Please provide a document URL or upload a file");
      return;
    }

    try {
      setIsSubmitting(true);
      await api(`/api/wms/job-cards/${card.id}/upload-document`, {
        method: 'POST',
        body: JSON.stringify({
          documentUrl: finalUrl,
          userId: user?.id,
          userName: user?.name,
        }),
      });
      toast.success("Document uploaded successfully! Awaiting QC approval.");
      onUpdate();
      onClose();
      setDocumentUrl("");
      setUploadedFile(null);
      setPreviewUrl("");
    } catch (error) {
      toast.error("Failed to upload document");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQCApproval = async (approved: boolean) => {
    // If rejecting, require a reason
    if (!approved && !qcNotes.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

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
      toast.success(approved ? "Job card approved and moved to Done!" : "Job card rejected and sent back to In Progress. Admin users have been notified.");
      onUpdate();
      onClose();
      setQcNotes("");
    } catch (error) {
      toast.error("Failed to process QC approval");
      setQcNotes("");
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

  const isImage = (url?: string) => {
    if (!url) return false;
    return url.startsWith('data:image/') || 
           /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
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
                Upload Confirmation Document or Image
              </div>
              
              <div className="space-y-4">
                {/* File Upload */}
                <div className="space-y-2">
                  <Label>Upload File</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf,.doc,.docx,.txt"
                      onChange={handleFileSelect}
                      className="cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Accepted: Images (JPG, PNG, GIF, WebP), PDF, DOC, DOCX, TXT (Max 10MB)
                  </p>
                </div>

                {/* Preview uploaded file */}
                {uploadedFile && (
                  <div className="border rounded-lg p-3 bg-background">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {previewUrl ? (
                          <ImageIcon className="h-5 w-5 text-primary flex-shrink-0" />
                        ) : (
                          <File className="h-5 w-5 text-primary flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{uploadedFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(uploadedFile.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveFile}
                        className="h-8 w-8 p-0 flex-shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {previewUrl && (
                      <div className="mt-3">
                        <img 
                          src={previewUrl} 
                          alt="Preview" 
                          className="max-w-full h-auto max-h-64 rounded border"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* OR divider */}
                {!uploadedFile && (
                  <>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-muted/50 px-2 text-muted-foreground">Or</span>
                      </div>
                    </div>

                    {/* URL Input */}
                    <div className="space-y-2">
                      <Label htmlFor="documentUrl">Document URL</Label>
                      <Input
                        id="documentUrl"
                        placeholder="https://example.com/document.pdf or image URL"
                        value={documentUrl}
                        onChange={(e) => setDocumentUrl(e.target.value)}
                        disabled={!!uploadedFile}
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter a direct link to the document or image
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {showDocumentInfo && (
            <div className="space-y-3 border rounded-lg p-4 bg-muted/50">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4" />
                {isImage(card.documentUrl) ? 'Uploaded Image' : 'Document Information'}
              </div>
              <div className="space-y-2 text-sm">
                {isImage(card.documentUrl) ? (
                  <div className="border rounded-lg overflow-hidden bg-background">
                    <img 
                      src={card.documentUrl} 
                      alt="Uploaded document" 
                      className="max-w-full h-auto max-h-96 mx-auto"
                    />
                  </div>
                ) : (
                  <div>
                    <strong>Document:</strong>{' '}
                    <a 
                      href={card.documentUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline break-all"
                    >
                      {card.documentUrl}
                    </a>
                  </div>
                )}
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
              
              <div className="space-y-3">
                {isImage(card.documentUrl) ? (
                  <div>
                    <strong className="text-sm">Uploaded Image:</strong>
                    <div className="mt-2 border rounded-lg overflow-hidden bg-background">
                      <img 
                        src={card.documentUrl} 
                        alt="Document to review" 
                        className="max-w-full h-auto max-h-96 mx-auto"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-sm">
                    <strong>Document:</strong>{' '}
                    <a 
                      href={card.documentUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline break-all"
                    >
                      View Document
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Calendar className="h-3 w-3" />
                  Uploaded: {formatDate(card.documentUploadedAt)}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="qcNotes">QC Notes {!card.qcApproved && <span className="text-destructive">*</span>}</Label>
                <Textarea
                  id="qcNotes"
                  placeholder="Required when rejecting. Add reason for rejection or feedback..."
                  value={qcNotes}
                  onChange={(e) => setQcNotes(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  * Required when rejecting the job card
                </p>
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
