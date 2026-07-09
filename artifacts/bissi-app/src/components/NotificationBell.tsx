import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Bell, CheckCheck, Package, CreditCard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Notification = {
  id: number;
  title: string;
  message: string;
  type: string;
  entityId?: number;
  isRead: boolean;
  createdAt: string;
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  collection_recorded: <CreditCard className="h-4 w-4 text-blue-500" />,
  collection_verified: <CheckCheck className="h-4 w-4 text-green-500" />,
  collection_rejected: <X className="h-4 w-4 text-red-500" />,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["notifications-count"],
    queryFn: () => api.get("/notifications/unread-count"),
    refetchInterval: 30_000,
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications?limit=20"),
    enabled: open,
    refetchInterval: open ? 15_000 : false,
  });

  const markRead = useMutation({
    mutationFn: (id: number) => api.patch(`/notifications/${id}/read`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch("/notifications/read-all", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-count"] });
    },
  });

  const unread = countData?.count ?? 0;

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((p) => !p)}
        className="relative"
        aria-label="Notifications">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold leading-none">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-popover border border-border rounded-xl shadow-xl z-50 flex flex-col max-h-[480px]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Notifications</h3>
              {unread > 0 && <Badge variant="destructive" className="h-5 text-[10px] px-1.5">{unread}</Badge>}
            </div>
            {unread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2 text-muted-foreground"
                onClick={() => markAllRead.mutate()}>
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Mark all read
              </Button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No notifications
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { if (!n.isRead) markRead.mutate(n.id); }}
                  className={`w-full text-left px-4 py-3 border-b border-border/50 flex items-start gap-3 hover:bg-accent/50 transition-colors
                    ${!n.isRead ? "bg-blue-50/60 dark:bg-blue-900/10" : ""}`}>
                  <span className="mt-0.5 shrink-0">
                    {TYPE_ICON[n.type] ?? <Package className="h-4 w-4 text-muted-foreground" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-tight ${!n.isRead ? "font-semibold text-foreground" : "font-medium text-foreground/80"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
