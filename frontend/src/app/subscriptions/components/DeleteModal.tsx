"use client";

import { X } from "lucide-react";
import type { Subscription } from "@/lib/api";

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            Delete Subscription
          </h2>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground"
            disabled={submitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Remove{" "}
            <span className="font-medium text-foreground">{target.title}</span>{" "}
            from subscriptions?
          </p>

          <label className="flex items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={deleteAlsoFiles}
              onChange={(e) => onDeleteAlsoFilesChange(e.target.checked)}
              disabled={submitting}
            />
            <span>Also delete files on disk</span>
          </label>

          {deleteAlsoFiles && (
            <div className="text-xs text-muted-foreground bg-secondary/40 border border-border rounded-lg px-3 py-2">
              Folder to be removed:{" "}
              <span className="font-mono">
                {target.folder_path || "Not available"}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onCancel}
            className="px-3 py-2 text-sm rounded-lg border border-border hover:bg-secondary"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-2 text-sm rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
