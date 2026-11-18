import math
import random

def format_duration(hours):
    days = int(hours // 24)
    rem_hours = int(round(hours % 24))
    if rem_hours == 24:
        days += 1
        rem_hours = 0
    return f"{days} days {rem_hours} hours"

def smoothstep(edge0, edge1, x):
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)

class PlanEngine:
    GAP_WEIGHTS = [0.12, 0.20, 0.22, 0.20, 0.15, 0.11]  # for k in 1..6

    PACKAGE_DEFAULTS = {
        "2K":  {"base_views": 2000,  "base_hours": 6,   "push": (500, 700)},
        "5K":  {"base_views": 5000,  "base_hours": 24,  "push": (300, 500)},
        "10K": {"base_views": 10000, "base_hours": 48,  "push": (300, 500)},
        "15K": {"base_views": 15000, "base_hours": 72,  "push": (300, 500)},
        "50K": {"base_views": 50000, "base_hours": 120, "push": (300, 500)},
    }

    RATE_RANGES = {
        "likes":    (0.046, 0.078),
        "saves":    (0.0065, 0.0135),
        "reposts":  (0.0025, 0.0075),
        "comments": (0.0018, 0.0055),
        "shares":   (0.0035, 0.0095),
    }

    PROVIDER_MINIMUMS = {
        "views": 100,
        "likes": 10,
        "saves": 10,
        "reposts": 10,
        "shares": 10,
        "comments": 1,
    }

    def __init__(self, package_key="2K", followers=1000, seed=12345):
        self.pkg_key = package_key
        self.pkg = self.PACKAGE_DEFAULTS[package_key]
        self.followers = followers
        self.seed = seed
        self.rng = random.Random(seed)

    def generate_single_try(self):
        rng = self.rng
        pkg = self.pkg

        # 1. Random views_total
        overshoot = rng.uniform(1.00, 1.30)
        views_total = int(round(pkg["base_views"] * overshoot))
        # Ensure not round (e.g. not ending in 00 or 50)
        if views_total % 50 == 0:
            views_total += rng.choice([-7, -3, 3, 7, 11, 13])
        views_total = max(pkg["base_views"], views_total)

        # 2. Duration on 15-minute grid
        dur_factor = rng.uniform(0.85, 1.15)
        raw_hours = pkg["base_hours"] * dur_factor
        T = int(round(raw_hours * 4)) # number of 15-min ticks
        T = max(12, T) # at least 3 hours
        actual_hours = T / 4.0

        # 3. Service rates and totals
        rates = {}
        totals = {}
        for s, (r_min, r_max) in self.RATE_RANGES.items():
            r = rng.uniform(r_min, r_max)
            rates[s] = r
            tot = int(round(views_total * r))
            min_req = self.PROVIDER_MINIMUMS[s]
            if tot < min_req:
                totals[s] = 0
            else:
                totals[s] = tot

        # 4. Push range by followers
        push_min, push_max = pkg["push"]
        if self.followers < 1000:
            p_low, p_high = push_min, push_min + (push_max - push_min) / 3.0
        elif self.followers <= 10000:
            p_low, p_high = push_min + (push_max - push_min) / 3.0, push_min + 2.0 * (push_max - push_min) / 3.0
        else:
            p_low, p_high = push_min + 2.0 * (push_max - push_min) / 3.0, push_max
        push_total = int(round(rng.uniform(p_low, p_high)))
        # clamp push so row 1 has 50-65% and leaves >= 100 for row 2
        push_total = max(200, min(push_total, views_total - 200))

        # Push rows
        r1 = int(round(push_total * rng.uniform(0.50, 0.65)))
        r1 = max(100, min(r1, push_total - 100))
        r2 = push_total - r1
        t2 = rng.choice([1, 2])

        # 5. Base rate g(t) and modulation m(t)
        # 2-4 random waves/pauses
        num_waves = rng.randint(2, 4)
        waves = []
        for _ in range(num_waves):
            waves.append({
                "depth": rng.uniform(0.15, 0.50),
                "width": rng.uniform(0.03, 0.07),
                "center": rng.uniform(0.12, 0.85)
            })

        start_hour = 14.0 # BD time 14:00 or random

        rates_tick = []
        for i in range(T + 1):
            t = i / float(T)
            # g(t) = 0.18 + 2.46 t^2
            g = 0.18 + 2.46 * (t ** 2)

            # m(t)
            wave_sum = 0.0
            for w in waves:
                wave_sum += w["depth"] * math.exp(-0.5 * ((t - w["center"]) / w["width"]) ** 2)
            
            curr_hour = (start_hour + i * 0.25) % 24.0
            diurnal = 0.15 * math.sin(2.0 * math.pi * (curr_hour - 14.0) / 24.0)
            m = 1.0 - wave_sum + diurnal
            m = max(0.4, m)

            # Easing down over the last 8% of duration to 70%
            if t > 0.92:
                s = (t - 0.92) / 0.08
                smooth = smoothstep(0.0, 1.0, s)
                ease = 1.0 - 0.30 * smooth
                m *= ease

            rates_tick.append(g * m)

        # Cumulative curve C(t)
        cum_rates = [0.0]
        for val in rates_tick[1:]:
            cum_rates.append(cum_rates[-1] + val)
        total_rate_sum = cum_rates[-1]
        
        target_C = []
        for i in range(T + 1):
            frac = cum_rates[i] / total_rate_sum
            target_C.append(push_total + (views_total - push_total) * frac)

        # 6. Row loop
        CAP = max(int(round(0.03 * views_total)), 300)

        # Initial push rows
        # Row 1 at tick 0
        # Row 2 at tick t2
        rows = [
            {"tick": 0, "views": r1},
            {"tick": t2, "views": r2}
        ]
        delivered = r1 + r2
        curr_t = t2

        gap_choices = [1, 2, 3, 4, 5, 6]

        while curr_t < T:
            # Pick gap k
            k = rng.choices(gap_choices, weights=self.GAP_WEIGHTS)[0]
            # Extend k while C(t+k) - delivered < 150, up to 16 ticks
            while (curr_t + k < T) and (target_C[min(curr_t + k, T)] - delivered < 150) and (k < 16):
                k += 1
            # Shrink k while C(t+k) - delivered > 0.67 * CAP
            while (k > 1) and (target_C[min(curr_t + k, T)] - delivered > 0.67 * CAP):
                k -= 1

            if curr_t + k >= T:
                break

            target_inc = target_C[curr_t + k] - delivered
            noise = math.exp(rng.gauss(0, 0.4))
            noise = max(0.55, min(1.7, noise))
            row_views = int(round(target_inc * noise))
            row_views = max(100, min(CAP, row_views))

            # If size <= 112, use 100 + rand(0..74)
            if row_views <= 112:
                row_views = 100 + rng.randint(0, 74)

            # Prevent overshooting remainder < 100
            rem_after = views_total - (delivered + row_views)
            if rem_after < 100:
                break

            rows.append({"tick": curr_t + k, "views": row_views})
            delivered += row_views
            curr_t += k

        # Last row sits at tick T with the remainder
        rem = views_total - delivered
        if rem < 100:
            rows[-1]["views"] += rem
            rows[-1]["tick"] = T
        else:
            rows.append({"tick": T, "views": rem})

        # Rebalance views and ensure:
        # no two adjacent equal, no value used more than twice, sum == views_total exactly
        rows = self._rebalance_views(rows, views_total, CAP, rng)

        # 7. Engagement distribution
        rows = self._distribute_engagement(rows, views_total, push_total, rates, totals, rng)

        return {
            "views_total": views_total,
            "duration_hours": actual_hours,
            "duration_label": format_duration(actual_hours),
            "rates": rates,
            "totals": totals,
            "rows": rows,
            "CAP": CAP,
        }

    def _rebalance_views(self, rows, views_total, CAP, rng):
        # 1. Eliminate adjacent equals and limit duplicates to <= 2
        for _ in range(50):
            has_issue = False
            val_counts = {}
            for r in rows:
                val_counts[r["views"]] = val_counts.get(r["views"], 0) + 1

            for i in range(len(rows)):
                # check adjacent
                if i > 0 and rows[i]["views"] == rows[i - 1]["views"]:
                    has_issue = True
                    delta = rng.choice([-5, -3, 3, 5])
                    if 100 <= rows[i]["views"] + delta <= CAP:
                        rows[i]["views"] += delta

                # check duplicate count > 2
                if val_counts.get(rows[i]["views"], 0) > 2 and 1 < i < len(rows) - 1:
                    has_issue = True
                    delta = rng.choice([-7, -4, 4, 7])
                    if 100 <= rows[i]["views"] + delta <= CAP:
                        val_counts[rows[i]["views"]] -= 1
                        rows[i]["views"] += delta
                        val_counts[rows[i]["views"]] = val_counts.get(rows[i]["views"], 0) + 1

            if not has_issue:
                break

        # 2. Rebalance difference over interior rows in steps of 1-7
        diff = views_total - sum(r["views"] for r in rows)
        attempts = 0
        interior_indices = list(range(1, len(rows) - 1)) if len(rows) > 2 else [0]
        while diff != 0 and attempts < 1000:
            attempts += 1
            idx = rng.choice(interior_indices)
            step = min(abs(diff), rng.randint(1, 7))
            sign = 1 if diff > 0 else -1
            candidate = rows[idx]["views"] + sign * step
            
            # Check constraints
            if 100 <= candidate <= CAP:
                # check adjacent
                prev_val = rows[idx - 1]["views"] if idx > 0 else -1
                next_val = rows[idx + 1]["views"] if idx < len(rows) - 1 else -1
                if candidate != prev_val and candidate != next_val:
                    # check max twice
                    cnt = sum(1 for r in rows if r["views"] == candidate)
                    if cnt < 2:
                        rows[idx]["views"] = candidate
                        diff -= sign * step

        return rows

    def _distribute_engagement(self, rows, views_total, push_total, rates, totals, rng):
        # Initialize service fields on rows
        for r in rows:
            for s in ["likes", "saves", "reposts", "shares", "comments"]:
                r[s] = 0

        services = ["likes", "saves", "reposts", "shares", "comments"]
        
        # Calculate inflow per service per row
        # inflow = counted_views * rate * lognormal(0, 0.25)
        # counted_views = 0.5 * views_this_row + 0.5 * views_previous_row (+ 0.5 * views on last row)
        p = push_total / float(views_total)
        avg_likes = rates["likes"]
        # plateau R = (avg - p*0.025 - (1-p)*0.15*0.025) / ((1-p)*0.85)
        R_likes = (avg_likes - p * 0.025 - (1 - p) * 0.15 * 0.025) / max(0.001, ((1 - p) * 0.85))

        service_phases = {s: rng.uniform(0, 2 * math.pi) for s in services}

        # Calculate counted views and inflows
        cum_v = 0
        raw_inflows = {s: [] for s in services}
        for i, r in enumerate(rows):
            v_curr = r["views"]
            v_prev = rows[i - 1]["views"] if i > 0 else 0
            counted_v = 0.5 * v_curr + 0.5 * v_prev
            if i == len(rows) - 1:
                counted_v += 0.5 * v_curr
            cum_v += v_curr
            f_views = cum_v / float(views_total)

            for s in services:
                if totals[s] == 0:
                    raw_inflows[s].append(0.0)
                    continue

                if s == "likes":
                    if cum_v <= push_total:
                        r_s = 0.025
                    else:
                        f_post = (cum_v - push_total) / max(1.0, float(views_total - push_total))
                        if f_post <= 0.30:
                            r_s = 0.025 + (f_post / 0.30) * (R_likes - 0.025)
                        else:
                            r_s = R_likes
                else:
                    r_s = rates[s] * (1.0 + 0.2 * math.sin(2.0 * math.pi * f_views + service_phases[s]))

                noise = math.exp(rng.gauss(0, 0.25))
                raw_inflows[s].append(counted_v * r_s * noise)

        # Scale inflows so sum equals totals[s] exactly
        scaled_inflows = {s: [] for s in services}
        for s in services:
            tot = totals[s]
            if tot == 0:
                scaled_inflows[s] = [0.0] * len(rows)
            else:
                s_sum = sum(raw_inflows[s])
                if s_sum <= 0:
                    scaled_inflows[s] = [tot / float(len(rows))] * len(rows)
                else:
                    factor = tot / s_sum
                    scaled_inflows[s] = [val * factor for val in raw_inflows[s]]

        # Small total services handling (< 3 * mn)
        # schedule floor(total/mn) releases at ~25%, 55%, 85% of views (jittered +-4%)
        # Never after 85%.
        small_scheduled_releases = {s: {} for s in services}
        for s in services:
            tot = totals[s]
            mn = self.PROVIDER_MINIMUMS[s]
            batch_mn = 2 if s == "comments" else mn
            if 0 < tot < 3 * batch_mn:
                num_rel = max(1, tot // batch_mn)
                if num_rel == 1:
                    target_fracs = [rng.uniform(0.40, 0.60)]
                elif num_rel == 2:
                    target_fracs = [rng.uniform(0.25, 0.35), rng.uniform(0.65, 0.75)]
                else:
                    target_fracs = [
                        rng.uniform(0.21, 0.29),
                        rng.uniform(0.51, 0.59),
                        rng.uniform(0.81, 0.85)
                    ]
                # Find matching row indices by cumulative views
                cv = 0
                chosen_rows = []
                for idx, r in enumerate(rows):
                    cv += r["views"]
                    frac = cv / float(views_total)
                    if target_fracs and frac >= target_fracs[0]:
                        chosen_rows.append(idx)
                        target_fracs.pop(0)
                while len(chosen_rows) < num_rel:
                    chosen_rows.append(min(len(rows) - 2, len(rows) // 2))

                # Partition total
                rem_tot = tot
                parts = []
                for rel_i in range(num_rel - 1):
                    # each >= batch_mn
                    p_val = batch_mn + rng.randint(0, max(0, (rem_tot - (num_rel - rel_i) * batch_mn) // 2))
                    parts.append(p_val)
                    rem_tot -= p_val
                parts.append(rem_tot)
                for r_idx, p_val in zip(chosen_rows, parts):
                    small_scheduled_releases[s][r_idx] = p_val

        # Buffers and gate release loop
        buffers = {s: 0.0 for s in services}
        service_prev_release = {s: None for s in services}
        service_val_counts = {s: {} for s in services}
        service_released_count = {s: 0 for s in services}

        # Track service combination pattern
        prev_combo = None
        combo_repeat_count = 0

        cum_views_arr = []
        cv = 0
        for r in rows:
            cv += r["views"]
            cum_views_arr.append(cv)

        for i, r in enumerate(rows):
            v_curr = r["views"]
            is_last_row = (i == len(rows) - 1)
            row_services = []

            for s in services:
                tot = totals[s]
                if tot == 0:
                    continue
                mn = self.PROVIDER_MINIMUMS[s]
                batch_mn = 2 if s == "comments" else mn

                # If small total service handled separately
                if tot < 3 * batch_mn:
                    if i in small_scheduled_releases[s]:
                        val = small_scheduled_releases[s][i]
                        r[s] = val
                        row_services.append(s)
                    continue

                buffers[s] += scaled_inflows[s][i]

                # Check release condition
                # Gate probability: <200 -> 0.25, 200-349 -> 0.55, 350+ -> 0.85
                if v_curr < 200:
                    gate_p = 0.25
                elif v_curr < 350:
                    gate_p = 0.55
                else:
                    gate_p = 0.85

                gate_passes = (rng.random() < gate_p)
                should_release = (buffers[s] >= batch_mn) and ((buffers[s] >= 1.6 * batch_mn) or gate_passes)

                if should_release and not is_last_row:
                    rel_size = max(batch_mn, int(round(buffers[s] * rng.uniform(0.80, 1.00))))
                    rel_size = min(int(buffers[s]), rel_size)

                    # Variety checks:
                    # - no repeated release size in consecutive releases (comments exempt)
                    # - no value more than max(2, ceil(0.15 * count))
                    max_repeats = max(2, math.ceil(0.15 * max(10, tot // batch_mn)))
                    if s != "comments" and rel_size == service_prev_release[s]:
                        rel_size += rng.choice([1, 2, 3, 4, 5, 6])
                    if service_val_counts[s].get(rel_size, 0) >= max_repeats:
                        rel_size += rng.choice([1, 2, 3, 4, 5, 6])

                    # Ensure <= buffers[s] and >= batch_mn
                    if batch_mn <= rel_size <= int(buffers[s]):
                        r[s] = rel_size
                        buffers[s] -= rel_size
                        service_prev_release[s] = rel_size
                        service_val_counts[s][rel_size] = service_val_counts[s].get(rel_size, 0) + 1
                        service_released_count[s] += 1
                        row_services.append(s)

            # Combo repeat rule: same combination of services in at most 2 rows in a row
            combo_key = tuple(sorted(row_services))
            if combo_key == prev_combo:
                combo_repeat_count += 1
                if combo_repeat_count >= 2:
                    # force or drop
                    # if empty row, force one ready service if buffer >= mn
                    if not row_services:
                        for s in services:
                            mn = self.PROVIDER_MINIMUMS[s]
                            batch_mn = 2 if s == "comments" else mn
                            if totals[s] >= 3 * batch_mn and buffers[s] >= batch_mn and not is_last_row:
                                r[s] = batch_mn
                                buffers[s] -= batch_mn
                                row_services.append(s)
                                break
                    elif len(row_services) > 1:
                        # drop one
                        drop_s = row_services.pop()
                        buffers[drop_s] += r[drop_s]
                        r[drop_s] = 0
                    combo_key = tuple(sorted(row_services))
                    combo_repeat_count = 0
            else:
                prev_combo = combo_key
                combo_repeat_count = 0

        # Last row tops up each service to its exact total
        for s in services:
            tot = totals[s]
            if tot == 0:
                continue
            mn = self.PROVIDER_MINIMUMS[s]
            batch_mn = 2 if s == "comments" else mn
            delivered_s = sum(r[s] for r in rows)
            rem_s = tot - delivered_s
            if rem_s > 0:
                if rem_s >= batch_mn:
                    rows[-1][s] += rem_s
                else:
                    # merge into latest release
                    for r in reversed(rows[:-1]):
                        if r[s] > 0:
                            r[s] += rem_s
                            rem_s = 0
                            break
                    if rem_s > 0:
                        rows[-1][s] += rem_s

        return rows

    def validate(self, plan):
        views_total = plan["views_total"]
        rows = plan["rows"]
        dur = plan["duration_hours"]
        CAP = plan["CAP"]
        rates = plan["rates"]
        totals = plan["totals"]

        # 1. Totals exact
        if sum(r["views"] for r in rows) != views_total:
            return False, "Views sum mismatch"

        for s, tot in totals.items():
            if sum(r[s] for r in rows) != tot:
                return False, f"{s} total mismatch: {sum(r[s] for r in rows)} != {tot}"

        # 2. Every realized rate inside its range
        for s, (r_min, r_max) in self.RATE_RANGES.items():
            if totals[s] > 0:
                real_r = totals[s] / float(views_total)
                # allow 0.0005 tolerance for rounding
                if not (r_min - 0.001 <= real_r <= r_max + 0.001):
                    return False, f"Rate {s} {real_r:.4f} out of range ({r_min}, {r_max})"

        # 3. Every batch views >= 100 and <= CAP (post-push rows <= CAP, push rows <= push_max)
        push_max = self.pkg["push"][1]
        for idx, r in enumerate(rows):
            limit = push_max if idx < 2 else CAP
            if r["views"] < 100 or r["views"] > limit:
                return False, f"Batch index {idx} views {r['views']} out of bounds [100, {limit}]"

        # 4. No engagement-only rows
        for r in rows:
            if r["views"] <= 0:
                return False, "Engagement-only row found"

        # 5. No equal adjacent view batches
        for i in range(1, len(rows)):
            if rows[i]["views"] == rows[i - 1]["views"]:
                return False, f"Equal adjacent view batches: {rows[i]['views']}"

        # 6. No release below provider minimum
        for r in rows:
            for s, mn in self.PROVIDER_MINIMUMS.items():
                if r[s] > 0 and r[s] < mn:
                    return False, f"Release {s} = {r[s]} below min {mn}"

        # 7. No gap over 4 hours (16 ticks)
        for i in range(1, len(rows)):
            gap_ticks = rows[i]["tick"] - rows[i - 1]["tick"]
            if gap_ticks > 16:
                return False, f"Gap {gap_ticks} ticks > 16 (4 hours)"

        # 8. All times on the grid and increasing
        for i in range(len(rows)):
            if rows[i]["tick"] < 0:
                return False, "Negative tick"
            if i > 0 and rows[i]["tick"] <= rows[i - 1]["tick"]:
                return False, "Ticks not strictly increasing"

        # 9. Same service combo at most 2 rows in a row
        prev_combo = None
        rep = 0
        for r in rows:
            combo = tuple(sorted(s for s in ["views", "likes", "saves", "reposts", "shares", "comments"] if r[s] > 0))
            if combo == prev_combo:
                rep += 1
                if rep > 2:
                    return False, f"Same service combination repeated {rep} times"
            else:
                prev_combo = combo
                rep = 0

        # 10. Peak window rate <= 3x average rate
        # window = max(1 hour, duration / 8)
        win_hours = max(1.0, dur / 8.0)
        win_ticks = int(round(win_hours * 4))
        avg_hourly_rate = views_total / float(dur)

        for i in range(len(rows)):
            start_tick = rows[i]["tick"]
            end_tick = start_tick + win_ticks
            win_views = sum(r["views"] for r in rows if start_tick <= r["tick"] <= end_tick)
            win_rate = win_views / float(win_hours)
            if win_rate > 3.0 * avg_hourly_rate + 1.0: # allow small float tolerance
                return False, f"Peak window rate {win_rate:.1f} > 3x avg {avg_hourly_rate:.1f}"

        return True, "Valid"

    def generate_plan(self):
        curr_seed = self.seed
        for attempt in range(50):
            self.rng = random.Random(curr_seed)
            plan = self.generate_single_try()
            valid, reason = self.validate(plan)
            if valid:
                plan["seed"] = curr_seed
                plan["attempts"] = attempt + 1
                return plan
            curr_seed += 1
        raise RuntimeError(f"Failed to generate valid plan after 50 attempts: {reason}")

def run_acceptance_tests():
    print("=" * 60)
    print("RUNNING ACCEPTANCE TESTS (200 seeds per package)")
    print("=" * 60)

    packages = ["2K", "5K", "10K", "15K", "50K"]
    first_try_passes = {pkg: 0 for pkg in packages}
    sample_plans = {}

    for pkg in packages:
        print(f"\nTesting package: {pkg} ...")
        all_views = []
        all_batches = []
        all_longest_gaps = []
        all_first_likes = []
        all_reposts_dropped = 0
        all_shares_dropped = 0
        
        # We test 200 seeds
        for s in range(1000, 1200):
            engine = PlanEngine(pkg, followers=1500, seed=s)
            
            # Check first try pass rate
            plan_try1 = engine.generate_single_try()
            valid, _ = engine.validate(plan_try1)
            if valid:
                first_try_passes[pkg] += 1

            # Generate validated plan
            plan = engine.generate_plan()
            if s == 1000:
                sample_plans[pkg] = plan

            rows = plan["rows"]
            all_views.append(plan["views_total"])
            all_batches.append(len(rows))

            # longest gap in minutes
            gaps = [(rows[i]["tick"] - rows[i-1]["tick"]) * 15 for i in range(1, len(rows))]
            all_longest_gaps.append(max(gaps) if gaps else 0)

            # first likes appear at cumulative views
            cum_v = 0
            first_like_v = None
            for r in rows:
                cum_v += r["views"]
                if r["likes"] > 0 and first_like_v is None:
                    first_like_v = cum_v
            all_first_likes.append(first_like_v if first_like_v is not None else 0)

            if plan["totals"]["reposts"] == 0:
                all_reposts_dropped += 1
            if plan["totals"]["shares"] == 0:
                all_shares_dropped += 1

        pass_rate = (first_try_passes[pkg] / 200.0) * 100.0
        print(f"[{pkg}] 1st-try Pass Rate: {pass_rate:.1f}%")
        print(f"[{pkg}] views_total range: {min(all_views)} - {max(all_views)}")
        print(f"[{pkg}] batches range:     {min(all_batches)} - {max(all_batches)}")
        print(f"[{pkg}] longest gap range: {min(all_longest_gaps)} - {max(all_longest_gaps)} min")
        print(f"[{pkg}] first likes at:    {min(all_first_likes)} - {max(all_first_likes)} views")
        if pkg == "2K":
            print(f"[{pkg}] reposts dropped:  {(all_reposts_dropped/200.0)*100.0:.1f}% (target ~29%)")
            print(f"[{pkg}] shares dropped:   {(all_shares_dropped/200.0)*100.0:.1f}% (target ~11%)")

    print("\n" + "=" * 60)
    print("ALL 200-SEED ACCEPTANCE TESTS COMPLETED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_acceptance_tests()
