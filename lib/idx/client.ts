/**
 * IDX (Indonesian Stock Exchange) API Client
 * Based on NeaByteLab/IDX-API wrapper
 * 
 * Provides session management, fetch utilities with retry logic,
 * and connection to official IDX data endpoints.
 */

export class IDXClient {
  private readonly baseUrls = {
    main: "https://www.idx.co.id",
    api: "https://api.idx.co.id",
    data: "https://data.idx.co.id"
  };

  protected sessionCookie = "";
  
  /** Standard browser headers for request simulation */
  protected readonly browserHeaders = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
    Referer: "https://www.idx.co.id/",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
  };

  /**
   * Initialize session cookie by fetching main page
   */
  async ensureSession(): Promise<void> {
    if (this.sessionCookie) {
      return;
    }

    try {
      const response = await this.fetchUrl("https://www.idx.co.id/id");
      this.sessionCookie = response.headers.getSetCookie().join("; ");
      
      // Wait briefly before next request
      await this.wait(1000);
      await response.body?.cancel();

      // Validate session with a known endpoint
      const validationResponse = await this.fetchUrl(
        "https://www.idx.co.id/primary/home/GetIndexList"
      );
      await validationResponse.body?.cancel();

      console.log("[IDX] Session initialized successfully");
    } catch (error) {
      console.error("[IDX] Session initialization failed:", error);
      throw error;
    }
  }

  /**
   * Universal fetcher with exponential backoff retry
   */
  async fetchUrl(
    url: string,
    maxAttempts: number = 5
  ): Promise<Response> {
    const headers = {
      ...this.browserHeaders,
      "X-Requested-With": "XMLHttpRequest",
      ...(this.sessionCookie ? { Cookie: this.sessionCookie } : {})
    };

    const attemptFetch = async (attempt: number): Promise<Response> => {
      try {
        const response = await fetch(url, { headers });

        // Retry on server errors only
        if (!response.ok && response.status >= 500) {
          await response.body?.cancel();
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (error) {
        if (attempt >= maxAttempts) {
          throw error;
        }

        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 15000);
        console.warn(
          `[IDX] Fetch failed for ${url}. Retrying in ${delay / 1000}s (Attempt ${attempt}/${maxAttempts}). Error: ${
            error instanceof Error ? error.message : String(error)
          }`
        );

        await this.wait(delay);
        return attemptFetch(attempt + 1);
      }
    };

    return attemptFetch(1);
  }

  /**
   * Helper to fetch JSON with automatic parsing
   */
  async fetchJSON<T>(
    url: string,
    maxAttempts: number = 5,
    cacheSeconds?: number
  ): Promise<T> {
    const headers = {
      ...this.browserHeaders,
      "X-Requested-With": "XMLHttpRequest",
      ...(this.sessionCookie ? { Cookie: this.sessionCookie } : {}),
      ...(cacheSeconds ? { "Cache-Control": `max-age=${cacheSeconds}`, Pragma: cacheSeconds > 0 ? "no-cache" : undefined } : {})
    };

    const response = await this.fetchUrl(url, maxAttempts);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  protected wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
