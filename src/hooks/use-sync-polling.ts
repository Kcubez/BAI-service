import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const TELEGRAM_AFFECTED_QUERY_KEYS = [
  ["dashboard-stats"],
  ["action-recommendations"],
  ["demand-records"],
  ["demand-record-stats"],
  ["demand-record-recommendations"],
  ["messages"],
  ["message-stats"],
  ["senders"],
  ["customers"],
  ["customer-analytics"],
  ["business-reports"],
  ["finance-entries"],
  ["project-expiries"],
  ["website-updates"],
  ["data-approvals"],
  ["trash"],
] as const;

const GENERAL_AFFECTED_QUERY_KEYS = [
  ["dashboard-stats"],
  ["demand-records"],
  ["demand-record-stats"],
  ["customers"],
  ["trash"],
] as const;

export function useSyncPolling(enabled = true) {
  const queryClient = useQueryClient();
  const lastModifiedRef = useRef<number | null>(null);
  const telegramLastModifiedRef = useRef<number | null>(null);
  const isPollingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) return;

    let intervalId: NodeJS.Timeout | null = null;

    async function checkSync() {
      // Skip polling if the browser tab is not active/visible
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      
      if (isPollingRef.current) return;
      isPollingRef.current = true;

      try {
        const res = await fetch("/api/sync/last-modified");
        if (!res.ok) {
          // If unauthorized or server error, we fail silently or stop polling
          if (res.status === 401) {
            if (intervalId) clearInterval(intervalId);
          }
          return;
        }

        const data = await res.json();
        const serverLastModified = Number(data.lastModified);
        const serverTelegramLastModified = Number(data.telegramLastModified);

        // First load: initialize references
        if (lastModifiedRef.current === null || telegramLastModifiedRef.current === null) {
          lastModifiedRef.current = serverLastModified;
          telegramLastModifiedRef.current = serverTelegramLastModified;
          return;
        }

        // Check for new Telegram messages / reports
        if (serverTelegramLastModified > telegramLastModifiedRef.current) {
          // Invalidate only Telegram-driven queries instead of everything,
          // so unrelated pages don't refetch on every Telegram upload.
          await Promise.all(
            TELEGRAM_AFFECTED_QUERY_KEYS.map((queryKey) =>
              queryClient.invalidateQueries({ queryKey }),
            ),
          );
          
          toast.info("Telegram မှ အချက်အလက်အသစ် ရရှိပါသည်", {
            description: "Dashboard ဇယားများနှင့် တွက်ချက်မှုများကို အလိုအလျောက် update လုပ်ပြီးပါပြီ။",
            duration: 4000,
          });

          // Sync refs
          lastModifiedRef.current = serverLastModified;
          telegramLastModifiedRef.current = serverTelegramLastModified;
        }
        // Check for other general updates (e.g. manual dashboard edits)
        else if (serverLastModified > lastModifiedRef.current) {
          // Invalidate silently (no toast since it's likely a user action in-app)
          await Promise.all(
            GENERAL_AFFECTED_QUERY_KEYS.map((queryKey) =>
              queryClient.invalidateQueries({ queryKey }),
            ),
          );
          lastModifiedRef.current = serverLastModified;
        }
      } catch (err) {
        console.warn("Sync polling failed:", err);
      } finally {
        isPollingRef.current = false;
      }
    }

    // Run immediately on mount
    checkSync();

    // Poll every 25 seconds. Telegram uploads still refresh promptly enough
    // for a business dashboard, without hammering /api/sync/last-modified.
    intervalId = setInterval(checkSync, 25000);

    // Run immediately when the user switches back to this tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkSync();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, queryClient]);
}
