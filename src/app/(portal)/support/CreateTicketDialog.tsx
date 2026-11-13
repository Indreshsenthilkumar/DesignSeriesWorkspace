"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import {
  CATEGORIES_CONFIG,
  MODULES_CONFIG,
  PRIORITY_CONFIG,
  type TicketCategory,
  type TicketModule,
  type TicketPriority,
} from "@/lib/support";

export type StudentProfile = {
  id: string;
  name: string;
  rollNo: string;
  email: string;
  department: string;
  year: string;
  domain: string;
  mentorName: string;
};

export type FaqItem = {
  id: string;
  title: string;
  category: string;
  module: string;
  question: string;
  answer: string;
  helpfulCount: number;
  tags: string;
};

export function CreateTicketDialog({
  user,
  faqs = [],
  open,
  onClose,
  onCreated,
}: {
  user: StudentProfile;
  faqs: FaqItem[];
  open: boolean;
  onClose: () => void;
  onCreated: (ticketId: string) => void;
}) {
  const toast = useToast();

  const [category, setCategory] = useState<TicketCategory>("MISSED_OTP");
  const [subcategory, setSubcategory] = useState<string>("");
  const [moduleName, setModuleName] = useState<TicketModule>("ATTENDANCE");
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // When category changes, auto-select its default module and subcategory
  const handleCategoryChange = (cat: TicketCategory) => {
    setCategory(cat);
    const config = CATEGORIES_CONFIG[cat];
    if (config) {
      setModuleName(config.module);
      setSubcategory(config.subcategories[0] || "");
    }
  };

  // Contextual smart FAQ suggestions while typing
  const matchingFaqs = useMemo(() => {
    const text = `${subject} ${description}`.trim().toLowerCase();
    if (text.length < 5) return [];

    return faqs
      .filter((faq) => {
        const hay = `${faq.title} ${faq.question} ${faq.answer}`.toLowerCase();
        return text.split(/\s+/).some((w) => w.length > 3 && hay.includes(w));
      })
      .slice(0, 2);
  }, [subject, description, faqs]);

  const handleSubmit = async () => {
    if (!subject.trim() || subject.trim().length < 4) {
      toast.warning("Subject is too short", "Please enter at least 4 characters.");
      return;
    }
    if (!description.trim() || description.trim().length < 15) {
      toast.warning("Description is too brief", "Please provide at least 15 characters describing the issue.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          subcategory,
          subject: subject.trim(),
          description: description.trim(),
          module: moduleName,
          priority,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        toast.error("Could not create ticket", data.error);
        return;
      }

      toast.success(
        `Ticket Created: ${data.data.ticket.ticketNumber}`,
        "Your support request has been logged and assigned."
      );
      onCreated(data.data.ticket.id);
    } catch {
      toast.error("Network problem", "Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentCategoryConfig = CATEGORIES_CONFIG[category];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Create New Support Request"
      description="Submit a structured ticket for our mentors and operations team. No file attachments required."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon="arrow-right"
            loading={submitting}
            disabled={subject.trim().length < 4 || description.trim().length < 15}
            onClick={handleSubmit}
          >
            Submit Request
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Student Information Banner (Auto-populated) */}
        <div
          className="rounded-[12px] border p-3.5 text-[12px]"
          style={{ background: "var(--surface-sunken)", borderColor: "var(--line-soft)" }}
        >
          <p className="font-semibold text-[12.5px]" style={{ color: "var(--text-strong)" }}>
            Student Identity
          </p>
          <div className="mt-1.5 grid grid-cols-2 gap-2 text-[11.5px] sm:grid-cols-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--text-faint)]">Name</span>
              <p className="font-medium text-[var(--text-default)]">{user.name}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--text-faint)]">Roll Number</span>
              <p className="font-mono text-[var(--text-default)]">{user.rollNo}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--text-faint)]">Department</span>
              <p className="truncate text-[var(--text-default)]">{user.department || "Design Series"}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--text-faint)]">Mentor</span>
              <p className="truncate text-[var(--text-default)]">{user.mentorName || "Design Lead"}</p>
            </div>
          </div>
        </div>

        {/* Category & Subcategory Selectors */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Request Category" htmlFor="req-cat" required>
            <Select
              id="req-cat"
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as TicketCategory)}
            >
              {(Object.keys(CATEGORIES_CONFIG) as TicketCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORIES_CONFIG[cat].label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Subcategory" htmlFor="req-subcat">
            <Select
              id="req-subcat"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
            >
              {currentCategoryConfig.subcategories.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {/* Related Module & Priority */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Related Website Module"
            htmlFor="req-module"
            help="Allows staff to trace context directly to your data."
          >
            <Select
              id="req-module"
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value as TicketModule)}
            >
              {(Object.keys(MODULES_CONFIG) as TicketModule[]).map((mod) => (
                <option key={mod} value={mod}>
                  {MODULES_CONFIG[mod].label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Priority"
            htmlFor="req-priority"
            help={`Target response: ${PRIORITY_CONFIG[priority].responseHours}h.`}
          >
            <Select
              id="req-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TicketPriority)}
            >
              <option value="LOW">Low (General guidance, non-urgent)</option>
              <option value="MEDIUM">Medium (Standard request / dispute)</option>
              <option value="HIGH">High (Session blocker / attendance cutoff)</option>
            </Select>
          </Field>
        </div>

        {/* Subject */}
        <Field
          label="Request Subject"
          htmlFor="req-subject"
          required
          hint={`${subject.length}/160`}
        >
          <Input
            id="req-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value.slice(0, 160))}
            placeholder="e.g. Hour 3 and 4 attendance not updated for Nov 12"
          />
        </Field>

        {/* Smart FAQ suggestion banner if found */}
        {matchingFaqs.length > 0 ? (
          <div
            className="rounded-[10px] border p-3 text-[12px]"
            style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}
          >
            <p className="font-semibold text-blue-900 flex items-center gap-1.5">
              <Icon name="sparkle" className="h-3.5 w-3.5 text-blue-700" />
              Helpful solution found:
            </p>
            {matchingFaqs.map((faq) => (
              <div key={faq.id} className="mt-1.5 border-t border-blue-200 pt-1">
                <span className="font-medium text-blue-800">{faq.title}</span>
                <p className="text-[11px] text-blue-700 line-clamp-2 mt-0.5">{faq.answer}</p>
              </div>
            ))}
          </div>
        ) : null}

        {/* Description */}
        <Field
          label="Detailed Description"
          htmlFor="req-desc"
          required
          hint={`${description.length}/4000`}
          help="Describe clearly what occurred, relevant dates, or slot numbers."
        >
          <Textarea
            id="req-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 4000))}
            rows={4}
            placeholder="Please detail your question or issue with relevant facts (dates, times, error notices)…"
          />
        </Field>

        <p className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
          <Icon name="info" className="h-3.5 w-3.5 shrink-0" />
          Support requests are handled asynchronously. You will receive an in-app notice when staff replies.
        </p>
      </div>
    </Modal>
  );
}
