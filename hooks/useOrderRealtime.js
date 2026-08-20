"use client";

import { useEffect, useRef, useState } from "react";

export function useOrderRealtime({ enabled = true } = {}) {
  const [connected, setConnected] = useState(false);
  const [newOrders, setNewOrders] = useState([]);
  const [statusUpdates, setStatusUpdates] = useState([]);
  const esRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    let retryTimer = null;
    let stopped = false;

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
            return;
          }

          if (data.type === "new" && data.order) {
            setNewOrders((prev) => [data.order, ...prev].slice(0, 50));
            window.dispatchEvent(
              new CustomEvent("order-created", { detail: data.order })
            );
          }

          if (data.type === "status" && data.order) {
            setStatusUpdates((prev) => [data.order, ...prev].slice(0, 50));
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

  return { connected, newOrders, statusUpdates };
}
