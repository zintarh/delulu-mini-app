"use client";
import { sdk } from "@farcaster/frame-sdk";
// Use any types for Farcaster SDK compatibility
type FrameContext = any;
type AddFrameResult = any;
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useUserStore } from "@/stores/useUserStore";

interface MiniAppContextType {
  isMiniAppReady: boolean;
  context: FrameContext | null;
  setMiniAppReady: () => void;
  addMiniApp: () => Promise<AddFrameResult | null>;
}

const MiniAppContext = createContext<MiniAppContextType | undefined>(undefined);

interface MiniAppProviderProps {
  addMiniAppOnLoad?: boolean;
  children: ReactNode;
}

export function MiniAppProvider({ children, addMiniAppOnLoad }: MiniAppProviderProps): JSX.Element {
  const [context, setContext] = useState<FrameContext | null>(null);
  const [isMiniAppReady, setIsMiniAppReady] = useState(false);
  const { setUser, setLoading } = useUserStore();

  const setMiniAppReady = useCallback(async () => {
    try {
      setLoading(true);
      const context = await sdk.context;
      if (context) {
        setContext(context);
        
        // Extract and store user data from Farcaster context
        if (context.user) {
          const userData = {
            fid: context.user.fid || 0,
            username: context.user.username,
            displayName: context.user.displayName,
            pfpUrl: context.user.pfpUrl,
          };
          setUser(userData);
          console.log("User data synced to store:", userData);
        }
      }
      await sdk.actions.ready();
    } catch (err) {
      console.error("SDK initialization error:", err);
      setLoading(false);
    } finally {
      setIsMiniAppReady(true);
      setLoading(false);
    }
  }, [setUser, setLoading]);


  useEffect(() => {
    if (!isMiniAppReady) {
      setMiniAppReady().then(() => {
        console.log("MiniApp loaded");
      });
    }
  }, [isMiniAppReady, setMiniAppReady]);

  const handleAddMiniApp = useCallback(async () => {
    try {
      // Check if SDK is available and ready
      if (!sdk?.actions?.addFrame) {
        return null;
      }
      const result = await sdk.actions.addFrame();
      // Handle different return types from SDK
      if (result && typeof result === "object") {
        // If the object has a nested result, use it; otherwise use the object directly
        const innerResult = (result as any).result;
        return innerResult !== undefined ? innerResult : result;
      }
      return result || null;
    } catch {
      // addFrame is only available inside Farcaster miniapp embed; ignore elsewhere
      return null;
    }
  }, []);

  useEffect(() => {
    if (isMiniAppReady && !context?.client?.added && addMiniAppOnLoad) {
      // Add a small delay to ensure SDK is fully ready
      const timer = setTimeout(() => {
        handleAddMiniApp().catch((err) => {
          // Silently handle - this is expected in some environments
          if (process.env.NODE_ENV === 'development') {
            console.warn("addMiniApp failed (this is normal outside Farcaster):", err);
          }
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [
    isMiniAppReady,
    context?.client?.added,
    handleAddMiniApp,
    addMiniAppOnLoad,
  ]);

  return (
    <MiniAppContext.Provider
      value={{
        isMiniAppReady,
        setMiniAppReady,
        addMiniApp: handleAddMiniApp,
        context,
      }}
    >
  {children}
    </MiniAppContext.Provider>
  );
}

export function useMiniApp(): MiniAppContextType {
  const context = useContext(MiniAppContext);
  if (context === undefined) {
    throw new Error("useMiniApp must be used within a MiniAppProvider");
  }
  return context;
}
