import type { PluginFactory, PostRecord } from '@obieg-zero/sdk'
import { forceSimulation, forceLink, forceCollide, forceRadial, forceManyBody } from 'd3-force'

const plugin: PluginFactory = ({ React, ui, store, sdk, icons }) => {
  const { useMemo, useEffect, useState, useRef } = React
  const { Share2, GitBranch, Maximize2 } = icons

  // Używamy typów BQ: 'tree' (root), 'node' (parent: tree), 'edge' (parent: tree).

  const useNav = sdk.create(() => ({
    treeId: null as string | null,
    selectedNid: null as string | null,
    selectedLexId: null as string | null,
  }))

  const selectByNid = (treeId: string, nid: string) => {
    const node = (store.getPosts('node') as PostRecord[])
      .find(n => n.parentId === treeId && String(n.data.nodeId) === nid)
    useNav.setState({ selectedNid: nid, selectedLexId: null })
    if (node) sdk.shared.setState({ bq: { treeId, nodeId: nid, postId: node.id } })
  }

  const selectByLex = (lexId: string) => {
    useNav.setState({ selectedLexId: lexId, selectedNid: null })
  }

  // Kolory kategorii leksykonu (księżyce)
  const CAT_COLORS: Record<string, string> = {
    motyw: '#f59e0b',
    topos: '#ef4444',
    gatunek: '#4a90e2',
    srodek: '#9b59b6',
    srodek_stylistyczny: '#9b59b6',
    postac: '#22c55e',
    pojecie: '#fde68a',
    'pojęcie': '#fde68a',
  }
  const catColor = (c: string) => CAT_COLORS[c] || '#94a3b8'

  // Paleta orbit / nagłówków gałęzi
  const COLOR_MAP: Record<string, string> = {
    primary:  '#4a90e2', secondary: '#9b59b6', accent: '#e91e63',
    info:     '#00bcd4', success:   '#22c55e', warning: '#f59e0b',
    error:    '#ef4444', neutral:   '#94a3b8',
  }
  const PALETTE = ['#4a90e2', '#e91e63', '#22c55e', '#f59e0b', '#9b59b6', '#00bcd4', '#ef4444', '#94a3b8']

  type BranchInfo = { key: string; label: string; color: string; def?: PostRecord }
  const usedBranchInfos = (nodes: PostRecord[], branches: PostRecord[]): BranchInfo[] => {
    const byKey = new Map(branches.map(b => [String(b.data.key), b]))
    const used: string[] = []
    const seen = new Set<string>()
    for (const b of branches) {
      const k = String(b.data.key)
      if (!seen.has(k) && nodes.some(n => String(n.data.branch || '') === k)) {
        used.push(k); seen.add(k)
      }
    }
    if (nodes.some(n => !String(n.data.branch || ''))) used.push('_none')
    return used.map((k, i) => {
      const def = byKey.get(k)
      const colorKey = def ? String(def.data.color || '') : ''
      return {
        key: k,
        label: def ? String(def.data.label) : 'bez gałęzi',
        color: COLOR_MAP[colorKey] || PALETTE[i % PALETTE.length],
        def,
      }
    })
  }
  const branchOf = (n: PostRecord) => String(n.data.branch || '') || '_none'

  // ── Lewy panel: drzewko węzłów z wcięciami po gałęzi/tier ─────────
  function LeftPanel() {
    const trees = store.usePosts('tree') as PostRecord[]
    const { treeId, selectedNid } = useNav()
    const nodes    = store.useChildren(treeId || '', 'node') as PostRecord[]
    const branches = store.useChildren(treeId || '', 'branch') as PostRecord[]
    const sharedTreeId = sdk.shared(s => (s as any)?.bq?.treeId) as string | undefined

    useEffect(() => {
      if (treeId) return
      const initial = (sharedTreeId && trees.some(t => t.id === sharedTreeId))
        ? sharedTreeId
        : trees[0]?.id
      if (initial) useNav.setState({ treeId: initial })
    }, [trees.length, sharedTreeId])

    const groups = useMemo(() => {
      return usedBranchInfos(nodes, branches).map(info => {
        const inBranch = nodes.filter(n => branchOf(n) === info.key)
        const sorted = [...inBranch].sort((a, c) => {
          const ta = parseInt(String(a.data.tier || '1'), 10) || 1
          const tc = parseInt(String(c.data.tier || '1'), 10) || 1
          return ta - tc
        })
        return { ...info, nodes: sorted }
      })
    }, [nodes, branches])

    if (trees.length === 0) {
      return (
        <ui.Box
          header={<ui.Cell label>Kosmos BQ</ui.Cell>}
          body={<ui.Placeholder text="Brak drzew. Wczytaj paczkę w pluginie BrainQuest." />}
        />
      )
    }

    return (
      <ui.Box
        header={<ui.Cell label>Kosmos BQ</ui.Cell>}
        body={
          <ui.Stack>
            <ui.Field label="Drzewo">
              <ui.Select
                value={treeId || ''}
                options={trees.map(t => ({ value: t.id, label: String(t.data.title) }))}
                onChange={(e: { target: { value: string } }) =>
                  useNav.setState({ treeId: e.target.value, selectedNid: null })}
              />
            </ui.Field>

            <ui.Text muted size="xs">{nodes.length} węzłów · {groups.length} gałęzi</ui.Text>

            {groups.map(g => (
              <React.Fragment key={g.key}>
                <ui.Cell label>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: g.color, marginRight: 6 }} />
                  {g.label}
                </ui.Cell>
                {g.nodes.map(n => {
                  const nid = String(n.data.nodeId)
                  return (
                    <ui.ListItem key={n.id}
                      active={selectedNid === nid}
                      label={String(n.data.title)}
                      detail={`tier ${n.data.tier ?? '?'}`}
                      onClick={() => selectByNid(treeId!, nid)}
                    />
                  )
                })}
              </React.Fragment>
            ))}
          </ui.Stack>
        }
      />
    )
  }

  // ── Widok GRAFU: kosmiczny model — każda gałąź = własna orbita ────
  function GraphView() {
    const { treeId, selectedNid, selectedLexId } = useNav()
    const nodes    = store.useChildren(treeId || '', 'node') as PostRecord[]
    const edges    = store.useChildren(treeId || '', 'edge') as PostRecord[]
    const branches = store.useChildren(treeId || '', 'branch') as PostRecord[]
    const relTypes = store.useChildren(treeId || '', 'relType') as PostRecord[]
    const lexicons = store.useChildren(treeId || '', 'lexicon') as PostRecord[]
    const allLexNodes = store.usePosts('lexNode') as PostRecord[]

    const { lexsByNid, nidsByLex } = useMemo(() => {
      const lexById = new Map(lexicons.map(l => [l.id, l]))
      const lexsByNid = new Map<string, PostRecord[]>()
      const nidsByLex = new Map<string, Set<string>>()
      for (const ln of allLexNodes) {
        const lex = lexById.get(ln.parentId); if (!lex) continue
        const nid = String(ln.data.nid)
        if (!lexsByNid.has(nid)) lexsByNid.set(nid, [])
        lexsByNid.get(nid)!.push(lex)
        if (!nidsByLex.has(lex.id)) nidsByLex.set(lex.id, new Set())
        nidsByLex.get(lex.id)!.add(nid)
      }
      return { lexsByNid, nidsByLex }
    }, [lexicons, allLexNodes])

    // Krawędzie kontekstowe — agregacja par lex (relation + count) → semantyczne powiązania węzłów
    const contextEdges = useMemo(() => {
      const map = new Map<string, { from: string; to: string; rels: Map<string, number> }>()
      for (const lex of lexicons) {
        const nidsArr = Array.from(nidsByLex.get(lex.id) || [])
        if (nidsArr.length < 2) continue
        const rel = String(lex.data.relation || 'inne')
        for (let i = 0; i < nidsArr.length; i++)
          for (let j = i + 1; j < nidsArr.length; j++) {
            const [a, b] = [nidsArr[i], nidsArr[j]].sort()
            const key = `${a}:${b}`
            if (!map.has(key)) map.set(key, { from: a, to: b, rels: new Map() })
            const e = map.get(key)!
            e.rels.set(rel, (e.rels.get(rel) || 0) + 1)
          }
      }
      const relMap = new Map(relTypes.map(r => [String(r.data.key), r]))
      const out: { from: string; to: string; relation: string; relLabel: string; relColor: string; count: number; strength: number }[] = []
      for (const { from, to, rels } of map.values()) {
        let best = 'inne', bestCount = 0, total = 0
        for (const [r, c] of rels) { total += c; if (c > bestCount) { best = r; bestCount = c } }
        const def = relMap.get(best)
        out.push({
          from, to, relation: best,
          relLabel: def ? String(def.data.label) : best,
          relColor: COLOR_MAP[String(def?.data.color || '')] || '#94a3b8',
          count: total,
          strength: Math.min(0.4 + total * 0.15, 0.9),
        })
      }
      return out
    }, [lexicons, relTypes, nidsByLex])

    const highlightedNids = selectedLexId ? (nidsByLex.get(selectedLexId) || new Set<string>()) : new Set<string>()

    // Powiązane terminy: inne lex współwystępujące w tych samych węzłach
    const relatedLexIds = useMemo(() => {
      if (!selectedLexId) return new Set<string>()
      const myNids = nidsByLex.get(selectedLexId) || new Set<string>()
      const ids = new Set<string>()
      for (const nid of myNids) {
        const here = lexsByNid.get(nid) || []
        for (const l of here) if (l.id !== selectedLexId) ids.add(l.id)
      }
      return ids
    }, [selectedLexId, nidsByLex, lexsByNid])

    const cx = 300, cy = 300

    const { positions, orbits } = useMemo(() => {
      const rMin = 110
      const minArc = 38
      const baseStep = 95

      const countPerKey = new Map<string, number>()
      for (const n of nodes) {
        const k = branchOf(n)
        countPerKey.set(k, (countPerKey.get(k) || 0) + 1)
      }
      let prevR = rMin
      const orbits = usedBranchInfos(nodes, branches).map((info, i) => {
        const cnt = countPerKey.get(info.key) || 1
        const required = (cnt * minArc) / (2 * Math.PI)
        const r = Math.max(prevR + (i === 0 ? 0 : baseStep), required)
        prevR = r
        return { ...info, radius: r }
      })

      type SimNode = { id: string; x: number; y: number; r: number; color: string; branch: string }
      const simNodes: SimNode[] = []
      for (const orbit of orbits) {
        const onOrbit = nodes.filter(n => branchOf(n) === orbit.key)
        onOrbit.forEach((n, j) => {
          const a = (j / Math.max(onOrbit.length, 1)) * Math.PI * 2 - Math.PI / 2
          simNodes.push({
            id: String(n.data.nodeId),
            x: cx + Math.cos(a) * orbit.radius,
            y: cy + Math.sin(a) * orbit.radius,
            r: orbit.radius,
            color: orbit.color,
            branch: orbit.key,
          })
        })
      }

      const nidSet = new Set(simNodes.map(n => n.id))
      const simLinks = edges
        .map(e => ({ source: String(e.data.fromNid), target: String(e.data.toNid) }))
        .filter(l => nidSet.has(l.source) && nidSet.has(l.target))

      const sim = forceSimulation(simNodes as any)
        .force('radial', forceRadial((d: any) => d.r, cx, cy).strength(0.9))
        .force('collide', forceCollide(26))
        .force('link', forceLink(simLinks as any).id((d: any) => d.id).distance(80).strength(0.18))
        .force('charge', forceManyBody().strength(-22))
        .stop()
      for (let i = 0; i < 150; i++) sim.tick()

      const positions = new Map<string, { x: number; y: number; color: string }>()
      for (const sn of simNodes) {
        positions.set(sn.id, { x: sn.x, y: sn.y, color: sn.color })
      }

      return { positions, orbits }
    }, [nodes, branches, edges])

    if (nodes.length === 0) return <ui.Placeholder text="Drzewo nie ma węzłów" />

    return <CosmosSvg
      cx={cx} cy={cy}
      orbits={orbits} positions={positions}
      nodes={nodes} edges={edges}
      contextEdges={contextEdges}
      lexsByNid={lexsByNid}
      selectedNid={selectedNid} selectedLexId={selectedLexId}
      relatedLexIds={relatedLexIds}
      highlightedNids={highlightedNids}
      treeId={treeId!}
    />
  }

  // ── SVG: pan/zoom + ukrywanie etykiet + focus mode ────────────────
  function CosmosSvg(props: {
    cx: number; cy: number
    orbits: Array<{ key: string; label: string; color: string; radius: number }>
    positions: Map<string, { x: number; y: number; color: string }>
    nodes: PostRecord[]
    edges: PostRecord[]
    contextEdges: { from: string; to: string; relation: string; relLabel: string; relColor: string; count: number; strength: number }[]
    lexsByNid: Map<string, PostRecord[]>
    selectedNid: string | null
    selectedLexId: string | null
    relatedLexIds: Set<string>
    highlightedNids: Set<string>
    treeId: string
  }) {
    const { cx, cy, orbits, positions, nodes, edges, contextEdges, lexsByNid,
            selectedNid, selectedLexId, relatedLexIds, highlightedNids, treeId } = props

    const svgRef = useRef<SVGSVGElement>(null)
    const gRef = useRef<SVGGElement>(null)
    const viewRef = useRef({ zoom: 1, x: 0, y: 0 })
    const dragRef = useRef<{ sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null)
    const wasMovedRef = useRef(false)
    const [zoomPct, setZoomPct] = useState(100)
    const [dragging, setDragging] = useState(false)
    const [hovered, setHovered] = useState<string | null>(null)


    const applyView = () => {
      const v = viewRef.current
      gRef.current?.setAttribute('transform', `translate(${v.x} ${v.y}) scale(${v.zoom})`)
    }

    const reset = () => {
      viewRef.current = { zoom: 1, x: 0, y: 0 }
      applyView()
      setZoomPct(100)
    }

    const screenToVb = (clientX: number, clientY: number) => {
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return { x: 300, y: 300 }
      const size = Math.min(rect.width, rect.height)
      const offX = (rect.width - size) / 2
      const offY = (rect.height - size) / 2
      return {
        x: ((clientX - rect.left - offX) / size) * 600,
        y: ((clientY - rect.top - offY) / size) * 600,
      }
    }

    const onWheel = (e: React.WheelEvent) => {
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      const { x: px, y: py } = screenToVb(e.clientX, e.clientY)
      const v = viewRef.current
      const z = Math.max(0.5, Math.min(5, v.zoom * factor))
      const k = z / v.zoom
      viewRef.current = { zoom: z, x: px - k * (px - v.x), y: py - k * (py - v.y) }
      applyView()
      setZoomPct(Math.round(z * 100))
    }

    const onMouseDown = (e: React.MouseEvent) => {
      if (e.button !== 0) return
      const v = viewRef.current
      dragRef.current = { sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y, moved: false }
      setDragging(true)
      if (hovered) setHovered(null)
    }
    const onMouseMove = (e: React.MouseEvent) => {
      const d = dragRef.current
      if (!d) return
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return
      const size = Math.min(rect.width, rect.height)
      const dx = ((e.clientX - d.sx) / size) * 600
      const dy = ((e.clientY - d.sy) / size) * 600
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4) d.moved = true
      viewRef.current.x = d.vx + dx
      viewRef.current.y = d.vy + dy
      applyView()
    }

    const finishDrag = () => {
      wasMovedRef.current = dragRef.current?.moved || false
      dragRef.current = null
      setDragging(false)
    }
    const tryClick = (cb: () => void) => {
      if (wasMovedRef.current) { wasMovedRef.current = false; return }
      cb()
    }
    const setHoverIfIdle = (nid: string | null) => {
      if (dragRef.current) return
      setHovered(prev => (prev === nid ? prev : nid))
    }

    // Tap-na-tło = deselect (mobile-friendly). Tylko jeśli nie był drag.
    const onBackgroundClick = () => {
      if (wasMovedRef.current) { wasMovedRef.current = false; return }
      useNav.setState({ selectedNid: null, selectedLexId: null })
    }

    // Focus mode: WYŁĄCZNIE selectedNid (klik/tap, działa na mobile). Hover NIE używany do focus.
    const focusNid: string | null = selectedNid
    const neighborSet = useMemo(() => {
      if (!focusNid) return null
      const set = new Set<string>([focusNid])
      for (const e of edges) {
        const f = String(e.data.fromNid), t = String(e.data.toNid)
        if (f === focusNid) set.add(t)
        if (t === focusNid) set.add(f)
      }
      for (const ce of contextEdges) {
        if (ce.from === focusNid) set.add(ce.to)
        if (ce.to === focusNid) set.add(ce.from)
      }
      return set
    }, [focusNid, edges, contextEdges])

    const isNodeDimmed = (nid: string) => !!neighborSet && !neighborSet.has(nid)
    const isEdgeFocused = (a: string, b: string) =>
      !!neighborSet && (a === focusNid || b === focusNid)
    const isEdgeRelevant = (a: string, b: string) =>
      !!neighborSet && neighborSet.has(a) && neighborSet.has(b)

    const showAllLabels = zoomPct >= 150
    const labelOpacity = (sel: boolean, hov: boolean) =>
      sel ? 1 : hov ? 0.95 : showAllLabels ? 0.8 : 0

    // Spójny renderer labels — każdy tekst SVG przez to. Outline ciemny zawsze (czytelność na każdym tle).
    const Label = (p: {
      x: number; y: number; text: string; color: string;
      size?: number; opacity?: number; weight?: number; uppercase?: boolean;
    }) => (
      <text x={p.x} y={p.y} textAnchor="middle"
        fontSize={p.size ?? 10}
        fill={p.color}
        opacity={p.opacity ?? 1}
        style={{
          pointerEvents: 'none',
          paintOrder: 'stroke',
          letterSpacing: p.uppercase ? 0.6 : 0.2,
          fontWeight: p.weight ?? 500,
          textTransform: p.uppercase ? 'uppercase' : 'none',
        }}
        stroke="#0a0e1a" strokeWidth={2.5} strokeOpacity={0.85}>
        {p.text}
      </text>
    )

    const orbitsLayer = useMemo(() => {
      return (
      <>
        {orbits.map(o => (
          <circle key={'o-' + o.key} cx={cx} cy={cy} r={o.radius}
            fill="none" stroke={o.color} strokeOpacity={0.35} strokeDasharray="3 5" />
        ))}
        {orbits.map(o => (
          <Label key={'ol-' + o.key}
            x={cx} y={cy - o.radius - 6}
            text={o.label} color={o.color}
            size={9} opacity={0.85} weight={600} uppercase />
        ))}
      </>
      )
    }, [orbits, cx, cy])

    // Krawędzie strukturalne — focus mode (idle blade, hover wyróżnia)
    const edgesLayer = useMemo(() => {
      return (
      <>
        {edges.map(e => {
          const fromNid = String(e.data.fromNid), toNid = String(e.data.toNid)
          const a = positions.get(fromNid)
          const b = positions.get(toNid)
          if (!a || !b) return null
          const op = !neighborSet ? 0.18
            : isEdgeFocused(fromNid, toNid) ? 0.7
            : isEdgeRelevant(fromNid, toNid) ? 0.3
            : 0.02
          const showLabel = e.data.type && (!neighborSet || isEdgeFocused(fromNid, toNid))
          return (
            <g key={e.id}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="#fff" strokeOpacity={op} strokeWidth={op > 0.3 ? 1.5 : 1} />
              {showLabel && (
                <Label x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4}
                  text={String(e.data.type)} color="#cbd5e1"
                  size={9} opacity={0.9} weight={500} />
              )}
            </g>
          )
        })}
      </>
      )
    }, [edges, positions, neighborSet, focusNid])

    // Krawędzie kontekstowe (lex co-occurrence) — kolor relacji, count<2 ukryte idle
    const contextLayer = useMemo(() => {
      return (
      <>
        {contextEdges.map((ce, i) => {
          const a = positions.get(ce.from); const b = positions.get(ce.to)
          if (!a || !b) return null
          const w = 1 + Math.min(ce.count - 1, 2) * 0.4
          // Idle: count<2 ukryte, count>=2 blade
          const idleOp = ce.count < 2 ? 0 : Math.min(0.12 + ce.strength * 0.15, 0.3)
          const op = !neighborSet ? idleOp
            : isEdgeFocused(ce.from, ce.to) ? Math.min(0.5 + ce.strength * 0.4, 0.9)
            : isEdgeRelevant(ce.from, ce.to) ? 0.25
            : 0.02
          const showLabel = neighborSet && isEdgeFocused(ce.from, ce.to)
          return (
            <g key={`ctx-${i}`}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={ce.relColor} strokeOpacity={op}
                strokeWidth={w} strokeLinecap="round" />
              {showLabel && (
                <Label x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4}
                  text={`${ce.relLabel}${ce.count > 1 ? ` ·${ce.count}` : ''}`}
                  color={ce.relColor} size={8} opacity={0.95} weight={600} />
              )}
            </g>
          )
        })}
      </>
      )
    }, [contextEdges, positions, neighborSet, focusNid])

    const highlightLines = useMemo(() => {
      if (!selectedLexId) return null
      const nids = Array.from(highlightedNids)
      const lines: any[] = []
      for (let i = 0; i < nids.length; i++) {
        for (let j = i + 1; j < nids.length; j++) {
          const a = positions.get(nids[i]); const b = positions.get(nids[j])
          if (!a || !b) continue
          lines.push(
            <line key={`hl-${i}-${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="#fde68a" strokeOpacity={0.55} strokeWidth={1.5} />
          )
        }
      }
      return <>{lines}</>
    }, [selectedLexId, highlightedNids, positions])

    const planetsLayer = useMemo(() => {
      return (
      <>
        {nodes.map(n => {
          const nid = String(n.data.nodeId)
          const p = positions.get(nid); if (!p) return null
          const isSel = selectedNid === nid
          const isHl = highlightedNids.has(nid)
          const lexs = lexsByNid.get(nid) || []
          const dimmed = isNodeDimmed(nid)
          return (
            <g key={n.id}
               onMouseEnter={() => setHoverIfIdle(nid)}
               onMouseLeave={() => setHoverIfIdle(null)}
               style={{ opacity: dimmed ? 0.25 : 1, transition: 'opacity 150ms' }}>
              {(isSel || isHl) && (
                <circle cx={p.x} cy={p.y} r={22}
                  fill={isHl ? '#fde68a' : p.color} opacity={0.3} />
              )}
              <circle cx={p.x} cy={p.y} r={isSel ? 14 : 10}
                fill={p.color}
                stroke={isSel || isHl ? '#fff' : 'none'} strokeWidth={2}
                style={{ cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); tryClick(() => selectByNid(treeId, nid)) }} />

              {lexs.map((lex, i) => {
                const ang = (i / Math.max(lexs.length, 1)) * Math.PI * 2
                const mx = p.x + Math.cos(ang) * 22
                const my = p.y + Math.sin(ang) * 22
                const mc = catColor(String(lex.data.category || ''))
                const moonSel = selectedLexId === lex.id
                const moonRel = relatedLexIds.has(lex.id)
                return (
                  <g key={lex.id}>
                    {moonRel && <circle cx={mx} cy={my} r={6} fill="none" stroke="#fde68a" strokeOpacity={0.55} strokeWidth={1} />}
                    <circle cx={mx} cy={my} r={moonSel ? 4.5 : 3}
                      fill={mc} stroke={moonSel ? '#fff' : 'none'} strokeWidth={1}
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); tryClick(() => selectByLex(lex.id)) }}>
                      <title>{String(lex.data.term)} · {String(lex.data.category || 'inne')}</title>
                    </circle>
                  </g>
                )
              })}
            </g>
          )
        })}
      </>
      )
    }, [nodes, positions, lexsByNid, selectedNid, selectedLexId, relatedLexIds, highlightedNids, treeId, neighborSet])

    const labelsLayer = useMemo(() => {
      const z = Math.max(zoomPct / 100, 1)
      const fs = 10 / z
      return (
        <>
          {nodes.map(n => {
            const nid = String(n.data.nodeId)
            const p = positions.get(nid); if (!p) return null
            const isSel = selectedNid === nid
            const isHl = highlightedNids.has(nid)
            const isHov = hovered === nid
            const op = labelOpacity(isSel || isHl, isHov)
            if (op <= 0) return null
            return (
              <Label key={n.id}
                x={p.x} y={p.y + 30}
                text={String(n.data.title)} color="#fff"
                size={fs} opacity={op} weight={500} />
            )
          })}
        </>
      )
    }, [nodes, positions, selectedNid, highlightedNids, hovered, zoomPct])

    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <svg ref={svgRef} viewBox="0 0 600 600" preserveAspectRatio="xMidYMid meet"
          style={{ display: 'block', width: '100%', height: '100%', background: 'radial-gradient(ellipse at center, #1a2440 0%, #0a0e1a 100%)', borderRadius: 8, cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none' }}
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={finishDrag}
          onMouseLeave={finishDrag}
          onClick={onBackgroundClick}>
          <g ref={gRef}>
            {orbitsLayer}
            <circle cx={cx} cy={cy} r={6} fill="#fde68a" />
            <circle cx={cx} cy={cy} r={14} fill="#fde68a" opacity={0.2} />
            {contextLayer}
            {edgesLayer}
            {highlightLines}
            {planetsLayer}
            {labelsLayer}
          </g>
        </svg>

        {/* HUD: zoom + reset */}
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6, alignItems: 'center', background: 'rgba(10,14,26,0.7)', padding: '4px 8px', borderRadius: 6, fontSize: 11, color: '#cbd5e1' }}>
          <span>{zoomPct}%</span>
          <ui.Button size="xs" color="ghost" outline onClick={reset}>
            <Maximize2 size={12} /> Reset
          </ui.Button>
        </div>
      </div>
    )
  }

  function CenterPanel() {
    return <ui.Page><GraphView /></ui.Page>
  }

  // ── Prawy panel: szczegóły wybranego węzła LUB terminu ────────────
  function RightPanel() {
    const { treeId, selectedNid, selectedLexId } = useNav()
    const nodes = store.useChildren(treeId || '', 'node') as PostRecord[]
    const edges = store.useChildren(treeId || '', 'edge') as PostRecord[]
    const lexicons = store.useChildren(treeId || '', 'lexicon') as PostRecord[]
    const allLexNodes = store.usePosts('lexNode') as PostRecord[]

    const lexById = useMemo(() => new Map(lexicons.map(l => [l.id, l])), [lexicons])
    const nodeByNid = useMemo(() => {
      const m = new Map<string, PostRecord>()
      for (const n of nodes) m.set(String(n.data.nodeId), n)
      return m
    }, [nodes])

    // Widok: TERMIN
    if (selectedLexId) {
      const lex = lexById.get(selectedLexId)
      if (!lex) return <ui.Placeholder text="Termin nie istnieje" />
      const myNidSet = new Set<string>()
      for (const ln of allLexNodes) {
        if (ln.parentId === selectedLexId) myNidSet.add(String(ln.data.nid))
      }
      const containingNodes = nodes.filter(n => myNidSet.has(String(n.data.nodeId)))

      const counter = new Map<string, number>()
      for (const ln of allLexNodes) {
        if (ln.parentId === selectedLexId) continue
        if (!myNidSet.has(String(ln.data.nid))) continue
        counter.set(ln.parentId, (counter.get(ln.parentId) || 0) + 1)
      }
      const related: { lex: PostRecord; count: number }[] = []
      for (const [lexId, count] of counter) {
        const l = lexById.get(lexId)
        if (l) related.push({ lex: l, count })
      }
      related.sort((a, b) => b.count - a.count)

      return (
        <ui.Page>
          <ui.Stack>
            <ui.Heading
              title={String(lex.data.term)}
              subtitle={String(lex.data.category || 'termin')}
            />
            <ui.Text size="sm">{String(lex.data.definition || '—')}</ui.Text>
            <ui.Divider />
            <ui.Cell label>Występuje w ({containingNodes.length})</ui.Cell>
            {containingNodes.length === 0 && <ui.Text muted size="xs">brak</ui.Text>}
            {containingNodes.map(n => (
              <ui.ListItem key={n.id}
                label={String(n.data.title)}
                detail={String(n.data.branch || '')}
                onClick={() => selectByNid(treeId!, String(n.data.nodeId))}
              />
            ))}
            <ui.Divider />
            <ui.Cell label>Powiązane terminy ({related.length})</ui.Cell>
            {related.length === 0 && <ui.Text muted size="xs">brak współwystępujących</ui.Text>}
            {related.map(r => (
              <ui.ListItem key={r.lex.id}
                label={
                  <>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: catColor(String(r.lex.data.category || '')), marginRight: 6 }} />
                    {String(r.lex.data.term)}
                  </>
                }
                detail={`${r.count} wspólnych węzłów · ${String(r.lex.data.category || '')}`}
                onClick={() => selectByLex(r.lex.id)}
              />
            ))}
          </ui.Stack>
        </ui.Page>
      )
    }

    // Widok: WĘZEŁ
    const node = selectedNid ? nodeByNid.get(selectedNid) : undefined
    if (!node) return <ui.Placeholder text="Wybierz węzeł lub termin" />

    const myLexs: PostRecord[] = []
    for (const ln of allLexNodes) {
      if (String(ln.data.nid) !== selectedNid) continue
      const l = lexById.get(ln.parentId)
      if (l) myLexs.push(l)
    }
    const lexsByCat = new Map<string, PostRecord[]>()
    for (const l of myLexs) {
      const c = String(l.data.category || 'inne')
      if (!lexsByCat.has(c)) lexsByCat.set(c, [])
      lexsByCat.get(c)!.push(l)
    }

    const titleOf = (nid: string) => String(nodeByNid.get(nid)?.data.title ?? nid)
    const out = edges.filter(e => e.data.fromNid === selectedNid)
    const inc = edges.filter(e => e.data.toNid   === selectedNid)

    return (
      <ui.Page>
        <ui.Stack>
          <ui.Heading title={String(node.data.title)} subtitle={`#${selectedNid}`} />
          <ui.Row>
            {node.data.branch ? <ui.Badge>{String(node.data.branch)}</ui.Badge> : null}
            {node.data.tier ? <ui.Text size="xs" muted>Poziom {String(node.data.tier)}</ui.Text> : null}
          </ui.Row>

          <ui.Divider />

          <ui.Cell label>Terminy ({myLexs.length})</ui.Cell>
          {myLexs.length === 0 && <ui.Text muted size="xs">brak</ui.Text>}
          {Array.from(lexsByCat.entries()).map(([cat, ls]) => (
            <React.Fragment key={cat}>
              <ui.Row>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: catColor(cat) }} />
                <ui.Text size="xs" muted>{cat} ({ls.length})</ui.Text>
              </ui.Row>
              {ls.map(l => (
                <ui.ListItem key={l.id}
                  label={String(l.data.term)}
                  detail={String(l.data.definition || '').slice(0, 60)}
                  onClick={() => selectByLex(l.id)}
                />
              ))}
            </React.Fragment>
          ))}

          <ui.Divider />

          <ui.Cell label>Wychodzące ({out.length})</ui.Cell>
          {out.length === 0 && <ui.Text muted size="xs">brak</ui.Text>}
          {out.map(e => (
            <ui.ListItem key={e.id}
              label={titleOf(String(e.data.toNid))}
              detail={e.data.type ? String(e.data.type) : undefined}
              onClick={() => selectByNid(treeId!, String(e.data.toNid))}
            />
          ))}

          <ui.Divider />

          <ui.Cell label>Przychodzące ({inc.length})</ui.Cell>
          {inc.length === 0 && <ui.Text muted size="xs">brak</ui.Text>}
          {inc.map(e => (
            <ui.ListItem key={e.id}
              label={titleOf(String(e.data.fromNid))}
              detail={e.data.type ? String(e.data.type) : undefined}
              onClick={() => selectByNid(treeId!, String(e.data.fromNid))}
            />
          ))}
        </ui.Stack>
      </ui.Page>
    )
  }

  sdk.registerView('cosmos.left',   { slot: 'left',   component: LeftPanel })
  sdk.registerView('cosmos.center', { slot: 'center', component: CenterPanel })
  sdk.registerView('cosmos.right',  { slot: 'right',  component: RightPanel })

  return {
    id: 'cosmos-bq',
    label: 'Kosmos BQ',
    description: 'Kosmiczny widok grafu BQ — orbity gałęzi + księżyce terminów, układ d3-force',
    icon: Share2 || GitBranch,
    version: '0.5.0',
  }
}

export default plugin
