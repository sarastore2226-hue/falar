"use client";

import { useEffect, useRef, useState } from "react";

const ACTIVE_STATUSES = new Set(["جاري", "تحت التجهيز"]);

async function fetchPendingOrders() {
  try {
    const response = await fetch("/api/orders/pending");
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("خطأ في جلب الطلبات المعلقة:", error);
    return [];
  }
}

export function useOrderRealtime({ enabled = true } = {}) {
  const [connected, setConnected] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingOrders, setPendingOrders] = useState([]);
  const esRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    let retryTimer = null;
    let stopped = false;

    const syncPendingOrders = async () => {
      const list = await fetchPendingOrders();
      if (stopped) return;
      setPendingOrders(list);
      setPendingCount(list.length);
    };

    const connect = () => {
      if (stopped || esRef.current) return;

      let es;
      try {
        const token =
          typeof window !== "undefined"
            ? window.localStorage.getItem("employeeToken")
            : null;
        const query = token
          ? `?token=${encodeURIComponent(token)}`
          : "";
        es = new EventSource(`/api/orders/stream${query}`);
      } catch (error) {
        retryTimer = setTimeout(connect, 5000);
        return;
      }

      esRef.current = es;

      es.addEventListener("order", (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "connected") {
            setConnected(true);
            if (typeof data.pendingCount === "number") {
              setPendingCount(data.pendingCount);
            }
            syncPendingOrders();
            return;
          }

          if (data.type === "new" && data.order) {
            if (ACTIVE_STATUSES.has(data.order.status)) {
              setPendingCount((prev) => prev + 1);
              setPendingOrders((prev) =>
                [data.order, ...prev.filter((o) => o.id !== data.order.id)].slice(
                  0,
                  100
                )
              );
            }
            window.dispatchEvent(
              new CustomEvent("order-created", { detail: data.order })
            );
          }

          if (data.type === "status" && data.order) {
            const oldStatus = data.oldStatus;
            const newStatus = data.order.status;
            if (oldStatus === undefined || oldStatus === null) {
              syncPendingOrders();
            } else if (
              ACTIVE_STATUSES.has(oldStatus) &&
              !ACTIVE_STATUSES.has(newStatus)
            ) {
              setPendingCount((prev) => Math.max(0, prev - 1));
              setPendingOrders((prev) =>
                prev.filter((o) => o.id !== data.order.id)
              );
            } else if (
              !ACTIVE_STATUSES.has(oldStatus) &&
              ACTIVE_STATUSES.has(newStatus)
            ) {
              setPendingCount((prev) => prev + 1);
              setPendingOrders((prev) =>
                [data.order, ...prev.filter((o) => o.id !== data.order.id)].slice(
                  0,
                  100
                )
              );
            }
            window.dispatchEvent(
              new CustomEvent("order-updated", { detail: data.order })
            );
          }
        } catch (error) {
          console.error("خطأ في تحليل حدث الطلب:", error);
        }
      });

      es.onopen = () => {
        setConnected(true);
      };

      es.onerror = () => {
        setConnected(false);
        if (esRef.current) {
          esRef.current.close();
          esRef.current = null;
        }
        if (!stopped) {
          retryTimer = setTimeout(connect, 5000);
        }
      };
    };

    connect();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [enabled]);

  return { connected, pendingCount, pendingOrders };
}
