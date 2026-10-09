"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

export type OptionCategory = "DEPARTMENT" | "YEAR" | "DOMAIN" | "MENTOR";

interface OptionItem {
  id: string;
  value: string;
}

interface ManageRosterOptionsModalProps {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

const CATEGORY_TABS: Array<{ key: OptionCategory; label: string; icon: string; description: string }> = [
  {
    key: "DEPARTMENT",
    label: "Departments",
    icon: "layers",
    description: "Academic departments and branches available across student profiles and filters.",
  },
  {
    key: "YEAR",
    label: "Years / Batches",
    icon: "calendar",
    description: "Academic year levels (e.g. 1st Year, 2nd Year, 3rd Year, 4th Year, Staff).",
  },
  {
    key: "DOMAIN",
    label: "Domain Tracks",
    icon: "sparkle",
    description: "Specialization tracks (e.g. UI/UX, Full Stack, AI & ML, Mobile, DevOps).",
  },
  {
    key: "MENTOR",
    label: "Assigned Mentors",
    icon: "users",
    description: "Mentors and leads available for student task allocation and tracking.",
  },
];

export function ManageRosterOptionsModal({
  open,
  onClose,
  onChanged,
}: ManageRosterOptionsModalProps) {
  const router = useRouter();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<OptionCategory>("DEPARTMENT");
  const [optionsData, setOptionsData] = useState<{
    departments: OptionItem[];
    years: OptionItem[];
    domains: OptionItem[];
    mentors: OptionItem[];
  }>({
    departments: [],
    years: [],
    domains: [],
    mentors: [],
  });

  const [loading, setLoading] = useState(true);
  const [newValue, setNewValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchOptions = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/roster-options");
      const payload = await res.json();
      if (payload.ok) {
        setOptionsData(payload.data);
      }
    } catch {
      toast.error("Failed to load options");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchOptions();
    }
  }, [open]);

  const currentItems = () => {
    switch (activeTab) {
      case "DEPARTMENT":
        return optionsData.departments;
      case "YEAR":
        return optionsData.years;
      case "DOMAIN":
        return optionsData.domains;
      case "MENTOR":
        return optionsData.mentors;
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue.trim()) return;

    setAdding(true);
    try {
      const res = await fetch("/api/admin/roster-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: activeTab,
          value: newValue.trim(),
        }),
      });

      const payload = await res.json();
      if (!payload.ok) {
        toast.error("Failed to add", payload.error);
        return;
      }

      toast.success("Added successfully", `"${newValue.trim()}" added to ${activeTab.toLowerCase()}s.`);
      setNewValue("");
      await fetchOptions();
      onChanged?.();
      router.refresh();
    } catch {
      toast.error("Network problem", "Could not save the new entry.");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (item: OptionItem) => {
    setEditingId(item.id);
    setEditValue(item.value);
  };

  const handleUpdate = async (id: string) => {
    if (!editValue.trim()) return;

    setUpdating(true);
    try {
      const res = await fetch("/api/admin/roster-options", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          value: editValue.trim(),
          propagateToUsers: true,
        }),
      });

      const payload = await res.json();
      if (!payload.ok) {
        toast.error("Update failed", payload.error);
        return;
      }

      toast.success("Updated", `Saved changes and propagated to all existing users.`);
      setEditingId(null);
      setEditValue("");
      await fetchOptions();
      onChanged?.();
      router.refresh();
    } catch {
      toast.error("Network problem", "Failed to update item.");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (id: string, value: string) => {
    if (id.startsWith("staff-")) {
      toast.warning(
        "Staff account",
        `"${value}" is an active staff account in the portal. To remove them as mentor, update their account role in People.`
      );
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch("/api/admin/roster-options", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const payload = await res.json();
      if (!payload.ok) {
        toast.error("Delete failed", payload.error);
        return;
      }

      toast.success("Removed", `"${value}" has been deleted.`);
      await fetchOptions();
      onChanged?.();
      router.refresh();
    } catch {
      toast.error("Network problem", "Could not delete item.");
    } finally {
      setDeletingId(null);
    }
  };

  const items = currentItems();
  const activeTabMeta = CATEGORY_TABS.find((t) => t.key === activeTab)!;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manage Roster Options & Categories"
      description="Create, rename, and manage the departments, years, domain tracks, and mentors used across the portal."
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-[12px] text-[var(--text-muted)]">
            Changes immediately reflect in Add Person, filters, and profile forms.
          </span>
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-1.5 p-1 rounded-[12px] bg-[var(--surface-sunken)] border border-[var(--line-subtle)]">
          {CATEGORY_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const count =
              tab.key === "DEPARTMENT"
                ? optionsData.departments.length
                : tab.key === "YEAR"
                  ? optionsData.years.length
                  : tab.key === "DOMAIN"
                    ? optionsData.domains.length
                    : optionsData.mentors.length;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setEditingId(null);
                  setNewValue("");
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-[9px] text-[13px] font-semibold transition-all select-none ${
                  isActive
                    ? "bg-[var(--surface-raised)] text-[var(--text-strong)] shadow-xs border border-[var(--line-default)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-raised)]/40"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? "bg-[var(--accent-soft)] text-[var(--accent)] font-bold" : "bg-[var(--surface-inset)] text-[var(--text-faint)]"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab Description */}
        <p className="text-[12.5px] text-[var(--text-muted)] leading-relaxed">
          {activeTabMeta.description}
        </p>

        {/* Add New Item Input */}
        <form onSubmit={handleAdd} className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder={`Add new ${activeTabMeta.label.toLowerCase().replace(/s$/, "")} (e.g. ${
                activeTab === "DEPARTMENT"
                  ? "Cyber Security"
                  : activeTab === "YEAR"
                    ? "5th Year / Alum"
                    : activeTab === "DOMAIN"
                      ? "Blockchain & Web3"
                      : "Dr. Vikram Singh"
              })`}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              disabled={adding}
            />
          </div>
          <Button type="submit" loading={adding} disabled={!newValue.trim()} icon="plus">
            Add
          </Button>
        </form>

        {/* Item List */}
        <div className="rounded-[12px] border border-[var(--line-default)] bg-[var(--surface-raised)] overflow-hidden">
          <div className="px-3.5 py-2.5 bg-[var(--surface-sunken)] border-b border-[var(--line-soft)] flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
              Configured {activeTabMeta.label} ({items.length})
            </span>
            <span className="text-[11px] text-[var(--text-faint)]">
              Auto-syncs across portal
            </span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-[13px] text-[var(--text-muted)]">
              <Icon name="spinner" className="h-5 w-5 animate-spin mx-auto mb-2 text-[var(--accent)]" />
              Loading {activeTabMeta.label.toLowerCase()}…
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-[var(--text-muted)]">
              No entries found. Add your first {activeTabMeta.label.toLowerCase().replace(/s$/, "")} above.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--line-soft)] max-h-[320px] overflow-y-auto">
              {items.map((item) => {
                const isEditing = editingId === item.id;
                const isStaff = item.id.startsWith("staff-");

                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-[var(--surface-inset)]/40 transition-colors"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          autoFocus
                          disabled={updating}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleUpdate(item.id)}
                          loading={updating}
                          disabled={!editValue.trim()}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          disabled={updating}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[13px] font-semibold text-[var(--text-strong)] truncate">
                            {item.value}
                          </span>
                          {isStaff ? (
                            <Badge tone="blue" className="text-[10px] py-0.5 px-1.5">
                              Staff Account
                            </Badge>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {!isStaff && (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(item)}
                                title="Rename item (propagates to all users)"
                                className="h-7 w-7 grid place-items-center rounded-[6px] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--surface-inset)] transition-colors"
                              >
                                <Icon name="note" className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(item.id, item.value)}
                                disabled={deletingId === item.id}
                                title="Delete item"
                                className="h-7 w-7 grid place-items-center rounded-[6px] text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                              >
                                {deletingId === item.id ? (
                                  <Icon name="spinner" className="h-3.5 w-3.5 animate-spin text-red-500" />
                                ) : (
                                  <Icon name="close" className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
