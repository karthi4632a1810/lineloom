import { useCallback, useEffect, useState } from "react";

export const useAsyncData = (fetcher, dependencies = []) => {
  const [state, setState] = useState({
    data: null,
    isLoading: true,
    error: ""
  });

  const loadData = useCallback(async () => {
    setState((previous) => ({ ...previous, isLoading: true, error: "" }));
    try {
      const data = await fetcher();
      setState({ data, isLoading: false, error: "" });
    } catch (error) {
      setState({
        data: null,
        isLoading: false,
        error: error?.message ?? "Failed to load data"
      });
    }
  }, dependencies);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { ...state, reload: loadData };
};
