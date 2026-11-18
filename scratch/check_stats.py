import math
import random
from test_plan_engine import PlanEngine

def check_engagement_curve_stats():
    print("\n--- Checking 10K+ Engagement Timing & Delivery at 25%, 50%, 75% ---")
    likes_at_1200 = []
    saves_at_25 = []
    saves_at_50 = []
    saves_at_75 = []

    for pkg in ["10K", "15K", "50K"]:
        for s in range(500, 600):
            engine = PlanEngine(pkg, followers=5000, seed=s)
            plan = engine.generate_plan()
            rows = plan["rows"]
            views_total = plan["views_total"]
            totals = plan["totals"]

            cum_v = 0
            cum_likes = 0
            cum_saves = 0
            recorded_1200 = False

            s_25, s_50, s_75 = None, None, None

            for r in rows:
                cum_v += r["views"]
                cum_likes += r["likes"]
                cum_saves += r["saves"]

                if cum_v >= 1200 and not recorded_1200:
                    likes_at_1200.append(cum_likes)
                    recorded_1200 = True

                frac_v = cum_v / float(views_total)
                if frac_v >= 0.25 and s_25 is None and totals["saves"] > 0:
                    s_25 = (cum_saves / float(totals["saves"])) * 100.0
                if frac_v >= 0.50 and s_50 is None and totals["saves"] > 0:
                    s_50 = (cum_saves / float(totals["saves"])) * 100.0
                if frac_v >= 0.75 and s_75 is None and totals["saves"] > 0:
                    s_75 = (cum_saves / float(totals["saves"])) * 100.0

            if s_25 is not None: saves_at_25.append(s_25)
            if s_50 is not None: saves_at_50.append(s_50)
            if s_75 is not None: saves_at_75.append(s_75)

    print(f"Likes delivered at ~1,200 views: min={min(likes_at_1200)}, max={max(likes_at_1200)}, median={sorted(likes_at_1200)[len(likes_at_1200)//2]}")
    print(f"Target: about 11-40 (median about 25-30)")
    print(f"Saves % at 25% views: avg={sum(saves_at_25)/len(saves_at_25):.1f}% (target roughly 17-25%)")
    print(f"Saves % at 50% views: avg={sum(saves_at_50)/len(saves_at_50):.1f}% (target roughly 38-50%)")
    print(f"Saves % at 75% views: avg={sum(saves_at_75)/len(saves_at_75):.1f}% (target roughly 64-75%)")

if __name__ == "__main__":
    check_engagement_curve_stats()
