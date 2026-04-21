import { onScopeDispose, ref, type Ref } from 'vue';

export type UseApiOptions = {
  immediate?: boolean;
  interval?: number;
};

export type UseApiReturn<T> = {
  data: Ref<T | null>;
  error: Ref<Error | null>;
  loading: Ref<boolean>;
  refresh: () => Promise<void>;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export function useApi<T>(path: string, options: UseApiOptions = {}): UseApiReturn<T> {
  const { immediate = true, interval } = options;

  const data = ref<T | null>(null) as Ref<T | null>;
  const error = ref<Error | null>(null);
  const loading = ref(false);

  const url = `${API_BASE_URL}${path}`;

  async function refresh(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API ${response.status} ${response.statusText} on ${path}`);
      }
      data.value = (await response.json()) as T;
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
      loading.value = false;
    }
  }

  // onScopeDispose binds cleanup to the enclosing effect scope so this
  // composable works both inside Vue components (auto-disposed on unmount)
  // and inside Pinia stores (disposed with the app).
  let intervalId: ReturnType<typeof setInterval> | null = null;
  if (interval !== undefined && interval > 0) {
    intervalId = setInterval(() => {
      void refresh();
    }, interval);
    onScopeDispose(() => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    });
  }

  if (immediate) {
    void refresh();
  }

  return { data, error, loading, refresh };
}
