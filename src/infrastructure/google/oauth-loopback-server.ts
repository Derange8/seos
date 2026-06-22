import http from "node:http";
import type { Logger } from "@/shared/logger";

export interface LoopbackCallbackResult {
  code: string;
  state: string;
}

const SUCCESS_HTML =
  "<html><body style='font-family:sans-serif;text-align:center;padding-top:4rem'>" +
  "<h2>Connected.</h2><p>You can close this tab and return to Seos.</p></body></html>";

const ERROR_HTML = (message: string) =>
  `<html><body style="font-family:sans-serif;text-align:center;padding-top:4rem">` +
  `<h2>Connection failed.</h2><p>${message}</p><p>You can close this tab and try again in Seos.</p></body></html>`;

// A one-shot local HTTP server for the OAuth "installed app" loopback
// flow (https://developers.google.com/identity/protocols/oauth2/native-app)
// — Google redirects the system browser here with the authorization code
// after the user approves access, since a desktop app has no public
// callback URL of its own. Listens on 127.0.0.1 only, closes itself after
// exactly one request (success or failure) or the timeout, whichever
// comes first — never lingers as an open port.
export class OAuthLoopbackServer {
  constructor(
    private readonly port: number,
    private readonly logger: Logger
  ) {}

  start(expectedState: string, timeoutMs = 5 * 60 * 1000): { redirectUri: string; result: Promise<LoopbackCallbackResult> } {
    const redirectUri = `http://127.0.0.1:${this.port}/callback`;

    const result = new Promise<LoopbackCallbackResult>((resolve, reject) => {
      const server = http.createServer((request, response) => {
        const url = new URL(request.url ?? "/", redirectUri);
        if (url.pathname !== "/callback") {
          response.writeHead(404).end();
          return;
        }

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errorParam = url.searchParams.get("error");

        clearTimeout(timer);
        server.close();

        if (errorParam) {
          response.writeHead(200, { "content-type": "text/html" }).end(ERROR_HTML(errorParam));
          reject(new Error(`Google returned an OAuth error: ${errorParam}`));
          return;
        }
        if (!code || state !== expectedState) {
          response.writeHead(200, { "content-type": "text/html" }).end(ERROR_HTML("Invalid or missing authorization response."));
          reject(new Error("OAuth callback missing code or state mismatch"));
          return;
        }

        response.writeHead(200, { "content-type": "text/html" }).end(SUCCESS_HTML);
        resolve({ code, state });
      });

      const timer = setTimeout(() => {
        server.close();
        reject(new Error("Timed out waiting for the Google OAuth callback"));
      }, timeoutMs);

      server.on("error", (error) => {
        clearTimeout(timer);
        this.logger.error("OAuth loopback server error", { error: String(error) });
        reject(error);
      });

      server.listen(this.port, "127.0.0.1");
    });

    return { redirectUri, result };
  }
}
