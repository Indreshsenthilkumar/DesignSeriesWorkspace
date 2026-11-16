"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

export type ReplyItem = {
  id: string;
  ticketId: string;
  ticketNumber: string;
  subject: string;
  senderName: string;
  message: string;
  createdAt: string;
};

// Generates an instant, crisp WhatsApp-style chime using standard Web Audio API
function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.1);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.28);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1760, now + 0.12);
    gain2.gain.setValueAtTime(0.18, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.38);
  } catch {
    // Audio autostart may be silenced if user has not interacted with DOM yet
  }
}

export function SupportNotificationListener({
  userRole,
}: {
  userRole: string;
}) {
  const router = useRouter();
  const lastCheckedRef = useRef<string>(new Date().toISOString());
  const [activeToast, setActiveToast] = useState<ReplyItem | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // If user is Staff/Admin, do not poll for incoming student queries (per rule)
  const isStaff = userRole === "MENTOR" || userRole === "ADMIN" || userRole === "SUPER_ADMIN";

  // Register service worker on mount & check notification permissions
  useEffect(() => {
    if (typeof window !== "undefined") {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      }
      if ("Notification" in window && Notification.permission === "default" && !isStaff) {
        const dismissed = sessionStorage.getItem("push_notif_prompt_dismissed");
        if (!dismissed) {
          setShowPrompt(true);
        }
      }
    }
  }, [isStaff]);

  const requestPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const res = await Notification.requestPermission();
        if (res === "granted") {
          setShowPrompt(false);
          playNotificationChime();
          if ("serviceWorker" in navigator) {
            const reg = await navigator.serviceWorker.ready;
            reg.showNotification("Live Push Notifications Active", {
              body: "You will receive instant alerts on this device when mentors reply.",
              icon: "/brand/logo-brand.png",
              badge: "/brand/logo-brand.png",
            });
          }
        } else {
          setShowPrompt(false);
        }
      } catch {
        setShowPrompt(false);
      }
    }
  };

  useEffect(() => {
    if (isStaff) return;

    let mounted = true;

    // Check for new replies from mentors
    const checkLiveReplies = async () => {
      try {
        const sinceParam = encodeURIComponent(lastCheckedRef.current);
        const res = await fetch(`/api/support/live-check?since=${sinceParam}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();

        // Update the timestamp anchor
        lastCheckedRef.current = new Date().toISOString();

        if (mounted && data.ok && Array.isArray(data.data.newReplies) && data.data.newReplies.length > 0) {
          const latestReply = data.data.newReplies[0];

          // 1. Play WhatsApp chime
          playNotificationChime();

          // 2. Trigger native device push notification via Service Worker or Notification API
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            if ("serviceWorker" in navigator) {
              navigator.serviceWorker.ready.then((reg) => {
                reg.showNotification(`Mentor Reply · ${latestReply.ticketNumber}`, {
                  body: `${latestReply.senderName}: ${latestReply.message}`,
                  icon: "/brand/logo-brand.png",
                  badge: "/brand/logo-brand.png",
                  tag: `ticket-${latestReply.ticketId}`,
                  data: { url: `/support?ticket=${latestReply.ticketId}` },
                });
              }).catch(() => {
                const notif = new Notification(`Mentor Reply · ${latestReply.ticketNumber}`, {
                  body: `${latestReply.senderName}: ${latestReply.message}`,
                  icon: "/brand/logo-brand.png",
                });
                notif.onclick = () => {
                  window.focus();
                  router.push(`/support?ticket=${latestReply.ticketId}`);
                };
              });
            } else {
              const notif = new Notification(`Mentor Reply · ${latestReply.ticketNumber}`, {
                body: `${latestReply.senderName}: ${latestReply.message}`,
                icon: "/brand/logo-brand.png",
              });
              notif.onclick = () => {
                window.focus();
                router.push(`/support?ticket=${latestReply.ticketId}`);
              };
            }
          }

          // 3. Show floating in-app WhatsApp card
          setActiveToast(latestReply);
          if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
          toastTimeoutRef.current = setTimeout(() => {
            if (mounted) setActiveToast(null);
          }, 8000);
        }
      } catch {
        // Silently retry on next poll cycle
      }
    };

    // Poll every 12 seconds
    const interval = setInterval(checkLiveReplies, 12000);

    return () => {
      mounted = false;
      clearInterval(interval);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [isStaff, router]);

  return (
    <>
      {/* Unobtrusive One-Click Device Push Permission Activation Banner for Students */}
      {showPrompt ? (
        <aside
          aria-label="Enable Push Notifications"
          className="fixed bottom-20 left-4 right-4 sm:bottom-6 sm:left-auto sm:right-6 z-[9990] flex max-w-[420px] items-center justify-between gap-3 rounded-[16px] border border-[#25D366]/50 bg-white dark:bg-[#1F2937] p-3 shadow-xl backdrop-blur-md"
          style={{
            boxShadow: "0 8px 24px rgba(37, 211, 102, 0.22), 0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
              <Icon name="bell" className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-gray-900 dark:text-gray-100">
                Turn on WhatsApp-style alerts
              </p>
              <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                Get notified instantly on this device when mentors reply.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={requestPermission}
              className="rounded-lg bg-[#25D366] px-3 py-1.5 text-[11.5px] font-bold text-white shadow-sm hover:bg-[#20ba5a] active:scale-95 transition-all cursor-pointer"
            >
              Enable
            </button>
            <button
              type="button"
              onClick={() => {
                setShowPrompt(false);
                sessionStorage.setItem("push_notif_prompt_dismissed", "1");
              }}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label="Dismiss"
            >
              <Icon name="close" className="h-3.5 w-3.5" />
            </button>
          </div>
        </aside>
      ) : null}

      {/* Floating In-App WhatsApp Notification Card */}
      {activeToast ? (
        <aside
          aria-label="New Support Message Notification"
          onClick={() => {
            const ticketId = activeToast.ticketId;
            setActiveToast(null);
            router.push(`/support?ticket=${ticketId}`);
          }}
          className="fixed right-4 top-4 z-[9999] flex w-[calc(100vw-32px)] max-w-[380px] cursor-pointer items-start gap-3 rounded-[16px] border border-[#25D366]/40 bg-white p-3.5 shadow-2xl transition-all duration-300 hover:scale-[1.02] dark:border-[#25D366]/30 dark:bg-[#1F2937]"
          style={{
            boxShadow: "0 10px 30px rgba(37, 211, 102, 0.18), 0 4px 12px rgba(0,0,0,0.08)",
          }}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-md">
            <Icon name="mail" className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[12px] font-bold text-[#128C7E] dark:text-[#25D366]">
                Mentor Reply · {activeToast.ticketNumber}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveToast(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <Icon name="close" className="h-3.5 w-3.5" />
              </button>
            </div>

            <p className="truncate text-[12px] font-semibold text-gray-900 dark:text-gray-100">
              {activeToast.senderName}
            </p>

            <p className="mt-0.5 line-clamp-2 text-[12.5px] text-gray-600 dark:text-gray-300">
              {activeToast.message}
            </p>

            <span className="mt-1 block text-[10.5px] font-medium text-blue-600 dark:text-blue-400">
              Tap to reply now →
            </span>
          </div>
        </aside>
      ) : null}
    </>
  );
}
