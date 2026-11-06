"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { REWARD_RULES } from "@/lib/constants";
import { toDayKey } from "@/lib/dates";

export type LinkedinPostItem = {
  id: string;
  url: string;
  caption?: string | null;
  postedOn: string;
  reactions: number;
  comments: number;
  verified: boolean;
  createdAt: string | Date;
};

export function SubmitLinkedinModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: (post: LinkedinPostItem) => void;
}) {
  const router = useRouter();
  const toast = useToast();

  const today = toDayKey();
  const [url, setUrl] = useState("");
  const [postedOn, setPostedOn] = useState(today);
  const [caption, setCaption] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setUrl("");
    setPostedOn(today);
    setCaption("");
    setErrors({});
  };

  const handleClose = () => {
    if (!submitting) {
      resetForm();
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};

    let cleanUrl = url.trim();
    if (!cleanUrl) {
      nextErrors.url = "Please enter your LinkedIn post URL.";
    } else {
      if (!/^https?:\/\//i.test(cleanUrl)) {
        cleanUrl = `https://${cleanUrl}`;
      }
      if (!/linkedin\.com/i.test(cleanUrl)) {
        nextErrors.url = "The URL must be a valid LinkedIn link (e.g. linkedin.com/posts/...).";
      }
    }

    if (!postedOn) {
      nextErrors.postedOn = "Please pick the date of the post.";
    } else if (postedOn > today) {
      nextErrors.postedOn = "The post date cannot be in the future.";
    }

    if (caption.length > 600) {
      nextErrors.caption = "Caption cannot exceed 600 characters.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: cleanUrl,
          postedOn,
          caption: caption.trim() || undefined,
        }),
      });

      const payload = await response.json();
      if (!payload.ok) {
        toast.error("Could not submit post", payload.error);
        if (payload.error?.toLowerCase().includes("already submitted")) {
          setErrors({ url: "You have already submitted this post." });
        }
        return;
      }

      toast.success(
        "Post submitted for verification!",
        `Once verified by your mentor, +${REWARD_RULES.linkedinVerified} points will be added to your profile.`
      );
      resetForm();
      onClose();
      if (onSuccess) {
        onSuccess(payload.data);
      }
      router.refresh();
    } catch {
      toast.error("Network issue", "Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Submit LinkedIn Post"
      description="Share your build-in-public post to earn cohort reward points."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="submit-linkedin-form"
            loading={submitting}
            icon={submitting ? undefined : "linkedin"}
          >
            Submit Post
          </Button>
        </>
      }
    >
      <form id="submit-linkedin-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Info callout */}
        <div
          data-accent="amber"
          className="flex items-start gap-3 rounded-[12px] border p-3"
          style={{ background: "var(--tone-soft)", borderColor: "var(--line-soft)" }}
        >
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px]"
            style={{ background: "var(--tone)", color: "#fff" }}
          >
            <Icon name="sparkle" className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold" style={{ color: "var(--tone)" }}>
              Earn +{REWARD_RULES.linkedinVerified} points per verified post
            </p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Post your design progress or learnings on LinkedIn with public visibility, then paste the link here. A mentor will review and verify your submission.
            </p>
          </div>
        </div>

        {/* URL field */}
        <Field
          label="LinkedIn Post URL"
          htmlFor="post-url"
          required
          error={errors.url}
          help="Direct link to your post (e.g., https://www.linkedin.com/posts/...)"
        >
          <Input
            id="post-url"
            icon="linkedin"
            type="url"
            placeholder="https://www.linkedin.com/posts/your-handle-..."
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (errors.url) setErrors((prev) => ({ ...prev, url: "" }));
            }}
            invalid={Boolean(errors.url)}
            autoFocus
          />
        </Field>

        {/* Date posted */}
        <Field
          label="Date Published"
          htmlFor="post-date"
          required
          error={errors.postedOn}
          help="The date you posted this on LinkedIn."
        >
          <Input
            id="post-date"
            icon="calendar"
            type="date"
            max={today}
            value={postedOn}
            onChange={(e) => {
              setPostedOn(e.target.value);
              if (errors.postedOn) setErrors((prev) => ({ ...prev, postedOn: "" }));
            }}
            invalid={Boolean(errors.postedOn)}
          />
        </Field>

        {/* Caption */}
        <Field
          label="What did you build or learn? (Optional)"
          htmlFor="post-caption"
          error={errors.caption}
          hint={`${caption.length}/600`}
          help="A brief summary of what's featured in the post helps reviewers verify it faster."
        >
          <Textarea
            id="post-caption"
            placeholder="e.g. Shared my UI/UX prototype for the sprint deliverable and insights on accessibility..."
            value={caption}
            maxLength={600}
            onChange={(e) => {
              setCaption(e.target.value);
              if (errors.caption) setErrors((prev) => ({ ...prev, caption: "" }));
            }}
            invalid={Boolean(errors.caption)}
          />
        </Field>
      </form>
    </Modal>
  );
}

export function SubmitLinkedinButton({
  label = "Submit LinkedIn Post",
  size = "md",
  variant = "primary",
  className,
}: {
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size={size}
        variant={variant}
        icon="linkedin"
        onClick={() => setOpen(true)}
        className={className}
      >
        {label}
      </Button>
      <SubmitLinkedinModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
