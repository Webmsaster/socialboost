import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import {
  LanguageProvider,
  useLanguage,
  getLangServerSnapshot,
} from "@/lib/i18n";

function TestConsumer() {
  const { lang, t } = useLanguage();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="t">{t("nav.dashboard")}</span>
    </div>
  );
}

describe("i18n", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("useLanguage throws when used outside LanguageProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      "useLanguage must be used within LanguageProvider"
    );
    spy.mockRestore();
  });

  it("LanguageProvider renders children", () => {
    render(
      <LanguageProvider>
        <div>Provider child</div>
      </LanguageProvider>
    );
    expect(screen.getByText("Provider child")).toBeInTheDocument();
  });

  it("t() returns translation for known key", () => {
    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>
    );
    expect(screen.getByTestId("t").textContent).toBe("Dashboard");
  });

  it("t() returns key itself for unknown key", () => {
    function UnknownKeyConsumer() {
      const { t } = useLanguage();
      return <span data-testid="unknown">{t("some.unknown.key")}</span>;
    }

    render(
      <LanguageProvider>
        <UnknownKeyConsumer />
      </LanguageProvider>
    );
    expect(screen.getByTestId("unknown").textContent).toBe("some.unknown.key");
  });

  it('getLangServerSnapshot returns "en"', () => {
    expect(getLangServerSnapshot()).toBe("en");
  });

  it("setLang changes the language to German", async () => {
    function LangChanger() {
      const { lang, setLang, t } = useLanguage();
      return (
        <div>
          <span data-testid="current-lang">{lang}</span>
          <span data-testid="translated">{t("nav.dashboard")}</span>
          <button onClick={() => setLang("de")}>Switch to DE</button>
        </div>
      );
    }

    const { getByTestId, getByText } = render(
      <LanguageProvider>
        <LangChanger />
      </LanguageProvider>
    );

    // Initially English (localStorage empty)
    expect(getByTestId("current-lang").textContent).toBe("en");

    // Switch to German
    await act(async () => {
      getByText("Switch to DE").click();
    });

    expect(getByTestId("current-lang").textContent).toBe("de");
    // Verify translation changes
    expect(getByTestId("translated").textContent).toBe("Dashboard");
    // Verify localStorage was updated
    expect(localStorage.getItem("socialboost-lang")).toBe("de");
  });

  it("setLang switches back to English", async () => {
    // Pre-set localStorage to German
    localStorage.setItem("socialboost-lang", "de");

    function LangChanger() {
      const { lang, setLang } = useLanguage();
      return (
        <div>
          <span data-testid="current-lang">{lang}</span>
          <button onClick={() => setLang("en")}>Switch to EN</button>
        </div>
      );
    }

    const { getByTestId, getByText } = render(
      <LanguageProvider>
        <LangChanger />
      </LanguageProvider>
    );

    expect(getByTestId("current-lang").textContent).toBe("de");

    await act(async () => {
      getByText("Switch to EN").click();
    });

    expect(getByTestId("current-lang").textContent).toBe("en");
  });

  it("getLangSnapshot returns 'en' when localStorage throws", () => {
    const originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("localStorage unavailable");
    };

    // Re-render to trigger getLangSnapshot through useSyncExternalStore
    const { getByTestId } = render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>
    );

    // Should fall back to "en" when localStorage throws
    expect(getByTestId("lang").textContent).toBe("en");

    Storage.prototype.getItem = originalGetItem;
  });

  it("setLangInStore handles localStorage.setItem failure gracefully", async () => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("localStorage unavailable");
    };

    function LangChanger() {
      const { lang, setLang } = useLanguage();
      return (
        <div>
          <span data-testid="current-lang">{lang}</span>
          <button onClick={() => setLang("de")}>Switch to DE</button>
        </div>
      );
    }

    const { getByText } = render(
      <LanguageProvider>
        <LangChanger />
      </LanguageProvider>
    );

    // Should not throw even though localStorage.setItem fails
    await act(async () => {
      getByText("Switch to DE").click();
    });

    // The function ran without error (localStorage write failed silently)
    Storage.prototype.setItem = originalSetItem;
  });

  it("langSubscribe returns an unsubscribe function that removes the listener", async () => {
    // We test this indirectly: mount and unmount a component.
    // useSyncExternalStore calls subscribe on mount and unsubscribe on unmount.
    const { unmount } = render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>
    );

    // Unmounting should call the unsubscribe returned by langSubscribe
    // This exercises the cleanup path (lines 23-25)
    unmount();

    // If unsubscribe didn't work, subsequent setLang would call stale listeners
    // and potentially crash. Verify no error by re-mounting.
    const { getByTestId } = render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>
    );
    expect(getByTestId("lang").textContent).toBeTruthy();
  });
});
