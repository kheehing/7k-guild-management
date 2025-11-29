import React from "react";

interface NotificationProps {
  message: string;
  show: boolean;
  onClose?: () => void;
  duration?: number; // ms
}

export default function Notification({ message, show, onClose, duration = 3500 }: NotificationProps) {
  React.useEffect(() => {
    if (show && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [show, onClose, duration]);

  if (!show) return null;

  return (
    <div
      className="fixed bottom-8 left-8 z-[1000] px-6 py-4 rounded-xl shadow-lg text-base font-semibold flex items-center"
      style={{
        minWidth: 320,
        maxWidth: 400,
        backgroundColor: "var(--color-surface)",
        border: "2px solid var(--color-primary)",
        color: "var(--color-foreground)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        opacity: 0.97,
        animation: "fadeIn 0.3s ease-in-out"
      }}
      role="alert"
      aria-live="assertive"
    >
      {message}
    </div>
  );
}
