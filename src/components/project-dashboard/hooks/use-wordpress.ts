import { useEffect, useState } from "react";
import type { WordPressConnectionDto } from "@/application/wordpress/dto";
import type { TranslationKey } from "../shared";

// Owns the WordPress connection lifecycle: fetching the current connection
// on mount, connecting via an Application Password, and disconnecting.
// Independent of crawl state — a WordPress connection is set up once per
// project and just sits there until reconnected/removed.
export function useWordPress(projectId: string, t: (key: TranslationKey) => string) {
  const [wordPressConnection, setWordPressConnection] = useState<WordPressConnectionDto | null>(null);
  const [wpSiteUrl, setWpSiteUrl] = useState("");
  const [wpUsername, setWpUsername] = useState("");
  const [wpApplicationPassword, setWpApplicationPassword] = useState("");
  const [isConnectingWordPress, setIsConnectingWordPress] = useState(false);
  const [isDisconnectingWordPress, setIsDisconnectingWordPress] = useState(false);
  const [wordPressError, setWordPressError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/projects/${projectId}/wordpress`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setWordPressConnection(data))
      .catch((error: unknown) => console.error("Failed to fetch WordPress connection", error));
  }, [projectId]);

  async function handleConnectWordPress(event: React.FormEvent) {
    event.preventDefault();
    setIsConnectingWordPress(true);
    setWordPressError(null);

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${projectId}/wordpress`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteUrl: wpSiteUrl, username: wpUsername, applicationPassword: wpApplicationPassword }),
      });
    } catch {
      setIsConnectingWordPress(false);
      setWordPressError(t("networkErrorRetry"));
      return;
    }
    const data = await response.json();

    setIsConnectingWordPress(false);
    if (!response.ok) {
      setWordPressError(data.error ?? t("failedToConnectToWordPress"));
      return;
    }

    setWordPressConnection(data);
    setWpSiteUrl("");
    setWpUsername("");
    setWpApplicationPassword("");
  }

  async function handleDisconnectWordPress() {
    setIsDisconnectingWordPress(true);
    try {
      await fetch(`/api/v1/projects/${projectId}/wordpress`, { method: "DELETE" });
      setWordPressConnection(null);
    } catch (error) {
      console.error("Failed to disconnect WordPress", error);
    } finally {
      setIsDisconnectingWordPress(false);
    }
  }

  return {
    wordPressConnection,
    wpSiteUrl,
    setWpSiteUrl,
    wpUsername,
    setWpUsername,
    wpApplicationPassword,
    setWpApplicationPassword,
    isConnectingWordPress,
    isDisconnectingWordPress,
    wordPressError,
    handleConnectWordPress,
    handleDisconnectWordPress,
  };
}
