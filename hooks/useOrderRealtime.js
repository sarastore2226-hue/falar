"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const ACTIVE_STATUSES = new Set(["جاري", "تحت التجهيز"]);

async function fetchPendingOrders() {
  try {
    const response = await fetch("/api/orders/pending");
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function useOrderRealtime({ enabled = true } = {}) {
  const [connected, setConnected] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingOrders, setPendingOrders] = useState([]);

  useEffect(() => {
    // التأكد من وجود عميل سوبابيز والتفعيل
    if (!enabled || !supabase) return;

    // 🛡️ الاتصال للموظفين والمديرين فقط
    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem("employeeToken")
        : null;

    if (!token) return;

    let stopped = false;

    // جلب الطلبات المعلقة الحالية لمرة واحدة سريعة
    const syncPendingOrders = async () => {
      const list = await fetchPendingOrders();
      if (stopped) return;
      setPendingOrders(list);
      setPendingCount(list.length);
    };

    syncPendingOrders();

    // ⚡ الاتصال المباشر بقاعدة بيانات Supabase Realtime عبر الـ WebSockets
    const channel = supabase
      .channel("realtime-orders-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          const newOrder = payload.new;
          if (!newOrder) return;

          if (ACTIVE_STATUSES.has(newOrder.status)) {
            setPendingCount((prev) => prev + 1);
            setPendingOrders((prev) =>
              [newOrder, ...prev.filter((o) => o.id !== newOrder.id)].slice(0, 100)
            );
          }

          // تشغيل الصوت وظهور إشعار الـ Toast
          window.dispatchEvent(
            new CustomEvent("order-created", { detail: newOrder })
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          const updatedOrder = payload.new;
          const oldOrder = payload.old;
          if (!updatedOrder) return;

          const oldStatus = oldOrder?.status;
          const newStatus = updatedOrder.status;

          if (!oldStatus) {
            syncPendingOrders();
          } else if (
            ACTIVE_STATUSES.has(oldStatus) &&
            !ACTIVE_STATUSES.has(newStatus)
          ) {
            setPendingCount((prev) => Math.max(0, prev - 1));
            setPendingOrders((prev) =>
              prev.filter((o) => o.id !== updatedOrder.id)
            );
          } else if (
            !ACTIVE_STATUSES.has(oldStatus) &&
            ACTIVE_STATUSES.has(newStatus)
          ) {
            setPendingCount((prev) => prev + 1);
            setPendingOrders((prev) =>
              [updatedOrder, ...prev.filter((o) => o.id !== updatedOrder.id)].slice(
                0,
                100
              )
            );
          }

          window.dispatchEvent(
            new CustomEvent("order-updated", { detail: updatedOrder })
          );
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setConnected(false);
        }
      });

    return () => {
      stopped = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [enabled]);

  return { connected, pendingCount, pendingOrders };
}