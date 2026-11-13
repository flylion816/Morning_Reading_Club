jest.mock("../../services/auth.service", () => ({
  isLogin: jest.fn(() => false),
  wechatLogin: jest.fn(),
  login: jest.fn(),
}));

jest.mock("../../services/user.service", () => ({
  bindPhone: jest.fn(),
}));

describe("login entry transition", () => {
  let pageConfig;
  let page;
  let appState;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    pageConfig = null;
    appState = {
      globalData: {
        isLogin: false,
        userInfo: null,
        token: null,
        loginEntryTransitionPending: false,
      },
    };

    global.Page = jest.fn((config) => {
      pageConfig = config;
      return config;
    });
    global.getApp = jest.fn(() => appState);
    global.getCurrentPages = jest.fn(() => []);
    global.wx.setNavigationBarColor = jest.fn();

    require("../../pages/login/login");
    page = {
      ...pageConfig,
      data: JSON.parse(JSON.stringify(pageConfig.data)),
      setData(update) {
        this.data = { ...this.data, ...update };
      },
    };
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    delete global.Page;
    delete global.getApp;
    delete global.getCurrentPages;
  });

  test("uses tenant blue for the system navigation area", () => {
    page.onLoad({});

    expect(wx.setNavigationBarColor).toHaveBeenCalledWith({
      frontColor: "#ffffff",
      backgroundColor: "#3d6fa6",
    });
  });

  test("hands off to the home bridge after the designed entrance sequence", async () => {
    await page.completeLogin({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: { _id: "user-1", nickname: "书友" },
    });

    expect(page.data.entryTransition).toBe(true);
    expect(wx.switchTab).not.toHaveBeenCalled();

    jest.advanceTimersByTime(2599);
    expect(wx.switchTab).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(appState.globalData.loginEntryTransitionPending).toBe(true);
    expect(wx.switchTab).toHaveBeenCalledWith(
      expect.objectContaining({ url: "/pages/index/index" }),
    );
    expect(page.data.entryTransition).toBe(false);
  });
});
