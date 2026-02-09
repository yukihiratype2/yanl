"use client";

import { X } from "lucide-react";
import type { Subscription } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DeleteModalProps = {
  target: Subscription;
  deleteAlsoFiles: boolean;
  onDeleteAlsoFilesChange: (value: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
  submitting: boolean;
};

export default function DeleteModal({
  target,
  deleteAlsoFiles,
  onDeleteAlsoFilesChange,
  onCancel,
  onConfirm,
  submitting,
}: DeleteModalProps) {
  return (
    <Dialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !submitting) {
          onCancel();
        }
      }}
    >
      <DialogContent className="max-w-md p-0" showCloseButton={false}>
        <DialogHeader className="border-b p-5">
          <div className="flex items-center justify-between">
            <DialogTitle>Delete Subscription</DialogTitle>
            <Button
              onClick={onCancel}
              variant="ghost"
              size="icon-sm"
              disabled={submitting}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          <DialogDescription className="text-sm">
            Remove{" "}
            <span className="font-medium text-foreground">{target.title}</span>{" "}
            from subscriptions?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-5">
          <label className="flex items-start gap-3 text-sm text-foreground">
            <Checkbox
              className="mt-0.5"
              checked={deleteAlsoFiles}
              onCheckedChange={(checked) =>
                onDeleteAlsoFilesChange(checked === true)
              }
              disabled={submitting}
            />
            <span>Also delete files on disk</span>
          </label>

          {deleteAlsoFiles && (
            <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
              Folder to be removed:{" "}
              <span className="font-mono">
                {target.folder_path || "Not available"}
              </span>
            </div>
          )}
        </div>
        <DialogFooter className="border-t p-4">
          <Button
            onClick={onCancel}
            variant="outline"
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            variant="destructive"
            disabled={submitting}
          >
            {submitting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
