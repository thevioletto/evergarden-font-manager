import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const checkMaximized = async () => {
      try {
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);
      } catch (e) {
        console.error("Failed to check maximized state", e);
      }
    };

    checkMaximized();

    const setupListener = async () => {
      try {
        unlisten = await appWindow.onResized(async () => {
          const maximized = await appWindow.isMaximized();
          setIsMaximized(maximized);
        });
      } catch (e) {
        console.error("Failed to listen to window resize", e);
      }
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleMinimize = () => {
    appWindow.minimize().catch(console.error);
  };

  const handleToggleMaximize = () => {
    appWindow.toggleMaximize().catch(console.error);
  };

  const handleClose = () => {
    appWindow.close().catch(console.error);
  };

  return (
    <div
      className="flex items-center gap-1.5"
      style={{ WebkitAppRegion: "no-drag" } as any}
      data-tauri-drag-region="false"
    >
      <button
        type="button"
        onClick={handleMinimize}
        title="Minimize"
        className="text-muted-foreground hover:text-foreground hover:bg-muted/80 flex h-8 w-8 aspect-square items-center justify-center rounded-full transition-colors focus:outline-none"
      >
        <svg width="12" height="2" viewBox="0 0 12 2" className="fill-current">
          <rect width="12" height="2" rx="1" />
        </svg>
      </button>

      <button
        type="button"
        onClick={handleToggleMaximize}
        title={isMaximized ? "Restore" : "Maximize"}
        className="text-muted-foreground hover:text-foreground hover:bg-muted/80 flex h-8 w-8 aspect-square items-center justify-center rounded-full transition-colors focus:outline-none"
      >
        {isMaximized ? (
          <svg width="12" height="12" viewBox="0 0 12 12" className="stroke-current">
            <path
              fill="none"
              strokeWidth="1.2"
              d="M3.5,1.5 H10.5 V8.5 H8.5 M1.5,3.5 H8.5 V10.5 H1.5 Z"
            />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" className="stroke-current">
            <path
              fill="none"
              strokeWidth="1.2"
              d="M1.5,1.5 H10.5 V10.5 H1.5 Z"
            />
          </svg>
        )}
      </button>

      <button
        type="button"
        onClick={handleClose}
        title="Close"
        className="text-muted-foreground hover:bg-destructive hover:text-destructive-foreground flex h-8 w-8 aspect-square items-center justify-center rounded-full transition-colors focus:outline-none"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" className="stroke-current">
          <path
            fill="none"
            strokeWidth="1.4"
            d="M1.5,1.5 L10.5,10.5 M10.5,1.5 L1.5,10.5"
          />
        </svg>
      </button>
    </div>
  );
}
