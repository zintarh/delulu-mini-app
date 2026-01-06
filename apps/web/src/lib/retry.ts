/**
 * Retry utility with exponential backoff
 * For resilient API calls after blockchain transactions
 */

interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxAttempts: 5,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Executes an async function with exponential backoff retry
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const {
    maxAttempts,
    initialDelayMs,
    maxDelayMs,
    backoffMultiplier,
  } = { ...DEFAULT_OPTIONS, ...options };

  let lastError: Error | undefined;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxAttempts) {
        break;
      }

      // Call onRetry callback if provided
      options?.onRetry?.(attempt, lastError);
      
      console.warn(
        `[Retry] Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}. Retrying in ${delay}ms...`
      );

      // Wait before next attempt
      await sleep(delay);
      
      // Increase delay with exponential backoff, capped at maxDelay
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Queue for pending syncs that failed
 * Stores them in localStorage for retry on next page load
 */
const PENDING_SYNCS_KEY = 'delulu_pending_syncs';

interface PendingSync {
  id: string;
  type: 'delulu' | 'stake' | 'claim';
  data: Record<string, unknown>;
  txHash: string;
  createdAt: number;
  attempts: number;
}

export function savePendingSync(sync: Omit<PendingSync, 'createdAt' | 'attempts'>): void {
  if (typeof window === 'undefined') return;
  
  try {
    const existing = getPendingSyncs();
    const newSync: PendingSync = {
      ...sync,
      createdAt: Date.now(),
      attempts: 0,
    };
    
    // Avoid duplicates by txHash
    const filtered = existing.filter((s) => s.txHash !== sync.txHash);
    filtered.push(newSync);
    
    localStorage.setItem(PENDING_SYNCS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('[PendingSync] Failed to save:', error);
  }
}

export function getPendingSyncs(): PendingSync[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const data = localStorage.getItem(PENDING_SYNCS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function removePendingSync(txHash: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const existing = getPendingSyncs();
    const filtered = existing.filter((s) => s.txHash !== txHash);
    localStorage.setItem(PENDING_SYNCS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('[PendingSync] Failed to remove:', error);
  }
}

export function updatePendingSyncAttempts(txHash: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const existing = getPendingSyncs();
    const updated = existing.map((s) => 
      s.txHash === txHash ? { ...s, attempts: s.attempts + 1 } : s
    );
    localStorage.setItem(PENDING_SYNCS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('[PendingSync] Failed to update:', error);
  }
}

// Clean up old pending syncs (older than 24 hours)
export function cleanupOldPendingSyncs(): void {
  if (typeof window === 'undefined') return;
  
  try {
    const existing = getPendingSyncs();
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const filtered = existing.filter((s) => s.createdAt > oneDayAgo);
    localStorage.setItem(PENDING_SYNCS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('[PendingSync] Failed to cleanup:', error);
  }
}
