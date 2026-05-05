import type { PluginFactory, PostRecord } from '@obieg-zero/sdk'
import { forceSimulation, forceLink, forceCollide, forceRadial, forceManyBody } from 'd3-force'

const plugin: PluginFactory = ({ React, ui, store, sdk, icons }) => {
  const { useMemo, useEffect, useState, useRef } = React
  const { Share2, GitBranch, Maximize2 } = icons

  const NO_BRANCH = '_none'
  const CONTEXT_BRANCH_PREFIX = 'kontekst'
  const planetRadius = (slides: number) => Math.min(8 + slides, 18)

  const darken = (hex: string, amt = 0.45): string => {
    const m = hex.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i)
    if (!m) return hex
    const f = (h: string) => Math.max(0, Math.round(parseInt(h, 16) * (1 - amt)))
    return `rgb(${f(m[1])},${f(m[2])},${f(m[3])})`
  }

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
  const selectByLex = (lexId: string) =>
    useNav.setState({ selectedLexId: lexId, selectedNid: null })

  const CAT_COLORS: Record<string, string> = {
    motyw: '#f59e0b', topos: '#ef4444', gatunek: '#4a90e2',
    srodek: '#9b59b6', srodek_stylistyczny: '#9b59b6',
    postac: '#22c55e', pojecie: '#fde68a', 'pojęcie': '#fde68a',
  }
  const COLOR_MAP: Record<string, string> = {
    primary: '#4a90e2', secondary: '#9b59b6', accent: '#e91e63',
    info: '#00bcd4', success: '#22c55e', warning: '#f59e0b',
    error: '#ef4444', neutral: '#94a3b8',
  }
  const PALETTE = ['#4a90e2', '#e91e63', '#22c55e', '#f59e0b', '#9b59b6', '#00bcd4', '#ef4444', '#94a3b8']
  const catColor = (c: string) => CAT_COLORS[c] || '#94a3b8'
  const branchOf = (n: PostRecord) => String(n.data.branch || '') || NO_BRANCH

  type BranchInfo = { key: string; label: string; color: string; def?: PostRecord }
  const usedBranchInfos = (nodes: PostRecord[], branches: PostRecord[]): BranchInfo[] => {
    const byKey = new Map(branches.map(b => [String(b.data.key), b]))
    const used: string[] = []
    const seen = new Set<string>()
    for (const b of branches) {
      const k = String(b.data.key)
      if (!seen.has(k) && nodes.some(n => branchOf(n) === k)) { used.push(k); seen.add(k) }
    }
    if (nodes.some(n => branchOf(n) === NO_BRANCH)) used.push(NO_BRANCH)
    return used.map((k, i) => {
      const def = byKey.get(k)
      return {
        key: k,
        label: def ? String(def.data.label) : 'bez gałęzi',
        color: COLOR_MAP[String(def?.data.color || '')] || PALETTE[i % PALETTE.length],
        def,
      }
    })
  }

  const Dot = ({ color }: { color: string }) => (
    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: color, marginRight: 6 }} />
  )

  // Tier ma różną semantykę per gałąź — epoki=kolejność chronologiczna, lektury=trudność.
  const tierLabel = (branchKey: string, tier: unknown): string => {
    const n = String(tier ?? '').trim()
    if (!n || n === '0') return ''
    const k = String(branchKey || '').toLowerCase()
    if (k.startsWith('epok')) return `epoka ${n}`
    if (k.startsWith('lektur')) return `poziom ${n}`
    if (k.startsWith(CONTEXT_BRANCH_PREFIX)) return ''
    return `tier ${n}`
  }

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
                  <Dot color={g.color} />{g.label}
                </ui.Cell>
                {g.nodes.map(n => {
                  const nid = String(n.data.nodeId)
                  return (
                    <ui.ListItem key={n.id}
                      active={selectedNid === nid}
                      label={String(n.data.title)}
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

  function GraphView() {
    const { treeId, selectedNid, selectedLexId } = useNav()
    const nodes    = store.useChildren(treeId || '', 'node') as PostRecord[]
    const edges    = store.useChildren(treeId || '', 'edge') as PostRecord[]
    const branches = store.useChildren(treeId || '', 'branch') as PostRecord[]
    const relTypes = store.useChildren(treeId || '', 'relType') as PostRecord[]
    const lexicons = store.useChildren(treeId || '', 'lexicon') as PostRecord[]
    const allLexNodes = store.usePosts('lexNode') as PostRecord[]
    const allContent = store.usePosts('content') as PostRecord[]

    const slidesByNodeId = useMemo(() => {
      const m = new Map<string, number>()
      for (const c of allContent) {
        if (String(c.data.contentType) === 'quiz') continue
        m.set(c.parentId, (m.get(c.parentId) || 0) + 1)
      }
      return m
    }, [allContent])

    const contextNids = useMemo(() => {
      const set = new Set<string>()
      for (const n of nodes) {
        const k = String(n.data.branch || '').toLowerCase()
        if (k.startsWith(CONTEXT_BRANCH_PREFIX)) set.add(String(n.data.nodeId))
      }
      return set
    }, [nodes])

    const planetRByNid = useMemo(() => {
      const m = new Map<string, number>()
      for (const n of nodes) {
        m.set(String(n.data.nodeId), planetRadius(slidesByNodeId.get(n.id) || 0))
      }
      return m
    }, [nodes, slidesByNodeId])

    const branchColorByNid = useMemo(() => {
      const orbitColors = new Map(usedBranchInfos(nodes, branches).map(b => [b.key, b.color]))
      const m = new Map<string, string>()
      for (const n of nodes) {
        m.set(String(n.data.nodeId), orbitColors.get(branchOf(n)) || '#94a3b8')
      }
      return m
    }, [nodes, branches])


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
      slidesByNodeId={slidesByNodeId}
      contextNids={contextNids}
      planetRByNid={planetRByNid}
      branchColorByNid={branchColorByNid}
      selectedNid={selectedNid} selectedLexId={selectedLexId}
      relatedLexIds={relatedLexIds}
      highlightedNids={highlightedNids}
      treeId={treeId!}
    />
  }

  function CosmosSvg(props: {
    cx: number; cy: number
    orbits: Array<{ key: string; label: string; color: string; radius: number }>
    positions: Map<string, { x: number; y: number; color: string }>
    nodes: PostRecord[]
    edges: PostRecord[]
    contextEdges: { from: string; to: string; relation: string; relLabel: string; relColor: string; count: number; strength: number }[]
    lexsByNid: Map<string, PostRecord[]>
    slidesByNodeId: Map<string, number>
    contextNids: Set<string>
    planetRByNid: Map<string, number>
    branchColorByNid: Map<string, string>
    selectedNid: string | null
    selectedLexId: string | null
    relatedLexIds: Set<string>
    highlightedNids: Set<string>
    treeId: string
  }) {
    const { cx, cy, orbits, positions, nodes, edges, contextEdges, lexsByNid, slidesByNodeId, contextNids, planetRByNid, branchColorByNid,
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

    const onBackgroundClick = () => {
      if (wasMovedRef.current) { wasMovedRef.current = false; return }
      useNav.setState({ selectedNid: null, selectedLexId: null })
    }

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

    const z = Math.max(zoomPct / 100, 0.5)
    const Label = (p: {
      x: number; y: number; text: string; color: string;
      size?: number; opacity?: number; weight?: number; uppercase?: boolean;
    }) => {
      const baseSize = p.size ?? 10
      const fs = baseSize / z
      const sw = (baseSize * 0.18) / z
      return (
        <text x={p.x} y={p.y} textAnchor="middle"
          fontSize={fs}
          fill={p.color}
          opacity={p.opacity ?? 1}
          style={{
            pointerEvents: 'none',
            paintOrder: 'stroke',
            letterSpacing: (p.uppercase ? 0.6 : 0.2) / z,
            fontWeight: p.weight ?? 500,
            textTransform: p.uppercase ? 'uppercase' : 'none',
          }}
          stroke="#0a0e1a" strokeWidth={sw} strokeOpacity={0.7}>
          {p.text}
        </text>
      )
    }

    const edgeOpacity = (
      focused: boolean, relevant: boolean,
      idle: number, focusedOp: number, relevantOp: number, dim = 0.02
    ): number => !neighborSet ? idle : focused ? focusedOp : relevant ? relevantOp : dim

    const arrowGeom = (a: { x: number; y: number }, b: { x: number; y: number }, targetR: number) => {
      const dx = b.x - a.x, dy = b.y - a.y
      const d = Math.hypot(dx, dy) || 1
      const tipX = b.x - (dx / d) * (targetR + 2)
      const tipY = b.y - (dy / d) * (targetR + 2)
      const ang = Math.atan2(dy, dx)
      const arrLen = 8, arrWide = 4
      const baseX = tipX - arrLen * Math.cos(ang)
      const baseY = tipY - arrLen * Math.sin(ang)
      const w1x = baseX + arrWide * Math.sin(ang)
      const w1y = baseY - arrWide * Math.cos(ang)
      const w2x = baseX - arrWide * Math.sin(ang)
      const w2y = baseY + arrWide * Math.cos(ang)
      return {
        path: `M${tipX},${tipY} L${w1x},${w1y} L${w2x},${w2y} Z`,
        lineEnd: { x: baseX, y: baseY },
      }
    }

    // Strzałka jako <path> (NIE marker) — żeby dziedziczyć opacity linii.
    const Edge = (p: {
      a: { x: number; y: number }; b: { x: number; y: number }
      color: string; op: number; sw: number
      dashed?: boolean
      arrow?: { targetR: number }
      label?: { text: string; color: string; size?: number; weight?: number }
    }) => {
      const arrow = p.arrow ? arrowGeom(p.a, p.b, p.arrow.targetR) : null
      const lineEnd = arrow ? arrow.lineEnd : p.b
      return (
        <>
          <line x1={p.a.x} y1={p.a.y} x2={lineEnd.x} y2={lineEnd.y}
            stroke={p.color} strokeOpacity={p.op} strokeWidth={p.sw}
            strokeLinecap="round"
            strokeDasharray={p.dashed ? '4 3' : undefined} />
          {arrow && (
            <path d={arrow.path} fill={p.color} opacity={p.op} />
          )}
          {p.label && (
            <Label x={(p.a.x + p.b.x) / 2} y={(p.a.y + p.b.y) / 2 - 4}
              text={p.label.text} color={p.label.color}
              size={p.label.size ?? 9} opacity={0.95}
              weight={p.label.weight ?? 500} />
          )}
        </>
      )
    }

    // Warstwy używające <Label> MUSZĄ mieć `z` w deps — Label czyta z z closure, memo trzyma stary fs.
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
    }, [orbits, cx, cy, z])

    const edgesLayer = useMemo(() => (
      <>
        {edges.map(e => {
          const fromNid = String(e.data.fromNid), toNid = String(e.data.toNid)
          const a = positions.get(fromNid), b = positions.get(toNid)
          if (!a || !b) return null
          const hasType = !!e.data.type
          const op = edgeOpacity(
            isEdgeFocused(fromNid, toNid), isEdgeRelevant(fromNid, toNid),
            hasType ? 0.6 : 0.15,
            hasType ? 0.95 : 0.7,
            hasType ? 0.5 : 0.25,
          )
          return (
            <g key={e.id}>
              <Edge
                a={a} b={b}
                color={branchColorByNid.get(toNid) || '#94a3b8'}
                op={op}
                sw={hasType ? (op > 0.3 ? 2 : 1.5) : (op > 0.3 ? 1.5 : 1)}
                dashed={contextNids.has(fromNid) || contextNids.has(toNid)}
                arrow={hasType ? { targetR: planetRByNid.get(toNid) || 8 } : undefined}
                label={
                  e.data.type && !!neighborSet && isEdgeFocused(fromNid, toNid)
                    ? { text: String(e.data.type), color: '#cbd5e1' }
                    : undefined
                }
              />
            </g>
          )
        })}
      </>
    ), [edges, positions, neighborSet, focusNid, z, contextNids, planetRByNid, branchColorByNid])

    const contextLayer = useMemo(() => (
      <>
        {contextEdges.map((ce, i) => {
          const a = positions.get(ce.from), b = positions.get(ce.to)
          if (!a || !b) return null
          const op = edgeOpacity(
            isEdgeFocused(ce.from, ce.to), isEdgeRelevant(ce.from, ce.to),
            ce.count < 2 ? 0 : Math.min(0.12 + ce.strength * 0.15, 0.3),
            Math.min(0.5 + ce.strength * 0.4, 0.9),
            0.25,
          )
          return (
            <g key={`ctx-${i}`}>
              <Edge
                a={a} b={b} color={ce.relColor} op={op}
                sw={1 + Math.min(ce.count - 1, 2) * 0.4}
                dashed={contextNids.has(ce.from) || contextNids.has(ce.to)}
                label={
                  !!neighborSet && isEdgeFocused(ce.from, ce.to)
                    ? { text: `${ce.relLabel}${ce.count > 1 ? ` ·${ce.count}` : ''}`, color: ce.relColor, size: 8, weight: 600 }
                    : undefined
                }
              />
            </g>
          )
        })}
      </>
    ), [contextEdges, positions, neighborSet, focusNid, z, contextNids])

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

    const shadowsLayer = useMemo(() => (
      <>
        <defs>
          {nodes.map(n => {
            const nid = String(n.data.nodeId)
            const p = positions.get(nid); if (!p) return null
            const dx = p.x - cx, dy = p.y - cy
            const len = Math.hypot(dx, dy) || 1
            const ux = dx / len, uy = dy / len
            const shadowLen = 110
            return (
              <linearGradient key={n.id} id={`bq-shadow-${nid}`} gradientUnits="userSpaceOnUse"
                x1={p.x} y1={p.y}
                x2={p.x + ux * shadowLen} y2={p.y + uy * shadowLen}>
                <stop offset="0%"  stopColor="#000" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#000" stopOpacity={0} />
              </linearGradient>
            )
          })}
        </defs>
        {nodes.map(n => {
          const nid = String(n.data.nodeId)
          const p = positions.get(nid); if (!p) return null
          const slides = slidesByNodeId.get(n.id) || 0
          const r = Math.min(8 + slides * 1.0, 18)
          const dx = p.x - cx, dy = p.y - cy
          const len = Math.hypot(dx, dy) || 1
          const ux = dx / len, uy = dy / len
          const px = -uy, py = ux
          const shadowLen = 110
          const w0 = r * 0.9
          const w1 = r * 0.45
          const x1 = p.x + px * w0,            y1 = p.y + py * w0
          const x2 = p.x - px * w0,            y2 = p.y - py * w0
          const x3 = p.x - px * w1 + ux * shadowLen, y3 = p.y - py * w1 + uy * shadowLen
          const x4 = p.x + px * w1 + ux * shadowLen, y4 = p.y + py * w1 + uy * shadowLen
          return (
            <polygon key={n.id}
              points={`${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}`}
              fill={`url(#bq-shadow-${nid})`} pointerEvents="none" />
          )
        })}
      </>
    ), [nodes, positions, slidesByNodeId, cx, cy])

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
          const slides = slidesByNodeId.get(n.id) || 0
          const baseR = Math.min(8 + slides * 1.0, 18)
          const r = isSel ? baseR + 4 : baseR
          const moonOrbitR = r + 8
          const haloR = r + 8
          const tier = String(n.data.tier ?? '')
          const tierFs = Math.max(7, baseR * 0.85) / z
          return (
            <g key={n.id}
               onMouseEnter={() => setHoverIfIdle(nid)}
               onMouseLeave={() => setHoverIfIdle(null)}
               style={{ opacity: dimmed ? 0.25 : 1, transition: 'opacity 150ms' }}>
              {(isSel || isHl) && (
                <circle cx={p.x} cy={p.y} r={haloR}
                  fill={isHl ? '#fde68a' : p.color} opacity={0.3} />
              )}
              <circle cx={p.x} cy={p.y + Math.max(2, r * 0.18)} r={r}
                fill={darken(p.color)} style={{ pointerEvents: 'none' }} />
              <circle cx={p.x} cy={p.y} r={r}
                fill={p.color}
                stroke={isSel || isHl ? '#fff' : 'none'} strokeWidth={2}
                style={{ cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); tryClick(() => selectByNid(treeId, nid)) }} />

              {tier && (
                <text x={p.x} y={p.y + tierFs * 0.35} textAnchor="middle"
                  fontSize={tierFs} fill="#0a0e1a" fontWeight={700}
                  style={{ pointerEvents: 'none' }}>
                  {tier}
                </text>
              )}

              {lexs.map((lex, i) => {
                const ang = (i / Math.max(lexs.length, 1)) * Math.PI * 2
                const mx = p.x + Math.cos(ang) * moonOrbitR
                const my = p.y + Math.sin(ang) * moonOrbitR
                const mc = catColor(String(lex.data.category || ''))
                const moonSel = selectedLexId === lex.id
                const moonRel = relatedLexIds.has(lex.id)
                return (
                  <g key={lex.id}>
                    {moonRel && <circle cx={mx} cy={my} r={5} fill="none" stroke="#fde68a" strokeOpacity={0.55} strokeWidth={1} />}
                    <circle cx={mx} cy={my} r={moonSel ? 4 : 2.6}
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
    }, [nodes, positions, lexsByNid, slidesByNodeId, selectedNid, selectedLexId, relatedLexIds, highlightedNids, treeId, neighborSet, z])

    const labelsLayer = useMemo(() => {
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
            const slides = slidesByNodeId.get(n.id) || 0
            const baseR = Math.min(8 + slides * 1.0, 18)
            return (
              <Label key={n.id}
                x={p.x} y={p.y + baseR + 14}
                text={String(n.data.title)} color="#fff"
                size={10} opacity={op} weight={500} />
            )
          })}
        </>
      )
    }, [nodes, positions, slidesByNodeId, selectedNid, highlightedNids, hovered, zoomPct])

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
            {shadowsLayer}
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

  const buildTerms = (lexs: PostRecord[]) =>
    lexs.map(lex => ({ id: lex.id, term: String(lex.data.term) }))

  function SlidesViewer({ node, myLexs }: { node: PostRecord; myLexs: PostRecord[] }) {
    const allContent = store.useChildren(node.id, 'content') as PostRecord[]
    const slides = useMemo(() => allContent.filter(c => String(c.data.contentType) !== 'quiz'), [allContent])
    const terms = useMemo(() => buildTerms(myLexs), [myLexs])

    const [idx, setIdx] = useState(0)
    const [loading, setLoading] = useState(false)
    useEffect(() => { setIdx(0) }, [node.id])

    useEffect(() => {
      const h = (sdk.shared.getState() as any)?.bqHelpers
      if (!h?.loadNodeContent) return
      setLoading(true)
      h.loadNodeContent(node.parentId, String(node.data.nodeId)).finally(() => setLoading(false))
    }, [node.id])

    const safeIdx = Math.min(idx, Math.max(0, slides.length - 1))
    const slide = slides[safeIdx]

    if (slides.length === 0) {
      return <ui.Text size="xs" muted>{loading ? 'Wczytuję treści…' : 'Brak treści dla tego węzła.'}</ui.Text>
    }
    return (
      <ui.Stack gap="sm">
        <ui.Row justify="between">
          <ui.Text size="xs" muted>Slajd {safeIdx + 1} / {slides.length}</ui.Text>
          <ui.Row>
            <ui.Button size="xs" outline disabled={safeIdx <= 0}
              onClick={() => setIdx(i => Math.max(0, i - 1))}>‹</ui.Button>
            <ui.Button size="xs" outline disabled={safeIdx >= slides.length - 1}
              onClick={() => setIdx(i => Math.min(slides.length - 1, i + 1))}>›</ui.Button>
          </ui.Row>
        </ui.Row>
        <ui.Markdown text={String(slide?.data.text || '')}
          terms={terms} onTermClick={(id) => selectByLex(id)} />
      </ui.Stack>
    )
  }

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
                label={<><Dot color={catColor(String(r.lex.data.category || ''))} />{String(r.lex.data.term)}</>}
                detail={`${r.count} wspólnych węzłów · ${String(r.lex.data.category || '')}`}
                onClick={() => selectByLex(r.lex.id)}
              />
            ))}
          </ui.Stack>
        </ui.Page>
      )
    }

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
            {(() => {
              const lbl = tierLabel(String(node.data.branch || ''), node.data.tier)
              return lbl ? <ui.Text size="xs" muted>{lbl}</ui.Text> : null
            })()}
          </ui.Row>

          <ui.Divider />

          <SlidesViewer node={node} myLexs={myLexs} />

          <ui.Divider />

          <ui.Cell label>Terminy ({myLexs.length})</ui.Cell>
          {myLexs.length === 0 && <ui.Text muted size="xs">brak</ui.Text>}
          {Array.from(lexsByCat.entries()).map(([cat, ls]) => (
            <React.Fragment key={cat}>
              <ui.Row>
                <Dot color={catColor(cat)} />
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
