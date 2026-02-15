import { useCallback, useState } from "react";

export function useMessageToast() {
  const [message, setMessage] = useState<string | null>(null);

  const showMessage = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  }, []);

  return { message, showMessage };
}
