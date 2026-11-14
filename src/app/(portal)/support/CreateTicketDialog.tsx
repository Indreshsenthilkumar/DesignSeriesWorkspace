"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import {
  CATEGORIES_CONFIG,
  type TicketCategory,
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
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    if (!description.trim() || description.trim().length < 10) {
      toast.warning("Description is too brief", "Please enter at least 10 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const config = CATEGORIES_CONFIG[category];
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          subcategory: "",
          subject: subject.trim(),
          description: description.trim(),
          module: config?.module || "GENERAL",
          priority: "MEDIUM",
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        toast.error("Could not create ticket", data.error);
        return;
      }

      toast.success(
        `Ticket Created: ${data.data.ticket.ticketNumber}`,
        "Your support request has been submitted to the mentors."
      );
      setSubject("");
      setDescription("");
      onCreated(data.data.ticket.id);
    } catch {
      toast.error("Network problem", "Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Create Support Request"
      description="Tell us what you need help with. A mentor will review and respond directly."
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting} className="flex-1 sm:flex-initial">
            Cancel
          </Button>
          <Button
            variant="primary"
            icon="arrow-right"
            loading={submitting}
            disabled={subject.trim().length < 4 || description.trim().length < 10}
            onClick={handleSubmit}
            className="flex-1 sm:flex-initial"
          >
            Submit Request
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Student Information Banner (Auto-filled) */}
        <div
          className="flex items-center justify-between rounded-[10px] border px-3.5 py-2.5 text-[12px]"
          style={{ background: "var(--surface-sunken)", borderColor: "var(--line-soft)" }}
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--text-strong)]">{user.name}</span>
            <span className="text-[var(--text-muted)]">({user.rollNo})</span>
          </div>
          <span className="text-[11.5px] text-[var(--text-muted)] truncate max-w-[180px]">
            {user.department || "Design Series"}
          </span>
        </div>

        {/* Category Selector */}
        <Field label="Category" htmlFor="req-cat" required>
          <Select
            id="req-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value as TicketCategory)}
          >
            {(Object.keys(CATEGORIES_CONFIG) as TicketCategory[]).map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORIES_CONFIG[cat].label}
              </option>
            ))}
          </Select>
        </Field>

        {/* Subject */}
        <Field
          label="Subject / Title"
          htmlFor="req-subject"
          required
          hint={`${subject.length}/160`}
        >
          <Input
            id="req-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value.slice(0, 160))}
            placeholder="e.g. Hour 3 and 4 attendance not updated"
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
              Frequently Asked Solution:
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
          label="Explain your issue"
          htmlFor="req-desc"
          required
          hint={`${description.length}/4000`}
        >
          <Textarea
            id="req-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 4000))}
            rows={4}
            placeholder="Describe what happened, relevant dates, slot numbers, or question…"
          />
        </Field>
      </div>
    </Modal>
  );
}
