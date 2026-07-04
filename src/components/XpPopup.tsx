import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

interface XpPopupProps {
  xp: number;
  bonus?: boolean;
  onDone?: () => void;
}

/**
 * Floating "+50 XP" popup that rises and fades out.
 * Mount it when XP is awarded and it auto-unmounts after the animation.
 */
export function XpPopup({ xp, bonus = false, onDone }: XpPopupProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDone?.(), 300);
    }, 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="xp-popup-root"
      style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(-28px)" }}
      aria-live="polite"
    >
      <span className="xp-popup-inner">
        <Sparkles className="h-3.5 w-3.5" />
        +{xp} XP{bonus ? " 🎉" : ""}
      </span>
    </div>
  );
}

/**
 * Manager that accepts queued XP events and renders one popup at a time.
 */
export interface XpEvent {
  id: string;
  xp: number;
  bonus?: boolean;
}

interface XpPopupManagerProps {
  events: XpEvent[];
  onRemove: (id: string) => void;
}

export function XpPopupManager({ events, onRemove }: XpPopupManagerProps) {
  const current = events[0];
  if (!current) return null;
  return (
    <XpPopup
      key={current.id}
      xp={current.xp}
      bonus={current.bonus}
      onDone={() => onRemove(current.id)}
    />
  );
}
