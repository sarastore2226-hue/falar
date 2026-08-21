import { prisma } from "@/lib/prisma";
import { supabase, isSupabaseRealtimeConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const HEARTBEAT_INTERVAL = 25000;

async function getPendingCount() {
  try {
    return await prisma.orders.count({
      where: { status: "تحت التجهيز" },
    });
  } catch (error) {
    console.error("SSE pending count error:", error);
    return 0;
  }
}

function formatOrder(row) {
  return {
    id: row.id,
    customer_name: row.customer_name,
    address: row.address,
    phone: row.phone,
    total_price: parseFloat(row.total_price?.toString() || "0"),
    status: row.status,
    timestamp: row.timestamp,
    printed_by: row.printed_by || null,
    printed_at: row.printed_at || null,
    exported_by: row.exported_by || null,
    exported_at: row.exported_at || null,
    items: [],
  };
}

async function isAuthorized(token) {
  if (!token || !token.startsWith("employee_")) return false;
  const parts = token.split("_");
  const userId = parseInt(parts[1], 10);
  if (!userId) return false;

  try {
    const user = await prisma.users.findUnique({
      where: { userid: userId },
      select: { position: true },
    });
    return user && (user.position === "موظف" || user.position === "مدير");
  } catch (error) {
    console.error("SSE auth error:", error);
    return false;
  }
}

export async function GET(request) {
  if (!isSupabaseRealtimeConfigured()) {
    return new Response(
      `event: order\ndata: ${JSON.stringify({
        type: "error",
        message: "Supabase Realtime غير مضبوط. أضف SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في ملف .env",
      })}\n\n`,
      {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      }
    );
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!(await isAuthorized(token))) {
    return new Response(
      `event: order\ndata: ${JSON.stringify({
        type: "error",
        message: "غير مصرح بالاتصال بخادم الإشعارات",
      })}\n\n`,
      {
        status: 401,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
        },
      }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let heartbeatTimer = null;

      const send = (data) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: order\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch (error) {
          close();
        }
      };

      const sendComment = () => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch (error) {
          close();
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        try {
          if (channel) supabase.removeChannel(channel);
        } catch (error) {
          /* ignore */
        }
        try {
          controller.close();
        } catch (error) {
          /* already closed */
        }
      };

      let channel = null;

      channel = supabase
        .channel("orders-realtime")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "orders" },
          (payload) => {
            send({ type: "new", order: formatOrder(payload.new || {}) });
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders" },
          (payload) => {
            if (!payload.old || !payload.new) return;
            if (payload.old.status !== payload.new.status) {
              send({
                type: "status",
                order: formatOrder(payload.new),
                oldStatus: payload.old.status,
              });
            }
          }
        )
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            const pendingCount = await getPendingCount();
            send({ type: "connected", ok: true, pendingCount });
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            send({ type: "error", message: "فشل الاشتراك في Realtime" });
          }
        });

      request.signal.addEventListener("abort", close);
      heartbeatTimer = setInterval(sendComment, HEARTBEAT_INTERVAL);
    },
    cancel() {
      /* cleanup handled via close() from abort listener */
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
