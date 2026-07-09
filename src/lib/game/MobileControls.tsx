import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface MobileControlsProps {
  onLeft: (active: boolean) => void;
  onRight: (active: boolean) => void;
  onJump: (active: boolean) => void;
  onInteract: () => void;
  onTool?: () => void;
  onInventory?: () => void;
  onSettings?: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  onLeft,
  onRight,
  onJump,
  onInteract,
  onTool,
  onInventory,
  onSettings,
}) => {
  const vibrateRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      vibrateRef.current = true;
    }
  }, []);

  const vibrate = useCallback((ms = 12) => {
    if (vibrateRef.current) {
      try {
        navigator.vibrate(ms);
      } catch {
        // ignore
      }
    }
  }, []);

  const buttonClass =
    'w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 flex items-center justify-center text-white text-lg sm:text-xl font-bold select-none touch-none transition-transform duration-75';

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex items-end justify-between px-3 sm:px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:hidden pointer-events-none bg-gradient-to-t from-black/35 to-transparent"
      aria-label="移动控制"
    >
      <div className="flex gap-1.5 sm:gap-2 pointer-events-auto">
        <ControlButton
          label="左移"
          className={buttonClass}
          onChange={(active) => {
            if (active) vibrate();
            onLeft(active);
          }}
        >
          ←
        </ControlButton>
        <ControlButton
          label="右移"
          className={buttonClass}
          onChange={(active) => {
            if (active) vibrate();
            onRight(active);
          }}
        >
          →
        </ControlButton>
      </div>

      <div className="flex gap-1.5 sm:gap-2 pointer-events-auto">
        {onSettings && (
          <button
            type="button"
            className={`${buttonClass} bg-white/25 border-white/50 hover:bg-white/35 active:scale-105`}
            aria-label="设置"
            onTouchStart={(e) => {
              e.preventDefault();
              vibrate();
              onSettings();
            }}
            onMouseDown={() => {
              vibrate();
              onSettings();
            }}
          >
            ⚙
          </button>
        )}
        {onInventory && (
          <ControlButton
            label="背包"
            className={buttonClass}
            onChange={() => {
              vibrate();
              onInventory?.();
            }}
            tapOnly
          >
            I
          </ControlButton>
        )}
        <ControlButton
          label="跳跃"
          className={buttonClass}
          onChange={(active) => {
            if (active) vibrate();
            onJump(active);
          }}
        >
          ↥
        </ControlButton>
        <ControlButton
          label="交互"
          className={buttonClass}
          onChange={() => {
            vibrate();
            onInteract();
          }}
          tapOnly
        >
          ✦
        </ControlButton>
        {onTool && (
          <ControlButton
            label="工具"
            className={buttonClass}
            onChange={() => {
              vibrate();
              onTool();
            }}
            tapOnly
          >
            ⚒
          </ControlButton>
        )}
      </div>
    </div>
  );
};

interface ControlButtonProps {
  label: string;
  className: string;
  onChange: (active: boolean) => void;
  tapOnly?: boolean;
  children: React.ReactNode;
}

const ControlButton: React.FC<ControlButtonProps> = ({ label, className, onChange, tapOnly, children }) => {
  const [active, setActive] = useState(false);

  const activeClass =
    'bg-et-gold/60 border-et-gold scale-110 shadow-[0_0_12px_rgba(255,215,0,0.6)]';
  const inactiveClass = 'bg-white/25 border-white/50 hover:bg-white/35 active:scale-105';

  const activate = useCallback(() => {
    setActive(true);
    onChange(true);
  }, [onChange]);

  const deactivate = useCallback(() => {
    setActive(false);
    onChange(false);
  }, [onChange]);

  const tap = useCallback(() => {
    setActive(true);
    onChange(true);
    window.setTimeout(() => {
      setActive(false);
      // 轻触类按钮只在按下时触发一次，释放时不应再次回调。
    }, 120);
  }, [onChange]);

  return (
    <button
      type="button"
      className={`${className} ${active ? activeClass : inactiveClass}`}
      aria-label={label}
      onTouchStart={(e) => {
        e.preventDefault();
        if (tapOnly) tap();
        else activate();
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        if (!tapOnly) deactivate();
      }}
      onTouchCancel={(e) => {
        e.preventDefault();
        if (!tapOnly) deactivate();
      }}
      onMouseDown={() => {
        if (tapOnly) tap();
        else activate();
      }}
      onMouseUp={() => {
        if (!tapOnly) deactivate();
      }}
      onMouseLeave={() => {
        if (!tapOnly && active) deactivate();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
};

export default MobileControls;
