"use client";

import { useEffect, useMemo, useState } from "react";
import { BookMarked, LayoutGrid, List, Loader2, Plus } from "lucide-react";
import {
  deleteSubscription,
  getSubscriptions,
  updateSubscription,
  type Subscription,
} from "@/lib/api";
import DeleteModal from "./components/DeleteModal";
import SearchModal from "./components/SearchModal";
import SubscriptionList from "./components/SubscriptionList";

type SortKey =
  | "created_desc"
  | "created_asc"
  | "title_asc"
  | "title_desc"
  | "air_date_desc"
  | "air_date_asc"
  | "status_asc";

type LayoutMode = "list" | "grid";

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "created_desc", label: "Recently added" },
  { value: "created_asc", label: "Oldest added" },
  { value: "title_asc", label: "Title (A-Z)" },
  { value: "title_desc", label: "Title (Z-A)" },
  { value: "air_date_desc", label: "Air date (newest)" },
  { value: "air_date_asc", label: "Air date (oldest)" },
  { value: "status_asc", label: "Status" },
];

const SORT_STORAGE_KEY = "nas-tools:subscriptions:sort";
const LAYOUT_STORAGE_KEY = "nas-tools:subscriptions:layout";

function compareTextAsc(a?: string | null, b?: string | null) {
  const left = (a ?? "").toLowerCase();
  const right = (b ?? "").toLowerCase();
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right);
}

function compareTextDesc(a?: string | null, b?: string | null) {
  const left = (a ?? "").toLowerCase();
  const right = (b ?? "").toLowerCase();
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return right.localeCompare(left);
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("created_desc");
  const [layout, setLayout] = useState<LayoutMode>("list");
  const [deleteTarget, setDeleteTarget] = useState<Subscription | null>(null);
  const [deleteAlsoFiles, setDeleteAlsoFiles] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    try {
      const savedSort = localStorage.getItem(SORT_STORAGE_KEY) as SortKey | null;
      const savedLayout = localStorage.getItem(
        LAYOUT_STORAGE_KEY
      ) as LayoutMode | null;
      if (savedSort && sortOptions.some((opt) => opt.value === savedSort)) {
        setSortKey(savedSort);
      }
      if (savedLayout === "list" || savedLayout === "grid") {
        setLayout(savedLayout);
      }
    } catch (err) {
      console.warn("Failed to restore subscription view prefs", err);
    }
    loadSubscriptions();
  }, []);

  const isEmpty = !loading && subscriptions.length === 0;

  async function loadSubscriptions() {
    try {
      setLoading(true);
      const subs = await getSubscriptions();
      setSubscriptions(subs);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number, deleteFilesOnDisk: boolean) {
    try {
      setDeleteSubmitting(true);
      await deleteSubscription(id, { deleteFilesOnDisk });
      setSubscriptions((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    const target = deleteTarget;
    if (!target) return;
    await handleDelete(target.id, deleteAlsoFiles);
    setDeleteTarget(null);
  }

  async function handleToggle(sub: Subscription) {
    const nextStatus = sub.status === "active" ? "disabled" : "active";
    setUpdatingIds((prev) => new Set(prev).add(sub.id));
    try {
      await updateSubscription(sub.id, { status: nextStatus });
      setSubscriptions((prev) =>
        prev.map((item) =>
          item.id === sub.id ? { ...item, status: nextStatus } : item
        )
      );
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(sub.id);
        return next;
      });
    }
  }

  function handleOpenDelete(sub: Subscription) {
    setDeleteTarget(sub);
    setDeleteAlsoFiles(false);
  }

  function handleCloseSearch() {
    setShowSearch(false);
    loadSubscriptions();
  }

  const sortedSubscriptions = useMemo(() => {
    const items = [...subscriptions];
    const compareDateAsc = (a?: string | null, b?: string | null) =>
      compareTextAsc(a, b);
    const compareDateDesc = (a?: string | null, b?: string | null) =>
      compareTextDesc(a, b);
    const sorters: Record<SortKey, (a: Subscription, b: Subscription) => number> =
      {
        created_desc: (a, b) => compareDateDesc(a.created_at, b.created_at),
        created_asc: (a, b) => compareDateAsc(a.created_at, b.created_at),
        title_asc: (a, b) => compareTextAsc(a.title, b.title),
        title_desc: (a, b) => compareTextDesc(a.title, b.title),
        air_date_desc: (a, b) =>
          compareDateDesc(a.first_air_date, b.first_air_date),
        air_date_asc: (a, b) =>
          compareDateAsc(a.first_air_date, b.first_air_date),
        status_asc: (a, b) => compareTextAsc(a.status, b.status),
      };
    items.sort(sorters[sortKey]);
    return items;
  }, [subscriptions, sortKey]);

  useEffect(() => {
    try {
      localStorage.setItem(SORT_STORAGE_KEY, sortKey);
      localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
    } catch (err) {
      console.warn("Failed to persist subscription view prefs", err);
    }
  }, [sortKey, layout]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookMarked className="w-6 h-6" /> Subscriptions
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setLayout("list")}
                className={`p-2 text-sm transition-colors ${
                  layout === "list"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground"
                }`}
                title="List layout"
                aria-pressed={layout === "list"}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setLayout("grid")}
                className={`p-2 text-sm transition-colors ${
                  layout === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground"
                }`}
                title="Grid layout"
                aria-pressed={layout === "grid"}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Subscribe
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {isEmpty && (
        <div className="text-center py-20 text-muted-foreground">
          <BookMarked className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No subscriptions yet</p>
          <p className="text-sm mt-1">
            Click &quot;Subscribe&quot; to search and add media.
          </p>
        </div>
      )}

      {!loading && subscriptions.length > 0 && (
        <SubscriptionList
          subscriptions={sortedSubscriptions}
          layout={layout}
          onDelete={handleOpenDelete}
          onToggle={handleToggle}
          isUpdating={(id) => updatingIds.has(id)}
        />
      )}

      {showSearch && <SearchModal onClose={handleCloseSearch} />}

      {deleteTarget && (
        <DeleteModal
          target={deleteTarget}
          deleteAlsoFiles={deleteAlsoFiles}
          onDeleteAlsoFilesChange={setDeleteAlsoFiles}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          submitting={deleteSubmitting}
        />
      )}
    </div>
  );
}
