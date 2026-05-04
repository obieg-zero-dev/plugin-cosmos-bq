import { jsx, jsxs } from "react/jsx-runtime";
const plugin = ({ React, ui, store, sdk, icons }) => {
  const { useMemo, useEffect } = React;
  const { Share2, GitBranch, Edit3 } = icons;
  const useNav = sdk.create(() => ({
    treeId: null,
    selectedNid: null
  }));
  const selectByNid = (treeId, nid) => {
    const node = store.getPosts("node").find((n) => n.parentId === treeId && String(n.data.nodeId) === nid);
    useNav.setState({ selectedNid: nid });
    if (node) sdk.shared.setState({ bq: { treeId, nodeId: nid, postId: node.id } });
  };
  const COLOR_MAP = {
    primary: "#4a90e2",
    secondary: "#9b59b6",
    accent: "#e91e63",
    info: "#00bcd4",
    success: "#22c55e",
    warning: "#f59e0b",
    error: "#ef4444",
    neutral: "#94a3b8"
  };
  const PALETTE = ["#4a90e2", "#e91e63", "#22c55e", "#f59e0b", "#9b59b6", "#00bcd4", "#ef4444", "#94a3b8"];
  function LeftPanel() {
    const trees = store.usePosts("tree");
    const { treeId, selectedNid } = useNav();
    const nodes = store.useChildren(treeId || "", "node");
    const branches = store.useChildren(treeId || "", "branch");
    const sharedTreeId = sdk.shared((s) => {
      var _a;
      return (_a = s == null ? void 0 : s.bq) == null ? void 0 : _a.treeId;
    });
    useEffect(() => {
      var _a;
      if (treeId) return;
      const initial = sharedTreeId && trees.some((t) => t.id === sharedTreeId) ? sharedTreeId : (_a = trees[0]) == null ? void 0 : _a.id;
      if (initial) useNav.setState({ treeId: initial });
    }, [trees.length, sharedTreeId]);
    const groups = useMemo(() => {
      const branchByKey = new Map(branches.map((b) => [String(b.data.key), b]));
      const usedKeys = [];
      const seen = /* @__PURE__ */ new Set();
      for (const b of branches) {
        const k = String(b.data.key);
        if (!seen.has(k) && nodes.some((n) => String(n.data.branch || "") === k)) {
          usedKeys.push(k);
          seen.add(k);
        }
      }
      if (nodes.some((n) => !String(n.data.branch || ""))) usedKeys.push("_none");
      return usedKeys.map((k, i) => {
        const b = branchByKey.get(k);
        const colorKey = b ? String(b.data.color || "") : "";
        const color = COLOR_MAP[colorKey] || PALETTE[i % PALETTE.length];
        const inBranch = nodes.filter(
          (n) => (String(n.data.branch || "") || "_none") === k
        );
        const sorted = [...inBranch].sort((a, c) => {
          const ta = parseInt(String(a.data.tier || "1"), 10) || 1;
          const tc = parseInt(String(c.data.tier || "1"), 10) || 1;
          return ta - tc;
        });
        return {
          key: k,
          label: b ? String(b.data.label) : "Bez gałęzi",
          color,
          nodes: sorted
        };
      });
    }, [nodes, branches]);
    if (trees.length === 0) {
      return /* @__PURE__ */ jsx(
        ui.Box,
        {
          header: /* @__PURE__ */ jsx(ui.Cell, { label: true, children: "Kosmos BQ" }),
          body: /* @__PURE__ */ jsx(ui.Placeholder, { text: "Brak drzew. Wczytaj paczkę w pluginie BrainQuest." })
        }
      );
    }
    return /* @__PURE__ */ jsx(
      ui.Box,
      {
        header: /* @__PURE__ */ jsx(ui.Cell, { label: true, children: "Kosmos BQ" }),
        body: /* @__PURE__ */ jsxs(ui.Stack, { children: [
          /* @__PURE__ */ jsx(ui.Field, { label: "Drzewo", children: /* @__PURE__ */ jsx(
            ui.Select,
            {
              value: treeId || "",
              options: trees.map((t) => ({ value: t.id, label: String(t.data.title) })),
              onChange: (e) => useNav.setState({ treeId: e.target.value, selectedNid: null })
            }
          ) }),
          /* @__PURE__ */ jsxs(ui.Text, { muted: true, size: "xs", children: [
            nodes.length,
            " węzłów · ",
            groups.length,
            " gałęzi"
          ] }),
          groups.map((g) => /* @__PURE__ */ jsxs(React.Fragment, { children: [
            /* @__PURE__ */ jsxs(ui.Cell, { label: true, children: [
              /* @__PURE__ */ jsx("span", { style: { display: "inline-block", width: 8, height: 8, borderRadius: 4, background: g.color, marginRight: 6 } }),
              g.label
            ] }),
            g.nodes.map((n) => {
              const nid = String(n.data.nodeId);
              return /* @__PURE__ */ jsx(
                ui.ListItem,
                {
                  active: selectedNid === nid,
                  label: String(n.data.title),
                  detail: `tier ${n.data.tier ?? "?"}`,
                  onClick: () => selectByNid(treeId, nid)
                },
                n.id
              );
            })
          ] }, g.key))
        ] })
      }
    );
  }
  function GraphView() {
    const { treeId, selectedNid } = useNav();
    const nodes = store.useChildren(treeId || "", "node");
    const edges = store.useChildren(treeId || "", "edge");
    const branches = store.useChildren(treeId || "", "branch");
    const cx = 300, cy = 300;
    const { positions, orbits } = useMemo(() => {
      const rMin = 70, rMax = 270;
      const branchByKey = new Map(branches.map((b) => [String(b.data.key), b]));
      const usedKeys = [];
      const seen = /* @__PURE__ */ new Set();
      for (const b of branches) {
        const k = String(b.data.key);
        if (!seen.has(k) && nodes.some((n) => String(n.data.branch || "") === k)) {
          usedKeys.push(k);
          seen.add(k);
        }
      }
      if (nodes.some((n) => !String(n.data.branch || ""))) usedKeys.push("_none");
      const N = Math.max(usedKeys.length, 1);
      const step = N > 1 ? (rMax - rMin) / (N - 1) : 0;
      const orbits2 = usedKeys.map((k, i) => {
        const b = branchByKey.get(k);
        const colorKey = b ? String(b.data.color || "") : "";
        return {
          key: k,
          label: b ? String(b.data.label) : "bez gałęzi",
          color: COLOR_MAP[colorKey] || PALETTE[i % PALETTE.length],
          radius: N > 1 ? rMin + i * step : (rMin + rMax) / 2
        };
      });
      const positions2 = /* @__PURE__ */ new Map();
      for (const orbit of orbits2) {
        const onOrbit = nodes.filter(
          (n) => (String(n.data.branch || "") || "_none") === orbit.key
        );
        onOrbit.forEach((n, j) => {
          const a = j / Math.max(onOrbit.length, 1) * Math.PI * 2 - Math.PI / 2;
          positions2.set(String(n.data.nodeId), {
            x: cx + Math.cos(a) * orbit.radius,
            y: cy + Math.sin(a) * orbit.radius,
            color: orbit.color
          });
        });
      }
      return { positions: positions2, orbits: orbits2 };
    }, [nodes, branches]);
    if (nodes.length === 0) return /* @__PURE__ */ jsx(ui.Placeholder, { text: "Drzewo nie ma węzłów" });
    return /* @__PURE__ */ jsxs(
      "svg",
      {
        viewBox: "0 0 600 600",
        preserveAspectRatio: "xMidYMid meet",
        style: { display: "block", width: "100%", height: "100%", background: "radial-gradient(ellipse at center, #1a2440 0%, #0a0e1a 100%)", borderRadius: 8 },
        children: [
          orbits.map((o) => /* @__PURE__ */ jsx(
            "circle",
            {
              cx,
              cy,
              r: o.radius,
              fill: "none",
              stroke: o.color,
              strokeOpacity: 0.35,
              strokeDasharray: "3 5"
            },
            "orbit-" + o.key
          )),
          orbits.map((o) => /* @__PURE__ */ jsx(
            "text",
            {
              x: cx,
              y: cy - o.radius - 6,
              textAnchor: "middle",
              fontSize: 10,
              fill: o.color,
              opacity: 0.85,
              children: o.label
            },
            "orbit-l-" + o.key
          )),
          /* @__PURE__ */ jsx("circle", { cx, cy, r: 6, fill: "#fde68a" }),
          /* @__PURE__ */ jsx("circle", { cx, cy, r: 14, fill: "#fde68a", opacity: 0.2 }),
          edges.map((e) => {
            const a = positions.get(String(e.data.fromNid));
            const b = positions.get(String(e.data.toNid));
            if (!a || !b) return null;
            return /* @__PURE__ */ jsxs("g", { children: [
              /* @__PURE__ */ jsx(
                "line",
                {
                  x1: a.x,
                  y1: a.y,
                  x2: b.x,
                  y2: b.y,
                  stroke: "#fff",
                  strokeOpacity: 0.25,
                  strokeWidth: 1
                }
              ),
              e.data.type && /* @__PURE__ */ jsx(
                "text",
                {
                  x: (a.x + b.x) / 2,
                  y: (a.y + b.y) / 2 - 4,
                  fontSize: 9,
                  fill: "#cbd5e1",
                  textAnchor: "middle",
                  opacity: 0.7,
                  children: String(e.data.type)
                }
              )
            ] }, e.id);
          }),
          nodes.map((n) => {
            const nid = String(n.data.nodeId);
            const p = positions.get(nid);
            if (!p) return null;
            const isSel = selectedNid === nid;
            return /* @__PURE__ */ jsxs("g", { style: { cursor: "pointer" }, onClick: () => selectByNid(treeId, nid), children: [
              isSel && /* @__PURE__ */ jsx("circle", { cx: p.x, cy: p.y, r: 22, fill: p.color, opacity: 0.3 }),
              /* @__PURE__ */ jsx(
                "circle",
                {
                  cx: p.x,
                  cy: p.y,
                  r: isSel ? 14 : 10,
                  fill: p.color,
                  stroke: isSel ? "#fff" : "none",
                  strokeWidth: 2
                }
              ),
              /* @__PURE__ */ jsx(
                "text",
                {
                  x: p.x,
                  y: p.y + 26,
                  textAnchor: "middle",
                  fontSize: 10,
                  fill: "#fff",
                  opacity: isSel ? 1 : 0.85,
                  children: String(n.data.title)
                }
              )
            ] }, n.id);
          })
        ]
      }
    );
  }
  function CenterPanel() {
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsx(GraphView, {}) });
  }
  function RightPanel() {
    const { treeId, selectedNid } = useNav();
    const nodes = store.useChildren(treeId || "", "node");
    const edges = store.useChildren(treeId || "", "edge");
    const node = nodes.find((n) => String(n.data.nodeId) === selectedNid);
    if (!node) return /* @__PURE__ */ jsx(ui.Placeholder, { text: "Wybierz węzeł" });
    const titleOf = (nid) => {
      var _a;
      return String(((_a = nodes.find((n) => String(n.data.nodeId) === nid)) == null ? void 0 : _a.data.title) ?? nid);
    };
    const out = edges.filter((e) => e.data.fromNid === selectedNid);
    const inc = edges.filter((e) => e.data.toNid === selectedNid);
    const editInStudio = () => {
      sdk.useHostStore.setState({ activeId: "brainquest-studio" });
    };
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsx(ui.Heading, { title: String(node.data.title), subtitle: `#${selectedNid}` }),
      /* @__PURE__ */ jsxs(ui.Row, { children: [
        node.data.branch ? /* @__PURE__ */ jsx(ui.Badge, { children: String(node.data.branch) }) : null,
        node.data.tier ? /* @__PURE__ */ jsxs(ui.Text, { size: "xs", muted: true, children: [
          "Poziom ",
          String(node.data.tier)
        ] }) : null
      ] }),
      /* @__PURE__ */ jsx(ui.Row, { children: /* @__PURE__ */ jsxs(ui.Button, { size: "xs", color: "primary", onClick: editInStudio, children: [
        /* @__PURE__ */ jsx(Edit3, { size: 12 }),
        " Edytuj w Studio"
      ] }) }),
      /* @__PURE__ */ jsx(ui.Divider, {}),
      /* @__PURE__ */ jsxs(ui.Cell, { label: true, children: [
        "Wychodzące (",
        out.length,
        ")"
      ] }),
      out.length === 0 && /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "xs", children: "brak" }),
      out.map((e) => /* @__PURE__ */ jsx(
        ui.ListItem,
        {
          label: titleOf(String(e.data.toNid)),
          detail: e.data.type ? String(e.data.type) : void 0,
          onClick: () => selectByNid(treeId, String(e.data.toNid))
        },
        e.id
      )),
      /* @__PURE__ */ jsx(ui.Divider, {}),
      /* @__PURE__ */ jsxs(ui.Cell, { label: true, children: [
        "Przychodzące (",
        inc.length,
        ")"
      ] }),
      inc.length === 0 && /* @__PURE__ */ jsx(ui.Text, { muted: true, size: "xs", children: "brak" }),
      inc.map((e) => /* @__PURE__ */ jsx(
        ui.ListItem,
        {
          label: titleOf(String(e.data.fromNid)),
          detail: e.data.type ? String(e.data.type) : void 0,
          onClick: () => selectByNid(treeId, String(e.data.fromNid))
        },
        e.id
      ))
    ] }) });
  }
  sdk.registerView("cosmos.left", { slot: "left", component: LeftPanel });
  sdk.registerView("cosmos.center", { slot: "center", component: CenterPanel });
  sdk.registerView("cosmos.right", { slot: "right", component: RightPanel });
  return {
    id: "cosmos-bq",
    label: "Kosmos BQ",
    description: "Kosmiczny widok grafu BQ — każda gałąź na własnej orbicie",
    icon: Share2 || GitBranch,
    version: "0.4.0"
  };
};
export {
  plugin as default
};
