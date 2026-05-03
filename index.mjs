import { jsx, jsxs } from "react/jsx-runtime";
const plugin = ({ React, ui, store, sdk, icons }) => {
  const { useMemo, useEffect } = React;
  const { Plus, Link2, Share2, GitBranch } = icons;
  const useNav = sdk.create(() => ({
    treeId: null,
    selectedNid: null,
    // node.data.nodeId (string)
    mode: "browse"
  }));
  const goBrowse = () => useNav.setState({ mode: "browse" });
  const selectByNid = (treeId, nid) => {
    const node = store.getPosts("node").find((n) => n.parentId === treeId && String(n.data.nodeId) === nid);
    useNav.setState({ selectedNid: nid, mode: "browse" });
    if (node) sdk.shared.setState({ bq: { treeId, nodeId: nid, postId: node.id } });
  };
  function LeftPanel() {
    const trees = store.usePosts("tree");
    const { treeId, selectedNid, mode } = useNav();
    const nodes = store.useChildren(treeId || "", "node");
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
              onChange: (e) => useNav.setState({ treeId: e.target.value, selectedNid: null, mode: "browse" })
            }
          ) }),
          /* @__PURE__ */ jsxs(ui.Row, { children: [
            /* @__PURE__ */ jsxs(
              ui.Button,
              {
                size: "xs",
                color: "primary",
                disabled: !treeId,
                onClick: () => useNav.setState({ mode: "add-node", selectedNid: null }),
                children: [
                  /* @__PURE__ */ jsx(Plus, { size: 12 }),
                  " Węzeł"
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              ui.Button,
              {
                size: "xs",
                color: "ghost",
                disabled: nodes.length < 2,
                onClick: () => useNav.setState({ mode: "add-edge" }),
                children: [
                  /* @__PURE__ */ jsx(Link2, { size: 12 }),
                  " Krawędź"
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs(ui.Text, { muted: true, size: "xs", children: [
            nodes.length,
            " węzłów"
          ] }),
          nodes.map((n) => {
            const nid = String(n.data.nodeId);
            return /* @__PURE__ */ jsx(
              ui.ListItem,
              {
                active: selectedNid === nid && mode === "browse",
                label: String(n.data.title),
                detail: `#${nid}${n.data.branch ? " · " + n.data.branch : ""}`,
                onClick: () => selectByNid(treeId, nid)
              },
              n.id
            );
          })
        ] })
      }
    );
  }
  function NodeForm({ node }) {
    const { treeId } = useNav();
    const editing = !!node;
    const branches = store.useChildren(treeId || "", "branch");
    const branchOpts = [
      { value: "", label: "— bez gałęzi —" },
      ...branches.map((b) => ({ value: String(b.data.key), label: String(b.data.label) }))
    ];
    const { bind, submit } = sdk.useForm(
      {
        nodeId: editing ? String(node.data.nodeId) : "",
        title: editing ? String(node.data.title) : "",
        branch: editing ? String(node.data.branch || "") : "",
        tier: editing ? String(node.data.tier || "") : ""
      },
      {
        isComplete: (d) => !!String(d.nodeId || "").trim() && !!String(d.title || "").trim(),
        onSubmit: (d) => {
          const data = {
            nodeId: String(d.nodeId).trim(),
            title: String(d.title).trim(),
            branch: String(d.branch || "").trim(),
            tier: String(d.tier || "").trim()
          };
          if (editing) store.update(node.id, data);
          else if (treeId) {
            const created = store.add("node", data, { parentId: treeId });
            useNav.setState({ selectedNid: data.nodeId });
            sdk.shared.setState({ bq: { treeId, nodeId: data.nodeId, postId: created.id } });
          }
          sdk.log(editing ? "Węzeł zaktualizowany" : "Węzeł dodany", "ok");
          goBrowse();
        }
      }
    );
    const remove = () => {
      if (!node) return;
      store.remove(node.id);
      useNav.setState({ selectedNid: null, mode: "browse" });
      sdk.log("Węzeł usunięty", "ok");
    };
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsx(ui.Heading, { title: editing ? "Edytuj węzeł" : "Nowy węzeł", subtitle: "Pola BQ" }),
      /* @__PURE__ */ jsx(ui.Card, { children: /* @__PURE__ */ jsxs(ui.Stack, { gap: "md", children: [
        /* @__PURE__ */ jsx(ui.Field, { label: "ID węzła (klucz w grafie)", required: true, children: /* @__PURE__ */ jsx(ui.Input, { placeholder: "np. demokracja_ateny", ...bind("nodeId") }) }),
        /* @__PURE__ */ jsx(ui.Field, { label: "Tytuł", required: true, children: /* @__PURE__ */ jsx(ui.Input, { ...bind("title") }) }),
        /* @__PURE__ */ jsx(ui.Field, { label: "Gałąź", children: /* @__PURE__ */ jsx(ui.Select, { options: branchOpts, ...bind("branch") }) }),
        /* @__PURE__ */ jsx(ui.Field, { label: "Poziom (1–3)", children: /* @__PURE__ */ jsx(ui.Input, { ...bind("tier") }) })
      ] }) }),
      /* @__PURE__ */ jsxs(ui.Row, { justify: "between", children: [
        editing ? /* @__PURE__ */ jsx(ui.Button, { color: "error", outline: true, onClick: remove, children: "Usuń" }) : /* @__PURE__ */ jsx("span", {}),
        /* @__PURE__ */ jsxs(ui.Row, { children: [
          /* @__PURE__ */ jsx(ui.Button, { color: "ghost", outline: true, onClick: goBrowse, children: "Anuluj" }),
          /* @__PURE__ */ jsx(ui.Button, { color: "primary", onClick: submit, children: "Zapisz" })
        ] })
      ] })
    ] }) });
  }
  function EdgeForm() {
    const { treeId } = useNav();
    const nodes = store.useChildren(treeId || "", "node");
    const relTypes = store.useChildren(treeId || "", "relType");
    const nodeOpts = [
      { value: "", label: "— wybierz —" },
      ...nodes.map((n) => ({ value: String(n.data.nodeId), label: String(n.data.title) }))
    ];
    const typeOpts = [
      { value: "", label: "— bez typu —" },
      ...relTypes.map((r) => ({ value: String(r.data.key), label: String(r.data.label) }))
    ];
    const { bind, submit } = sdk.useForm(
      { fromNid: "", toNid: "", type: "" },
      {
        isComplete: (d) => !!d.fromNid && !!d.toNid && d.fromNid !== d.toNid,
        onSubmit: (d) => {
          if (treeId) store.add("edge", { fromNid: d.fromNid, toNid: d.toNid, type: String(d.type || "") }, { parentId: treeId });
          sdk.log("Krawędź dodana", "ok");
          goBrowse();
        }
      }
    );
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsx(ui.Heading, { title: "Nowa krawędź", subtitle: "Skierowana: Z → Do" }),
      /* @__PURE__ */ jsx(ui.Card, { children: /* @__PURE__ */ jsxs(ui.Stack, { gap: "md", children: [
        /* @__PURE__ */ jsx(ui.Field, { label: "Z", required: true, children: /* @__PURE__ */ jsx(ui.Select, { options: nodeOpts, ...bind("fromNid") }) }),
        /* @__PURE__ */ jsx(ui.Field, { label: "Do", required: true, children: /* @__PURE__ */ jsx(ui.Select, { options: nodeOpts, ...bind("toNid") }) }),
        /* @__PURE__ */ jsx(ui.Field, { label: "Typ relacji", children: /* @__PURE__ */ jsx(ui.Select, { options: typeOpts, ...bind("type") }) })
      ] }) }),
      /* @__PURE__ */ jsxs(ui.Row, { justify: "end", children: [
        /* @__PURE__ */ jsx(ui.Button, { color: "ghost", outline: true, onClick: goBrowse, children: "Anuluj" }),
        /* @__PURE__ */ jsx(ui.Button, { color: "primary", onClick: submit, children: "Dodaj" })
      ] })
    ] }) });
  }
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
        style: { width: "100%", height: 600, background: "radial-gradient(ellipse at center, #1a2440 0%, #0a0e1a 100%)", borderRadius: 8 },
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
    const { treeId, mode, selectedNid } = useNav();
    const nodes = store.useChildren(treeId || "", "node");
    if (mode === "add-node") return /* @__PURE__ */ jsx(NodeForm, {});
    if (mode === "edit-node" && selectedNid) {
      const node = nodes.find((n) => String(n.data.nodeId) === selectedNid);
      if (node) return /* @__PURE__ */ jsx(NodeForm, { node });
    }
    if (mode === "add-edge") return /* @__PURE__ */ jsx(EdgeForm, {});
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsx(GraphView, {}) });
  }
  function RightPanel() {
    const { treeId, selectedNid, mode } = useNav();
    const nodes = store.useChildren(treeId || "", "node");
    const edges = store.useChildren(treeId || "", "edge");
    const node = nodes.find((n) => String(n.data.nodeId) === selectedNid);
    if (!node || mode !== "browse") return /* @__PURE__ */ jsx(ui.Placeholder, { text: "Wybierz węzeł" });
    const titleOf = (nid) => {
      var _a;
      return String(((_a = nodes.find((n) => String(n.data.nodeId) === nid)) == null ? void 0 : _a.data.title) ?? nid);
    };
    const out = edges.filter((e) => e.data.fromNid === selectedNid);
    const inc = edges.filter((e) => e.data.toNid === selectedNid);
    return /* @__PURE__ */ jsx(ui.Page, { children: /* @__PURE__ */ jsxs(ui.Stack, { children: [
      /* @__PURE__ */ jsx(ui.Heading, { title: String(node.data.title), subtitle: `#${selectedNid}` }),
      /* @__PURE__ */ jsxs(ui.Row, { children: [
        node.data.branch ? /* @__PURE__ */ jsx(ui.Badge, { children: String(node.data.branch) }) : null,
        node.data.tier ? /* @__PURE__ */ jsxs(ui.Text, { size: "xs", muted: true, children: [
          "Poziom ",
          String(node.data.tier)
        ] }) : null
      ] }),
      /* @__PURE__ */ jsx(ui.Row, { children: /* @__PURE__ */ jsx(
        ui.Button,
        {
          size: "xs",
          color: "primary",
          onClick: () => useNav.setState({ mode: "edit-node" }),
          children: "Edytuj"
        }
      ) }),
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
          action: /* @__PURE__ */ jsx(ui.RemoveButton, { onClick: () => store.remove(e.id) }),
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
          action: /* @__PURE__ */ jsx(ui.RemoveButton, { onClick: () => store.remove(e.id) }),
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
    version: "0.3.0"
  };
};
export {
  plugin as default
};
