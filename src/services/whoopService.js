const WHOOP_API_BASE = "https://api.prod.whoop.com";

export class WhoopService {
  constructor(config = {}) {
    this.getToken = config.getToken || null;
    this.accessToken = config.accessToken || null;
    this.customFetch = config.fetch || null;

    if (!this.getToken && !this.accessToken) {
      throw new Error("WhoopService requires either getToken or accessToken");
    }
  }

  async _fetch(path, options = {}) {
    const url = path.startsWith("http") ? path : `${WHOOP_API_BASE}${path}`;

    let token = this.accessToken;
    if (this.getToken) {
      token = await this.getToken();
    }

    const fetchFn = this.customFetch || fetch;
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);

    let response = await fetchFn(url, {
      ...options,
      headers,
    });

    if (response.status === 401 && this.getToken) {
      const refreshedToken = await this.getToken();
      if (refreshedToken !== token) {
        headers.set("Authorization", `Bearer ${refreshedToken}`);
        response = await fetchFn(url, {
          ...options,
          headers,
        });
      }
    }

    return response;
  }

  /**
   * Formats a Date as YYYY-MM-DD string (UTC).
   */
  static formatDateYYYYMMDD(date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  /**
   * Builds UTC start and end timestamps for a given day.
   */
  static buildDateWindow(dayDate) {
    const startOfDay = `${dayDate}T00:00:00.000Z`;
    const nextDay = new Date(`${dayDate}T00:00:00.000Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const endOfDay = nextDay.toISOString();
    return { startOfDay, endOfDay };
  }

  /**
   * Handles WHOOP API error responses with standardized error handling.
   */
  static handleWhoopApiError(response, context = "WHOOP API") {
    if (response.status === 429) {
      return {
        error: "WHOOP API rate limit exceeded. Please try again later.",
        status: 429,
      };
    }

    if (!response.ok) {
      return {
        error: `${context} error: ${response.status}`,
        status: response.status,
      };
    }

    return null;
  }

  /**
   * Fetches the most recent recovery for a given date.
   */
  async fetchRecoveryForDate(dayDate) {
    const { startOfDay, endOfDay } = WhoopService.buildDateWindow(dayDate);

    const recoveryUrl = `/developer/v2/recovery?limit=1&start=${encodeURIComponent(
      startOfDay
    )}&end=${encodeURIComponent(endOfDay)}`;

    const response = await this._fetch(recoveryUrl);

    const apiError = WhoopService.handleWhoopApiError(
      response,
      "Recovery fetch"
    );
    if (apiError) {
      return apiError;
    }

    const data = await response.json();

    if (!data.records || data.records.length === 0) {
      return { error: `No recovery found for date: ${dayDate}`, status: 404 };
    }

    return { recovery: data.records[0] };
  }

  /**
   * Fetches a sleep record by ID.
   */
  async fetchSleepById(sleepId) {
    if (!sleepId) {
      return { error: "Sleep ID is required", status: 400 };
    }

    const sleepUrl = `/developer/v2/activity/sleep/${sleepId}`;
    const response = await this._fetch(sleepUrl);

    const apiError = WhoopService.handleWhoopApiError(response, "Sleep fetch");
    if (apiError) {
      return apiError;
    }

    const sleep = await response.json();
    return { sleep };
  }
}
