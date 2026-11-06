"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { REWARD_RULES } from "@/lib/constants";
import { formatDay } from "@/lib/dates";

import { SubmitLinkedinModal, type LinkedinPostItem } from "./SubmitLinkedinModal";

export function StudentLinkedinSection({
  initialPosts = [],
}: {
  initialPosts: LinkedinPostItem[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [posts, setPosts] = useState<LinkedinPostItem[]>(initialPosts);
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const verifiedCount = posts.filter((p) => p.verified).length;
  const pendingCount = posts.length - verifiedCount;
  const pointsEarned = verifiedCount * REWARD_RULES.linkedinVerified;

  const handlePostCreated = (newPost: LinkedinPostItem) => {
    setPosts((prev) => [newPost, ...prev.filter((p) => p.id !== newPost.id)]);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    setBusyDelete(true);
    try {
      const response = await fetch("/api/linkedin", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deletingId }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        toast.error("Could not delete", payload.error);
        return;
      }
      toast.success("Post submission removed");
      setPosts((prev) => prev.filter((p) => p.id !== deletingId));
      setDeletingId(null);
      router.refresh();
    } catch {
      toast.error("Network issue", "Failed to remove post submission.");
    } finally {
      setBusyDelete(false);
    }
  };

  return (
    <>
      <Card id="linkedin-tracker" className="scroll-mt-20">
        <CardHeader
          icon="linkedin"
          title="Build in Public (LinkedIn)"
          subtitle="Document your learning journey. Every verified post earns +15 reward points."
          action={
            <Button
              size="sm"
              icon="plus"
              onClick={() => setModalOpen(true)}
            >
              Submit Post
            </Button>
          }
        />

        {/* Overview Stats */}
        <div className="mb-4 grid grid-cols-3 gap-2.5 rounded-[12px] border p-3 sm:mb-5" style={{ borderColor: "var(--line-soft)", background: "var(--surface-inset)" }}>
          <div>
            <p className="text-[17px] font-bold tabular-nums leading-none" style={{ color: "var(--text-strong)" }}>
              {posts.length}
            </p>
            <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-faint)" }}>
              Submitted
            </p>
          </div>
          <div>
            <p className="text-[17px] font-bold tabular-nums leading-none" style={{ color: "var(--color-brand-green)" }}>
              {verifiedCount}
            </p>
            <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-faint)" }}>
              Verified ({pointsEarned > 0 ? `+${pointsEarned} pts` : "0 pts"})
            </p>
          </div>
          <div>
            <p className="text-[17px] font-bold tabular-nums leading-none" style={{ color: "var(--color-brand-amber-600)" }}>
              {pendingCount}
            </p>
            <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-faint)" }}>
              Pending Review
            </p>
          </div>
        </div>

        {/* Submissions List */}
        {posts.length === 0 ? (
          <EmptyState
            tone="blue"
            icon="linkedin"
            title="No posts submitted yet"
            description="Share your work, designs, or learnings on LinkedIn with public visibility, then submit your post link here to earn reward points."
            action={
              <Button
                size="sm"
                variant="secondary"
                icon="plus"
                onClick={() => setModalOpen(true)}
              >
                Submit your first post
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {posts.map((post) => (
              <li
                key={post.id}
                data-accent={post.verified ? "green" : "amber"}
                className="surface-flat overflow-hidden rounded-[12px] border transition-colors hover:border-[var(--accent)]"
                style={{ borderColor: "var(--line-soft)" }}
              >
                <div className="flex items-stretch">
                  <span className="w-[3.5px] shrink-0" style={{ background: "var(--tone)" }} />
                  <div className="min-w-0 flex-1 p-3 sm:p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone="slate" icon="calendar">
                          {formatDay(post.postedOn, "medium")}
                        </Badge>
                        <Badge
                          tone={post.verified ? "green" : "amber"}
                          icon={post.verified ? "check-circle" : "clock"}
                        >
                          {post.verified
                            ? `Verified · +${REWARD_RULES.linkedinVerified} pts`
                            : "Pending Review"}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-7 items-center gap-1 rounded-[8px] border px-2.5 text-[11.5px] font-semibold transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                          style={{ borderColor: "var(--line-default)", color: "var(--text-strong)" }}
                        >
                          <Icon name="arrow-up-right" className="h-3 w-3" />
                          View Post
                        </a>
                        {!post.verified ? (
                          <button
                            type="button"
                            onClick={() => setDeletingId(post.id)}
                            className="grid h-7 w-7 place-items-center rounded-[8px] border transition-colors hover:border-[var(--color-brand-red)] hover:text-[var(--color-brand-red)]"
                            style={{ borderColor: "var(--line-soft)", color: "var(--text-faint)" }}
                            title="Withdraw submission"
                            aria-label="Withdraw submission"
                          >
                            <Icon name="trash" className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {post.caption ? (
                      <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed" style={{ color: "var(--text-default)" }}>
                        {post.caption}
                      </p>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      <span className="truncate font-mono" style={{ color: "var(--text-faint)" }}>
                        {post.url}
                      </span>
                      {post.verified && (post.reactions > 0 || post.comments > 0) ? (
                        <span className="ml-auto flex items-center gap-2">
                          {post.reactions > 0 ? <span>👍 {post.reactions}</span> : null}
                          {post.comments > 0 ? <span>💬 {post.comments}</span> : null}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <SubmitLinkedinModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handlePostCreated}
      />

      <ConfirmDialog
        open={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={confirmDelete}
        title="Withdraw Post Submission?"
        message="Are you sure you want to withdraw this LinkedIn post submission? You can resubmit it at any time."
        confirmLabel="Withdraw"
        destructive
        loading={busyDelete}
      />
    </>
  );
}
