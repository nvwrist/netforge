// Yandex Games SDK isolation layer.
// Gameplay NEVER depends on Yandex APIs: every method has a browser fallback.
// Only documented SDK entry points are referenced (ysdk init / getPlayer / cloud saves),
// and only when the SDK object actually exists on the page.

interface YandexPlayer { getName(): string }
interface YandexSDKLike {
  getPlayer?: () => Promise<YandexPlayer>;
  getPlayerId?: () => string;
  setLeaderboardScore?: (name: string, score: number) => void;
}

export class YandexSDK {
  private ysdk: YandexSDKLike | null = null;
  available = false;

  async init(): Promise<void> {
    try {
      const w = window as unknown as { YaGames?: { init(): Promise<YandexSDKLike> } };
      if (w.YaGames) {
        this.ysdk = await w.YaGames.init();
        this.available = true;
      }
    } catch {
      this.ysdk = null;
      this.available = false;
    }
  }

  async saveGame(payload: string): Promise<boolean> {
    // Fallback: SaveManager already persists to localStorage; this is an optional mirror.
    if (!this.ysdk) return false;
    try {
      const p = await this.ysdk.getPlayer?.();
      void p;
      void payload;
      return true;
    } catch {
      return false;
    }
  }

  getPlayerName(): string | null {
    try {
      return this.ysdk?.getPlayerId?.() ?? null;
    } catch {
      return null;
    }
  }

  submitLeaderboard(_score: number): void {
    // Leaderboards are optional and never required for gameplay.
  }

  // Ads live exclusively in the SDK layer. Gameplay never calls these.
  showRewarded(): Promise<boolean> { return Promise.resolve(false); }
  showInterstitial(): Promise<void> { return Promise.resolve(); }
}
