"""
v3 risk scorer — continuous piecewise-linear concern functions.
Anchored at clinical thresholds (ACC/AHA, NEWS2, qSOFA), asymmetric slopes.
Inspired by Churpek CART/eCART (Crit Care Med 2012).
"""
import numpy as np
from collections import Counter

rng = np.random.default_rng(42)

CRITICAL_COMPLAINT_TERMS = [
    "chest pain","breathless","dyspn","unconscious","convulsion",
    "seizure","stroke","cardiac","syncope","severe bleeding",
    "loss of consciousness","hemorrhage","anaphylax",
]
def complaint_critical(complaint):
    if not complaint: return False
    cl = complaint.lower()
    return any(t in cl for t in CRITICAL_COMPLAINT_TERMS)

def is_missing(v, vital):
    if v is None or (isinstance(v, float) and np.isnan(v)): return True
    if vital in ("spo2", "rbs", "temperature") and v == 0: return True
    return False


def piecewise(value, anchors):
    """
    Linear interpolation between anchor points. Anchors must be sorted by x.
    Outside the range, returns the nearest endpoint.
    """
    xs = [a[0] for a in anchors]; ys = [a[1] for a in anchors]
    if value <= xs[0]:  return ys[0]
    if value >= xs[-1]: return ys[-1]
    for i in range(len(xs) - 1):
        if xs[i] <= value <= xs[i+1]:
            frac = (value - xs[i]) / (xs[i+1] - xs[i])
            return ys[i] + frac * (ys[i+1] - ys[i])
    return 0.0


# ── Anchor points for each vital ─────────────────────────────────────────────
# Source: ACC/AHA 2017 BP, NEWS2 thresholds, qSOFA, SOFA, sepsis-3 criteria
# Asymmetric: steeper slopes on the more-dangerous side.

# Anchors aligned to tier thresholds: <0.40 Green, 0.40–0.69 Amber, ≥0.70 Red.

SBP_ANCHORS = [
    (50, 0.95), (70, 0.90), (85, 0.85), (90, 0.72),    # ≤90 = Red
    (95, 0.55), (100, 0.42),                              # 95 = Amber zone
    (110, 0.10), (120, 0.00), (130, 0.00),               # normal plateau
    (140, 0.20), (150, 0.32), (160, 0.42),               # 160 = Amber
    (170, 0.55), (179, 0.65), (180, 0.72),               # 180 = Red
    (200, 0.85), (220, 0.95)
]

DBP_ANCHORS = [
    (30, 0.92), (50, 0.72), (55, 0.42), (60, 0.10),
    (70, 0.00), (80, 0.00),
    (90, 0.10), (100, 0.42), (110, 0.55),
    (119, 0.65), (120, 0.72), (140, 0.95)
]

PULSE_ANCHORS = [
    (30, 0.95), (40, 0.85), (45, 0.72), (50, 0.42), (55, 0.20),
    (60, 0.00), (90, 0.00),                             # normal plateau
    (100, 0.20), (110, 0.42), (120, 0.55), (129, 0.65), # Amber zone
    (130, 0.72), (150, 0.85), (180, 0.92), (220, 0.95)  # 130 = Red
]

TEMP_ANCHORS = [                                          # °F
    (90, 0.95), (93, 0.90), (95, 0.72),                  # ≤95 = Red
    (96, 0.42), (97, 0.10), (98, 0.00), (99, 0.00),      # normal
    (100.4, 0.10), (101, 0.42), (102, 0.55),             # 101 = Amber
    (102.9, 0.65), (103, 0.72), (104, 0.85), (106, 0.95) # 103 = Red
]

RR_ANCHORS = [
    (4, 0.95), (8, 0.85), (9, 0.72), (10, 0.55), (11, 0.42),
    (12, 0.05), (15, 0.00), (20, 0.00),                  # normal
    (21, 0.42), (24, 0.55), (27, 0.65),                  # 21 = Amber
    (28, 0.72), (32, 0.85), (40, 0.95)                    # 28 = Red
]

SPO2_ANCHORS = [
    (60, 0.98), (75, 0.95), (85, 0.92), (88, 0.85),
    (90, 0.78), (92, 0.72),                              # 92 = Red
    (93, 0.55), (94, 0.42),                              # 93-94 = Amber
    (95, 0.15), (96, 0.05), (98, 0.00), (100, 0.00)
]

RBS_ANCHORS = [
    (30, 0.95), (50, 0.85), (60, 0.72),                  # ≤60 = Red
    (70, 0.20), (80, 0.00), (140, 0.00),                 # normal
    (180, 0.05), (200, 0.20), (250, 0.42),               # 250 = Amber
    (300, 0.55), (399, 0.65), (400, 0.72),               # 400 = Red
    (500, 0.85), (700, 0.95)
]


def vital_concern(value, vital):
    if is_missing(value, vital): return None
    M = {"systole": SBP_ANCHORS, "diastole": DBP_ANCHORS, "pulse": PULSE_ANCHORS,
         "temperature": TEMP_ANCHORS, "rr": RR_ANCHORS, "spo2": SPO2_ANCHORS, "rbs": RBS_ANCHORS}
    return piecewise(value, M[vital])


def score_v3(t, p, rr, sy, di, o2, bs, age, complaint):
    """
    Returns (probability, breakdown_dict).
    Continuous, evidence-based.
    """
    concerns = {
        "Temp":   vital_concern(t,  "temperature"),
        "Pulse":  vital_concern(p,  "pulse"),
        "RR":     vital_concern(rr, "rr"),
        "SBP":    vital_concern(sy, "systole"),
        "DBP":    vital_concern(di, "diastole"),
        "SpO2":   vital_concern(o2, "spo2"),
        "RBS":    vital_concern(bs, "rbs"),
    }
    measured = {k: v for k, v in concerns.items() if v is not None}

    # Base = max single-vital concern (single severe vital should drive tier)
    base = max(measured.values(), default=0.0)

    # Geriatric uplift (asymmetric — only adds, never subtracts)
    if age >= 75:
        base = max(base, 0.42)
    elif age >= 65:
        base = max(base, base + 0.05)  # small bump

    # Critical complaint override
    if complaint_critical(complaint):
        base = max(base, 0.85)

    # qSOFA-like sepsis: count vitals > 0.30 in fever / tachy / tachypnea
    sepsis_vitals = sum(1 for k in ("Temp","Pulse","RR")
                        if measured.get(k, 0) >= 0.30)
    if sepsis_vitals >= 2:
        base = max(base, 0.75)  # escalate to Red

    # Multi-Amber: 3+ vitals in moderate-concern range → modest escalation
    n_concerning = sum(1 for v in measured.values() if v >= 0.30)
    if n_concerning >= 3:
        base = max(base, 0.65)

    p_final = float(np.clip(base, 0.0, 0.99))
    return p_final, measured


def golden_v2(t, p, rr, sy, di, o2, bs, age, complaint):
    if complaint_critical(complaint): return "Red"
    red = 0; amber = 0; fa = ta = tpa = False
    if not is_missing(o2, "spo2") and o2 <= 92: red += 1
    if not is_missing(t, "temperature") and (t >= 103 or t <= 95): red += 1
    if not is_missing(p, "pulse") and (p >= 130 or p <= 45): red += 1
    if not is_missing(sy, "systole") and (sy >= 180 or sy <= 90): red += 1
    if not is_missing(di, "diastole") and (di >= 120 or di <= 50): red += 1
    if not is_missing(rr, "rr") and (rr >= 28 or rr <= 9): red += 1
    if not is_missing(bs, "rbs") and (bs >= 400 or bs <= 60): red += 1
    if not is_missing(o2, "spo2") and 93 <= o2 <= 94: amber += 1
    if not is_missing(t, "temperature") and 101 <= t < 103:
        amber += 1; fa = True
    if not is_missing(p, "pulse") and 110 <= p < 130:
        amber += 1; ta = True
    elif not is_missing(p, "pulse") and 46 <= p <= 50: amber += 1
    if not is_missing(sy, "systole") and (160 <= sy < 180 or 91 <= sy <= 100): amber += 1
    if not is_missing(di, "diastole") and (100 <= di < 120 or 51 <= di <= 55): amber += 1
    if not is_missing(rr, "rr") and 21 <= rr <= 27:
        amber += 1; tpa = True
    if not is_missing(bs, "rbs") and 250 <= bs < 400: amber += 1
    if age >= 75: amber += 1
    if sum([fa, ta, tpa]) >= 2: return "Red"
    if red > 0: return "Red"
    if amber > 0: return "Amber"
    return "Green"


def tier(p): return "Red" if p >= 0.7 else "Amber" if p >= 0.4 else "Green"


def normal_vitals():
    return dict(t=round(rng.uniform(97.0, 99.0), 1),
        p=int(rng.integers(60, 95)), rr=int(rng.integers(12, 20)),
        sy=int(rng.integers(105, 135)), di=int(rng.integers(65, 85)),
        o2=int(rng.integers(96, 100)),
        bs=int(rng.choice([0, rng.integers(80, 140)])),
        age=int(rng.integers(20, 65)), complaint="Cough")

def gen_cases(n=70):
    cases = []
    for _ in range(n): cases.append(("normal", normal_vitals()))
    for _ in range(n):
        c = normal_vitals(); c["o2"] = int(rng.integers(75, 92)); cases.append(("severe_hypoxia", c))
    for _ in range(n):
        c = normal_vitals(); c["o2"] = int(rng.integers(93, 95)); cases.append(("mild_hypoxia", c))
    for _ in range(n):
        c = normal_vitals(); c["p"] = int(rng.integers(130, 200)); cases.append(("severe_tachy", c))
    for _ in range(n):
        c = normal_vitals(); c["p"] = int(rng.integers(110, 130)); cases.append(("mild_tachy", c))
    for _ in range(n):
        c = normal_vitals(); c["sy"] = int(rng.integers(180, 230)); c["di"] = int(rng.integers(95, 130)); cases.append(("htn_crisis", c))
    for _ in range(n):
        c = normal_vitals(); c["sy"] = int(rng.integers(160, 180)); c["di"] = int(rng.integers(90, 100)); cases.append(("stage2_htn", c))
    for _ in range(n):
        c = normal_vitals(); c["sy"] = int(rng.integers(70, 91)); c["di"] = int(rng.integers(40, 60)); cases.append(("hypotension", c))
    for _ in range(n):
        c = normal_vitals(); c["t"] = round(rng.uniform(103.0, 106.0), 1); cases.append(("high_fever", c))
    for _ in range(n):
        c = normal_vitals(); c["t"] = round(rng.uniform(101.0, 103.0), 1); cases.append(("mod_fever", c))
    for _ in range(n):
        c = normal_vitals(); c["t"] = round(rng.uniform(92.0, 95.0), 1); cases.append(("hypothermia", c))
    for _ in range(n):
        c = normal_vitals(); c["rr"] = int(rng.integers(28, 45)); cases.append(("severe_tachypnea", c))
    for _ in range(n):
        c = normal_vitals(); c["bs"] = int(rng.integers(400, 700)); cases.append(("severe_hyperglyc", c))
    for _ in range(n):
        c = normal_vitals(); c["bs"] = int(rng.integers(30, 60)); cases.append(("hypoglycemia", c))
    for term in ["Chest pain","Breathlessness","Dyspnea","Syncope","Convulsion"]:
        for _ in range(n//5 + 5):
            c = normal_vitals(); c["complaint"] = term; cases.append(("crit_complaint", c))
    for _ in range(n):
        c = normal_vitals()
        c["t"] = round(rng.uniform(101.5, 104), 1)
        c["p"] = int(rng.integers(105, 130))
        c["rr"] = int(rng.integers(22, 28))
        cases.append(("sepsis_pattern", c))
    for _ in range(20):
        c = dict(t=0, p=80, rr=18, sy=120, di=80, o2=0, bs=0, age=int(rng.integers(20,65)), complaint="Cough")
        cases.append(("missing_vitals", c))
    for _ in range(n):
        c = normal_vitals(); c["age"] = int(rng.integers(76, 95)); cases.append(("geriatric_normal", c))
    return cases


def run_test():
    cases = gen_cases(70)
    by_cat = {}; conf = Counter()
    for cat, c in cases:
        true_t = golden_v2(c["t"], c["p"], c["rr"], c["sy"], c["di"], c["o2"], c["bs"], c["age"], c["complaint"])
        p, _ = score_v3(c["t"], c["p"], c["rr"], c["sy"], c["di"], c["o2"], c["bs"], c["age"], c["complaint"])
        pred_t = tier(p)
        st = by_cat.setdefault(cat, {"total":0,"correct":0,"fail":[]})
        st["total"] += 1
        if pred_t == true_t: st["correct"] += 1
        else: st["fail"].append((c, true_t, pred_t, p))
        conf[(true_t, pred_t)] += 1

    for cat, st in sorted(by_cat.items()):
        acc = st["correct"]/st["total"]*100
        marker = "✅" if acc >= 95 else "⚠️" if acc >= 80 else "❌"
        print(f"{marker} {cat:<22} | {acc:>5.1f}% | {st['total']}")
        for f in st["fail"][:1]:
            c, tt, pt, pp = f
            print(f"     fail: T={c['t']} P={c['p']} RR={c['rr']} BP={c['sy']}/{c['di']} O2={c['o2']} RBS={c['bs']} age={c['age']} → true={tt}, pred={pt} ({pp:.2f})")

    correct = sum(n for (tr,pr),n in conf.items() if tr==pr)
    total = sum(conf.values())
    fn = sum(n for (tr,pr),n in conf.items() if tr=="Red" and pr!="Red")
    fp = sum(n for (tr,pr),n in conf.items() if pr=="Red" and tr!="Red")
    print(f"\nOverall: {correct/total*100:.1f}%   FN={fn}   FP={fp}")

    # Demonstrate the gradient — what we couldn't show before
    print("\n=== SBP gradient demo (everything else normal: T=98.6, P=80, RR=18, DBP=80, SpO2=98) ===")
    print(f"{'SBP':>5} | {'P_final':>8} | {'tier':>6} | {'SBP_concern':>12}")
    for s in [80, 85, 90, 95, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 220]:
        p, m = score_v3(98.6, 80, 18, s, 80, 98, np.nan, 45, "Cough")
        print(f"{s:>5} | {p*100:>7.1f}% | {tier(p):>6} | {m['SBP']*100:>11.1f}%")

    print("\n=== Pulse gradient demo ===")
    for px in [40, 50, 55, 60, 80, 100, 110, 120, 130, 150, 180, 200]:
        p, m = score_v3(98.6, px, 18, 120, 80, 98, np.nan, 45, "Cough")
        print(f"  pulse={px:>3}  P={p*100:>5.1f}%  tier={tier(p)}")

    print("\n=== Temperature gradient demo (°F) ===")
    for t in [94, 95, 96, 97, 98.6, 99, 100, 101, 102, 103, 104, 105]:
        p, m = score_v3(t, 80, 18, 120, 80, 98, np.nan, 45, "Cough")
        print(f"  temp={t:>5}  P={p*100:>5.1f}%  tier={tier(p)}")

    print("\n=== SpO2 gradient demo ===")
    for o in [85, 88, 90, 91, 92, 93, 94, 95, 96, 98]:
        p, m = score_v3(98.6, 80, 18, 120, 80, o, np.nan, 45, "Cough")
        print(f"  spo2={o:>3}  P={p*100:>5.1f}%  tier={tier(p)}")

run_test()
