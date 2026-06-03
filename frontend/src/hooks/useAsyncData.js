import { useCallback, useEffect, useState } from "react";

export const useAsyncData = (fetcher, dependencies = []) => {
  const [state, setState] = useState({
    data: null,
    isLoading: true,
    error: ""
  });

  const loadData = useCallback(
    async (options = {}) => {
      const silent = Boolean(options?.silent);
      if (!silent) {
        setState((previous) => ({ ...previous, isLoading: true, error: "" }));
      }
      try {
        const data = await fetcher();
        setState({ data, isLoading: false, error: "" });
      } catch (error) {
        setState((previous) => {
          const message = error?.message ?? "Failed to load data";
          if (silent && previous.data != null) {
            return { ...previous, isLoading: false, error: message };
          }
          return { data: null, isLoading: false, error: message };
        });
      }
    },
    dependencies
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const silentReload = useCallback(() => loadData({ silent: true }), [loadData]);

  return { ...state, reload: loadData, silentReload };
};
