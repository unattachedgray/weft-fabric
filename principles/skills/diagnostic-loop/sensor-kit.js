/* sensor-kit — a sensor that must prove it can be WRONG before you may read it.
 *
 * The requirement it implements: a sensor has to confirm the outcome EITHER
 * WAY. Not "report or stay silent" — silence must itself be a verdict you can
 * trust. That needs all four cells ruled on:
 *
 *                     phenomenon present     phenomenon absent
 *   sensor fires      true positive          FALSE POSITIVE   <- negative control
 *   sensor silent     FALSE NEGATIVE         true negative
 *                     ^ positive control
 *
 * A positive control alone proves it CAN fire. A negative control alone proves
 * it is not just noisy. You need both, or a null is uninterpretable — that is
 * the exact hole that cost a whole session: an instrument that had never been
 * shown to fire returned nothing, and "nothing" was read as "absent".
 *
 * It also forces the DECISION RULE to be written down BEFORE the run, so the
 * data decides instead of the narrative. Post-hoc reinterpretation of a null is
 * how five plausible fixes shipped against an un-localised cause.
 *
 * Contract: report() THROWS unless — in this same run — the sensor is alive,
 * BOTH controls passed, preconditions hold, and an expectation was registered.
 * What it returns is a verdict (CONFIRMED / REFUTED), never a bare number.
 *
 *   const s = SensorKit.create("composer", {
 *     sample: () => ({ h: SensorKit.visible("textarea").style.height }),
 *     attrs:  { target: () => SensorKit.visible("textarea"), filter: ["style"] },
 *     preconditions: [["focused", () => document.hasFocus()]],
 *   });
 *   await s.positiveControl(() => SensorKit.visible("textarea").style.height = "99px");
 *   await s.negativeControl(() => {});                  // idle: must stay quiet
 *   s.expect("composer resizes while typing", r => r.events > 0);
 *   s.reset();
 *   await typeThroughTheRealPath();                     // NOT a synthetic shortcut
 *   s.report();   // -> {trust:"TRUSTED", verdict:"REFUTED", ...}
 */
(function (root) {
  "use strict";

  const twoFrames = () =>
    new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const SensorKit = {
    /** Re-query every time: a node held across renders goes stale silently, and
     *  every later measurement then reads a detached element. */
    el(sel, pick) {
      const all = Array.prototype.slice.call(document.querySelectorAll(sel));
      return (pick ? all.filter(pick)[0] : all[0]) || null;
    },

    /** Visible-only: skips hidden shims (IME helpers, offscreen mirrors). */
    visible(sel) {
      return SensorKit.el(sel, (n) => {
        const r = n.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
    },

    create(name, opts) {
      opts = opts || {};
      const S = {
        name,
        armedAt: new Date().toTimeString().slice(0, 8),
        frames: 0,
        events: [],
        rebinds: 0,
        alive: true,
        pos: null,          // null = not run, true/false = result
        neg: null,
        expectation: null,
      };

      const emit = (kind, detail) => {
        S.events.push({ t: Date.now(), kind, detail: String(detail).slice(0, 200) });
        if (S.events.length > 2000) S.events = S.events.slice(-2000);
      };

      let bound = null;
      let mo = opts.attrs
        ? new MutationObserver((ms) => {
            for (let i = 0; i < ms.length; i++) {
              const t = ms[i].target;
              emit("attr", ms[i].attributeName + "=" +
                ((t.getAttribute && t.getAttribute(ms[i].attributeName)) || ""));
            }
          })
        : null;

      const rebind = () => {
        if (!opts.attrs) return;
        const t = opts.attrs.target();
        if (t && t !== bound) {
          try { mo.disconnect(); } catch (e) { /* first bind */ }
          mo.observe(t, { attributes: true, attributeFilter: opts.attrs.filter });
          bound = t;
          S.rebinds++;
        }
      };

      // --- continuous wiring check -------------------------------------------
      // Validating once is not enough: a sensor can go blind MID-RUN — the node
      // is replaced by a re-render, the page reloads, a precondition lapses. If
      // that happens and you do not notice, the run silently degrades into the
      // very false negative the controls were meant to exclude. So the wiring is
      // re-checked on a cadence and any lapse TAINTS the window; a tainted run
      // cannot be reported. This is what makes a negative result strong enough
      // to eliminate an avenue — and eliminating avenues is the only
      // alternative to trying them all until one happens to work.
      S.taints = [];
      const PAGE_TOKEN = (root.__sensorPageToken = root.__sensorPageToken || Math.random());
      let lastWiringCheck = 0;
      const checkWiring = () => {
        const bad = [];
        if (root.__sensorPageToken !== PAGE_TOKEN) bad.push("page-reloaded");
        if (opts.attrs && !opts.attrs.target()) bad.push("attr-target-missing");
        if (opts.sample) {
          try { if (opts.sample() == null) bad.push("sample-null"); }
          catch (e) { bad.push("sample-throws:" + e.message.slice(0, 40)); }
        }
        (opts.preconditions || []).forEach((p) => {
          let ok; try { ok = !!p[1](); } catch (e) { ok = false; }
          if (!ok) bad.push("precondition:" + p[0]);
        });
        if (bad.length) {
          S.taints.push({ t: Date.now(), why: bad.join(",") });
          if (S.taints.length > 50) S.taints = S.taints.slice(-50);
        }
      };

      let last = null;
      const tick = () => {
        if (!S.alive) return;
        S.frames++;
        rebind();
        const now = Date.now();
        if (now - lastWiringCheck > (opts.wiringCheckMs || 500)) {
          lastWiringCheck = now;
          checkWiring();
        }
        if (opts.sample) {
          let cur;
          try { cur = JSON.stringify(opts.sample()); }
          catch (e) { cur = "SAMPLE_ERROR:" + e.message; }
          if (last !== null && cur !== last) emit("sample", last + " -> " + cur);
          last = cur;
        }
        requestAnimationFrame(tick);
      };
      rebind();
      requestAnimationFrame(tick);

      /** Rules out FALSE NEGATIVES. `cause` must produce a real instance through
       *  the real path — a synthetic shortcut that skips the production code
       *  path validates nothing. */
      S.positiveControl = async function (cause) {
        const before = S.events.length;
        await cause();
        await twoFrames();
        S.pos = S.events.length > before;
        if (!S.pos) {
          console.warn("[sensor-kit] " + name + ": POSITIVE CONTROL FAILED — " +
            "this sensor cannot see its own phenomenon. Fix the instrument; " +
            "its silence means nothing.");
        }
        return S.pos;
      };

      /** Rules out FALSE POSITIVES. Idle, or do something that must NOT trigger. */
      S.negativeControl = async function (nonCause) {
        const before = S.events.length;
        if (nonCause) await nonCause();
        await twoFrames();
        S.neg = S.events.length === before;
        if (!S.neg) {
          console.warn("[sensor-kit] " + name + ": NEGATIVE CONTROL FAILED — " +
            "sensor fires with no stimulus; a signal from it is not evidence.");
        }
        return S.neg;
      };

      /** Pre-register the decision rule. Written BEFORE the run, on purpose. */
      S.expect = function (claim, predicate) {
        S.expectation = { claim, predicate };
        return S;
      };

      S.reset = function () { S.events = []; last = null; return S; };
      S.stop = function () { S.alive = false; try { mo && mo.disconnect(); } catch (e) {} };

      /** The only sanctioned read. Throws rather than handing back a number you
       *  would be wrong to trust. */
      S.report = function () {
        if (!S.frames) throw new Error("[sensor-kit] " + name + ": NOT ALIVE (0 frames)");
        if (S.pos !== true) {
          throw new Error("[sensor-kit] " + name + ": positive control " +
            (S.pos === null ? "NOT RUN" : "FAILED") +
            " — cannot distinguish 'absent' from 'blind'.");
        }
        if (S.neg !== true) {
          throw new Error("[sensor-kit] " + name + ": negative control " +
            (S.neg === null ? "NOT RUN" : "FAILED") +
            " — cannot distinguish 'signal' from 'noise'.");
        }
        if (!S.expectation) {
          throw new Error("[sensor-kit] " + name + ": no expectation registered — " +
            "call expect(claim, predicate) BEFORE the run so the data decides.");
        }
        const failed = (opts.preconditions || [])
          .filter((p) => { try { return !p[1](); } catch (e) { return true; } })
          .map((p) => p[0]);
        if (failed.length) {
          throw new Error("[sensor-kit] " + name + ": PRECONDITION FAILED -> " + failed.join(", "));
        }
        if (S.taints.length) {
          throw new Error("[sensor-kit] " + name + ": WINDOW TAINTED — wiring lapsed " +
            S.taints.length + "x during the run (" +
            S.taints.slice(-3).map((x) => x.why).join(" | ") +
            "). The sensor went blind mid-run; re-arm and repeat. Do NOT interpret this window.");
        }
        if (opts.coverage && opts.coverage.unobserved && opts.coverage.unobserved.length) {
          throw new Error("[sensor-kit] " + name + ": COVERAGE GAP — known writers not observed: " +
            opts.coverage.unobserved.join(", ") +
            ". A null cannot eliminate a path this sensor never watched.");
        }

        const tally = {};
        S.events.forEach((e) => { tally[e.kind] = (tally[e.kind] || 0) + 1; });
        const result = { events: S.events.length, tally, frames: S.frames };
        const held = !!S.expectation.predicate(result);

        return {
          sensor: name,
          trust: "TRUSTED (both controls passed)",
          claim: S.expectation.claim,
          verdict: held ? "CONFIRMED" : "REFUTED",
          meaning: held
            ? "the claim holds — the signal is present and the sensor is proven honest both ways"
            : "the claim does NOT hold — and this is a real negative, not a blind spot",
          frames: S.frames, rebinds: S.rebinds,
          events: S.events.length, tally,
          sample: S.events.slice(0, 12),
        };
      };

      root.__sensors = root.__sensors || {};
      root.__sensors[name] = S;
      return S;
    },

    /** Every sensor in this page, with whether it is currently readable. */
    audit() {
      const out = {};
      Object.keys(root.__sensors || {}).forEach((k) => {
        const s = root.__sensors[k];
        out[k] = {
          frames: s.frames, alive: s.alive,
          positiveControl: s.pos === null ? "NOT RUN" : s.pos,
          negativeControl: s.neg === null ? "NOT RUN" : s.neg,
          expectation: s.expectation ? s.expectation.claim : "NONE",
          readable: !!(s.frames && s.pos === true && s.neg === true && s.expectation),
        };
      });
      return out;
    },
  };

  root.SensorKit = SensorKit;
})(typeof window !== "undefined" ? window : globalThis);
