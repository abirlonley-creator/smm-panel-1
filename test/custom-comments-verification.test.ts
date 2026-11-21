import { describe, it, expect } from "vitest";
import { generatePlan, DEFAULT_INSTAGRAM_CONFIG, DEFAULT_INSTAGRAM_PROVIDER_MINIMUMS } from "../src/lib/engagement/deterministic-pattern-engine";
import { StandardSMMv2Provider } from "../src/lib/provider/adapter";

describe("Custom Comments Verification for Instagram & Zefame", () => {
  it("should generate plan with custom comments assigned deterministically", () => {
    const userComments = [
      "Awesome video! 🔥",
      "Great insights on this topic 👍",
      "Love this content ❤️",
      "Keep it up! 🚀",
      "Best reel today! 👏",
    ];

    const plan = generatePlan(
      {
        id: "instagram_custom_test",
        name: "Test IG Package",
        base_views: 2000,
        views_total: 2000,
        base_duration_hours: 6,
        duration_hours: 6,
        push_range: [500, 700],
        price_inr: 25,
        likes: 50,
        saves: 10,
        shares: 10,
        reposts: 10,
        comments: 5,
      },
      1000,
      "seed_comments_test_123",
      {
        platformConfig: DEFAULT_INSTAGRAM_CONFIG,
        providerMinimums: DEFAULT_INSTAGRAM_PROVIDER_MINIMUMS,
        userCommentLines: userComments,
        commentsMode: "USER_ONLY",
      }
    );

    expect(plan.totals.comments).toBe(5);

    // Verify assigned comments in plan rows
    const rowsWithComments = plan.rows.filter((r) => r.comments > 0);
    expect(rowsWithComments.length).toBeGreaterThan(0);

    const allAssigned: string[] = [];
    for (const r of rowsWithComments) {
      if (r.assignedComments) {
        allAssigned.push(...r.assignedComments);
      }
    }

    expect(allAssigned.length).toBe(5);
    expect(allAssigned).toEqual(userComments);
  });

  it("should enforce line limit: sliced to exactly planned count", () => {
    const rawInput = "Comment 1\nComment 2\nComment 3\nComment 4\nComment 5\nComment 6\nComment 7";
    const plannedComments = 3;

    // Simulate handleCommentsChange trimming logic
    const lines = rawInput.split("\n");
    const trimmed = lines.slice(0, plannedComments).join("\n");
    const parsedLines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);

    expect(parsedLines.length).toBe(plannedComments);
    expect(parsedLines).toEqual(["Comment 1", "Comment 2", "Comment 3"]);
  });

  it("should pass comments param to provider adapter createOrder", async () => {
    let capturedAction = "";
    let capturedParams: any = null;

    const adapter = new StandardSMMv2Provider(
      "https://zefame.com/api/v2",
      "test_key",
      10000,
      3
    );

    // Mock postRequest to verify payload
    (adapter as any).postRequest = async (action: string, params: any) => {
      capturedAction = action;
      capturedParams = params;
      return { data: { order: 12345 } };
    };

    const res = await adapter.createOrder({
      serviceExternalId: "693",
      targetUrl: "https://www.instagram.com/reel/C123456789/",
      quantity: 2,
      comments: "Nice reel! 🔥\nGreat content 👏",
    });

    expect(res.success).toBe(true);
    expect(res.providerOrderId).toBe("12345");
    expect(capturedAction).toBe("add");
    expect(capturedParams.service).toBe("693");
    expect(capturedParams.link).toBe("https://www.instagram.com/reel/C123456789/");
    expect(capturedParams.quantity).toBe(2);
    expect(capturedParams.comments).toBe("Nice reel! 🔥\nGreat content 👏");
  });
});
