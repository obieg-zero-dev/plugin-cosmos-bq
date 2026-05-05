import type { PluginFactory, PostRecord } from '@obieg-zero/sdk'
import {
  forceSimulation, forceLink, forceCollide, forceRadial, forceManyBody,
  type Simulation, type SimulationNodeDatum, type SimulationLinkDatum,
} from 'd3-force'
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import { drag as d3drag } from 'd3-drag'
import { select } from 'd3-selection'

const plugin: PluginFactory = ({ React, ui, store, sdk, icons }) => {
  const { useMemo, useEffect, useState, useRef } = React
  const { Share2, GitBranch, Maximize2 } = icons

  const NO_BRANCH = '_none'
  const CONTEXT_BRANCH_PREFIX = 'kontekst'
  const planetRadius = (slides: number) => Math.min(8 + slides, 18)

  // Kosmiczna paleta (chrome SVG — niezależne od motywu, definiuje "kosmos" look).
  const COSMOS = {
    star: '#fde68a',
    bgFrom: '#1a2440',
    bgTo: '#0a0e1a',
    label: '#fff',
    labelStroke: '#0a0e1a',
    highlight: '#fde68a',
    edgeLabel: '#cbd5e1',
    fallback: '#94a3b8',
    hud: '#cbd5e1',
    hudBg: 'rgba(10,14,26,0.7)',
  }

  // Daisy tokeny → CSS vars (zgodnie z @obieg-zero/bq-graph).
  // Branch/relType color w danych to nazwa tokenu ('primary', 'accent'...) — rozwiązujemy do var(--color-X).
  const DAISY_TOKENS = new Set(['primary', 'secondary', 'accent', 'info', 'success', 'warning', 'error', 'neutral'])
  const tok = (name: string): string => {
    if (!name) return COSMOS.fallback
    if (name.startsWith('#') || name.startsWith('var(') || name.startsWith('rgb')) return name
    if (DAISY_TOKENS.has(name)) return `var(--color-${name})`
    return COSMOS.fallback
  }

  // Color-mix darken — działa zarówno na hex jak i var(). Używane do "duolingo lift" pod planetą.
  const darken = (color: string, amt = 0.45): string =>
    `color-mix(in srgb, ${color} ${Math.round((1 - amt) * 100)}%, black)`

  // === Tuning symulacji d3-force. Wszystkie magic numbers z poprzednich wersji TUTAJ.
  const SIM = {
    radial: 0.45,        // siła trzymania na orbicie (była 0.9 — za mocna, planety się nie ruszały). 0.45 = widoczne osiadanie.
    collide: 26,         // promień rozpychania (planeta ma 8-18, więc otoczka ~8 px buforu)
    linkDistance: 80,    // docelowa długość krawędzi structural
    linkStrength: 0.18,  // siła ściągania połączonych (słabe, żeby radial dominował)
    charge: -22,         // miękkie odpychanie globalne
    alpha: 1,            // start z pełną energią — symulacja wystartuje "rozsypując" planety
    alphaDecay: 0.04,    // szybkość wygaszania (default 0.0228 → wolniej; 0.04 = osiada w ~80 ticków)
    alphaMin: 0.001,
    velocityDecay: 0.5,  // tłumienie prędkości — wyższe = mniej wibracji
  }
  // Zoom limits + szybkość wygaszania resetu
  const ZOOM = { min: 0.5, max: 5, resetMs: 350 }

  // === Moon/kontekst — duolingo-chip jako rounded square (kwadrat z zaokrąglonymi rogami).
  const MOON = {
    size: 7,             // bok idle
    sizeSelected: 9,     // bok selected (większy + biała ramka)
    rx: 2,               // zaokrąglenie rogów
    ringSize: 11,        // outer rounded rect dla related (powiązany termin)
    ringRx: 3,
    orbitGap: 14,        // ile px od krawędzi planety (poprzednio 8 — było zbyt blisko)
    liftOff: 1.5,        // przesunięcie ciemnej tarczy "lift" w dół (chunky 3D, jak Planet)
  }

  // === Sonar/ping na zaznaczonej planecie. ASMR-breath: rzadkie, długie, spokojne pulsowanie.
  const SONAR = {
    rings: 2,                // dwa ringi w locie (jeden jeszcze wybrzmiewa gdy drugi startuje)
    duration: 5.0,           // s — długi cykl. Przy 2 ringach stagger = 2.5s — puls co ~2.5s, tempo oddechu
    scaleFrom: 1,
    scaleTo: 2.6,
    opacityFrom: 0.55,       // delikatnie, długo w polu widzenia
    strokeWidth: 2.2,        // grubsza linia (zachowane)
  }

  type SimNode = SimulationNodeDatum & {
    id: string
    branch: string
    targetR: number      // promień orbity (cel forceRadial)
    color: string
  }
  type SimLink = SimulationLinkDatum<SimNode>

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
  // Paleta daisy tokenów — zarówno dla gałęzi (rotacyjnie) jak i dla nieznanych kategorii leksykonu (przez hash → deterministyczne, ale każda kategoria dostaje własny żywy kolor zamiast szarego).
  const PALETTE = ['primary', 'accent', 'success', 'warning', 'secondary', 'info', 'error', 'neutral']
  const hashStr = (s: string) => {
    let h = 0
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
    return h
  }
  const catColor = (c: string): string => {
    if (CAT_COLORS[c]) return CAT_COLORS[c]
    if (!c) return tok(PALETTE[0])  // pusty string → primary, zamiast szarego
    return tok(PALETTE[hashStr(c) % PALETTE.length])
  }
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
      const colorRaw = String(def?.data.color || '')
      return {
        key: k,
        label: def ? String(def.data.label) : 'bez gałęzi',
        color: colorRaw ? tok(colorRaw) : tok(PALETTE[i % PALETTE.length]),
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
        m.set(String(n.data.nodeId), orbitColors.get(branchOf(n)) || COSMOS.fallback)
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
          relColor: tok(String(def?.data.color || '')),
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

    // Layout orbit + initial sim nodes. Symulacja NIE biega tutaj — biega w CosmosSvg (animowana).
    const { initialSimNodes, simLinks, orbits } = useMemo(() => {
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

      const initialSimNodes: SimNode[] = []
      for (const orbit of orbits) {
        const onOrbit = nodes.filter(n => branchOf(n) === orbit.key)
        onOrbit.forEach((n, j) => {
          const a = (j / Math.max(onOrbit.length, 1)) * Math.PI * 2 - Math.PI / 2
          initialSimNodes.push({
            id: String(n.data.nodeId),
            x: cx + Math.cos(a) * orbit.radius,
            y: cy + Math.sin(a) * orbit.radius,
            targetR: orbit.radius,
            color: orbit.color,
            branch: orbit.key,
          })
        })
      }

      const nidSet = new Set(initialSimNodes.map(n => n.id))
      const simLinks: SimLink[] = edges
        .map(e => ({ source: String(e.data.fromNid), target: String(e.data.toNid) }))
        .filter(l => nidSet.has(l.source as string) && nidSet.has(l.target as string)) as SimLink[]

      return { initialSimNodes, simLinks, orbits }
    }, [nodes, branches, edges])

    if (nodes.length === 0) return <ui.Placeholder text="Drzewo nie ma węzłów" />

    return <CosmosSvg
      cx={cx} cy={cy}
      orbits={orbits}
      initialSimNodes={initialSimNodes}
      simLinks={simLinks}
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
    initialSimNodes: SimNode[]
    simLinks: SimLink[]
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
    const { cx, cy, orbits, initialSimNodes, simLinks, nodes, edges, contextEdges, lexsByNid, slidesByNodeId, contextNids, planetRByNid, branchColorByNid,
            selectedNid, selectedLexId, relatedLexIds, highlightedNids, treeId } = props

    const svgRef = useRef<SVGSVGElement>(null)
    const gRef = useRef<SVGGElement>(null)
    const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
    const simRef = useRef<Simulation<SimNode, SimLink> | null>(null)
    const [zoomK, setZoomK] = useState(1)
    const [panning, setPanning] = useState(false)
    const [hovered, setHovered] = useState<string | null>(null)
    const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(() => {
      const m = new Map()
      for (const n of initialSimNodes) m.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 })
      return m
    })

    // === d3-force: animowana symulacja. tick → setPositions → React rerenderuje warstwy.
    useEffect(() => {
      // Kopia węzłów — sim mutuje x/y/vx/vy in place; nie chcemy mutować propsa.
      const simNodes: SimNode[] = initialSimNodes.map(n => ({ ...n }))
      // Linki kopiowane bo d3 zamienia source/target ze stringów na referencje obiektowe
      const links: SimLink[] = simLinks.map(l => ({ source: l.source, target: l.target }))

      const sim = forceSimulation<SimNode>(simNodes)
        .force('radial', forceRadial<SimNode>(d => d.targetR, cx, cy).strength(SIM.radial))
        .force('collide', forceCollide<SimNode>(SIM.collide))
        .force('link', forceLink<SimNode, SimLink>(links).id(d => d.id).distance(SIM.linkDistance).strength(SIM.linkStrength))
        .force('charge', forceManyBody<SimNode>().strength(SIM.charge))
        .alpha(SIM.alpha)
        .alphaDecay(SIM.alphaDecay)
        .alphaMin(SIM.alphaMin)
        .velocityDecay(SIM.velocityDecay)
        .on('tick', () => {
          const next = new Map<string, { x: number; y: number }>()
          for (const n of simNodes) next.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 })
          setPositions(next)
        })

      simRef.current = sim
      return () => { sim.stop(); simRef.current = null }
    }, [initialSimNodes, simLinks, cx, cy])

    // === d3-zoom: pan + scroll-zoom + click-suppression-after-drag (built-in).
    useEffect(() => {
      if (!svgRef.current || !gRef.current) return
      const svgSel = select(svgRef.current)
      const gSel = select(gRef.current)
      const zb = d3zoom<SVGSVGElement, unknown>()
        .scaleExtent([ZOOM.min, ZOOM.max])
        .on('start', () => setPanning(true))
        .on('zoom', (event) => {
          gSel.attr('transform', event.transform.toString())
          setZoomK(event.transform.k)
        })
        .on('end', () => setPanning(false))
      svgSel.call(zb)
      zoomRef.current = zb
      return () => { svgSel.on('.zoom', null); zoomRef.current = null }
    }, [])

    const reset = () => {
      if (!svgRef.current || !zoomRef.current) return
      select(svgRef.current).transition().duration(ZOOM.resetMs)
        .call(zoomRef.current.transform as any, zoomIdentity)
    }

    const onBackgroundClick = () => {
      // d3-zoom suprymuje click po przeciągnięciu → tu trafia tylko czysty klik.
      useNav.setState({ selectedNid: null, selectedLexId: null })
    }
    const setHoverIfIdle = (nid: string | null) => {
      if (panning) return
      setHovered(prev => (prev === nid ? prev : nid))
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

    const showAllLabels = zoomK >= 1.5
    const labelOpacity = (sel: boolean, hov: boolean) =>
      sel ? 1 : hov ? 0.95 : showAllLabels ? 0.8 : 0

    const z = Math.max(zoomK, 0.5)
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
          stroke={COSMOS.labelStroke} strokeWidth={sw} strokeOpacity={0.7}>
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

    // === Design system kosmosu — żetony, orbity, cienie. Geometria liczona z planetGeom(), zero magic numbers w mapach.
    type PlanetState = 'idle' | 'selected' | 'highlighted'
    const planetGeom = (baseR: number, state: PlanetState) => {
      const r = state === 'selected' ? baseR + 4 : baseR
      return {
        r,                                  // promień korpusu (selected = +4)
        haloR: r + 8,                       // zewnętrzny krąg aureoli
        liftOff: Math.max(2, r * 0.18),     // przesunięcie ciemnej tarczy "lift" w dół (chunky 3D)
        moonOrbitR: r + MOON.orbitGap,      // promień orbity księżyców (z odstępem od krawędzi)
      }
    }

    // Żeton-planeta: flat color + ciemniejszy "lift" pod spodem (duolingo button feel).
    const Planet = (p: {
      x: number; y: number
      color: string
      baseR: number
      state: PlanetState
      tier?: string
      zoomFactor: number       // anty-zoom dla tier-tekstu (taki sam jak w Label)
      dimmed?: boolean
      onClick?: () => void
      onMouseEnter?: () => void
      onMouseLeave?: () => void
    }) => {
      const { r, haloR, liftOff } = planetGeom(p.baseR, p.state)
      const isSel = p.state === 'selected'
      const isHl = p.state === 'highlighted'
      const haloColor = isHl ? COSMOS.highlight : p.color
      const tierFs = Math.max(7, p.baseR * 0.85) / p.zoomFactor
      return (
        <g
          onMouseEnter={p.onMouseEnter}
          onMouseLeave={p.onMouseLeave}
          style={{ opacity: p.dimmed ? 0.25 : 1, transition: 'opacity 150ms' }}
        >
          {(isSel || isHl) && (
            <circle cx={p.x} cy={p.y} r={haloR}
              fill={haloColor} opacity={0.3} pointerEvents="none" />
          )}
          {/* Lift: ciemniejsza tarcza przesunięta w dół — daje chunky 3D feel */}
          <circle cx={p.x} cy={p.y + liftOff} r={r}
            fill={darken(p.color)} pointerEvents="none" />
          {/* Korpus */}
          <circle cx={p.x} cy={p.y} r={r}
            fill={p.color}
            stroke={isSel || isHl ? COSMOS.label : 'none'} strokeWidth={2}
            style={{ cursor: p.onClick ? 'pointer' : 'default' }}
            onClick={p.onClick ? (e) => { e.stopPropagation(); p.onClick!() } : undefined}
          />
          {p.tier && (
            <text x={p.x} y={p.y + tierFs * 0.35} textAnchor="middle"
              fontSize={tierFs} fill={COSMOS.labelStroke} fontWeight={700}
              pointerEvents="none">
              {p.tier}
            </text>
          )}
        </g>
      )
    }

    // Mini-żeton kontekstu: rounded-square chip à la duolingo. Saturowany kolor + chunky lift (jak Planet).
    const Moon = (p: {
      x: number; y: number
      color: string
      selected?: boolean
      related?: boolean
      title: string
      onClick?: () => void
    }) => {
      const size = p.selected ? MOON.sizeSelected : MOON.size
      const x0 = p.x - size / 2
      const y0 = p.y - size / 2
      return (
        <g>
          {p.related && (
            <rect
              x={p.x - MOON.ringSize / 2} y={p.y - MOON.ringSize / 2}
              width={MOON.ringSize} height={MOON.ringSize}
              rx={MOON.ringRx} ry={MOON.ringRx}
              fill="none" stroke={COSMOS.highlight}
              strokeOpacity={0.55} strokeWidth={1}
              pointerEvents="none" />
          )}
          {/* Lift: ciemniejsza tarcza pod spodem — chunky 3D feel */}
          <rect
            x={x0} y={y0 + MOON.liftOff}
            width={size} height={size}
            rx={MOON.rx} ry={MOON.rx}
            fill={darken(p.color)} pointerEvents="none" />
          {/* Korpus */}
          <rect
            x={x0} y={y0}
            width={size} height={size}
            rx={MOON.rx} ry={MOON.rx}
            fill={p.color}
            stroke={p.selected ? COSMOS.label : 'none'} strokeWidth={1}
            style={{ cursor: p.onClick ? 'pointer' : 'default' }}
            onClick={p.onClick ? (e) => { e.stopPropagation(); p.onClick!() } : undefined}>
            <title>{p.title}</title>
          </rect>
        </g>
      )
    }

    // Sonar/ping: pulsujące ringi rozchodzące się od planety. Animacja CSS @keyframes (GPU).
    const Sonar = (p: { x: number; y: number; r: number; color: string }) => (
      <g transform={`translate(${p.x} ${p.y})`} style={{ pointerEvents: 'none' }}>
        {Array.from({ length: SONAR.rings }, (_, i) => (
          <circle key={i} cx={0} cy={0} r={p.r}
            fill="none" stroke={p.color} strokeWidth={SONAR.strokeWidth}
            style={{
              transformBox: 'fill-box',
              transformOrigin: 'center',
              animation: `bq-sonar ${SONAR.duration}s ease-out ${(i * SONAR.duration / SONAR.rings).toFixed(2)}s infinite`,
              opacity: 0,            // initial — keyframe nadpisuje od 0%
            }} />
        ))}
      </g>
    )

    // Gwiazda centralna: jasny rdzeń + miękka aura.
    const Star = (p: { cx: number; cy: number; coreR?: number; auraR?: number }) => (
      <>
        <circle cx={p.cx} cy={p.cy} r={p.coreR ?? 6} fill={COSMOS.star} />
        <circle cx={p.cx} cy={p.cy} r={p.auraR ?? 14} fill={COSMOS.star} opacity={0.2} />
      </>
    )

    // Orbita: przerywany pierścień + label gałęzi nad zenitem.
    const Orbit = (p: {
      cx: number; cy: number; radius: number
      color: string; label: string
    }) => (
      <>
        <circle cx={p.cx} cy={p.cy} r={p.radius}
          fill="none" stroke={p.color} strokeOpacity={0.35} strokeDasharray="3 5" />
        <Label x={p.cx} y={p.cy - p.radius - 6}
          text={p.label} color={p.color}
          size={9} opacity={0.85} weight={600} uppercase />
      </>
    )

    // Cień rzucony przez planetę na "płaszczyznę orbity" — trapezoid z gradientem zanikającym.
    const CastShadow = (p: {
      id: string                       // unikalne id (do <linearGradient>)
      sunX: number; sunY: number
      planetX: number; planetY: number
      planetR: number
      length?: number                  // długość cienia (default 110)
    }) => {
      const len = p.length ?? 110
      const dx = p.planetX - p.sunX, dy = p.planetY - p.sunY
      const d = Math.hypot(dx, dy) || 1
      const ux = dx / d, uy = dy / d                 // wektor wychodzący od słońca przez planetę
      const px = -uy, py = ux                        // wektor prostopadły (szerokość cienia)
      const w0 = p.planetR * 0.9                     // szerokość przy planecie
      const w1 = p.planetR * 0.45                    // szerokość na końcu (zwęża się)
      const x1 = p.planetX + px * w0,            y1 = p.planetY + py * w0
      const x2 = p.planetX - px * w0,            y2 = p.planetY - py * w0
      const x3 = p.planetX - px * w1 + ux * len, y3 = p.planetY - py * w1 + uy * len
      const x4 = p.planetX + px * w1 + ux * len, y4 = p.planetY + py * w1 + uy * len
      const gradId = `bq-shadow-${p.id}`
      return (
        <>
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse"
            x1={p.planetX} y1={p.planetY}
            x2={p.planetX + ux * len} y2={p.planetY + uy * len}>
            <stop offset="0%"  stopColor="#000" stopOpacity={0.32} />
            <stop offset="100%" stopColor="#000" stopOpacity={0} />
          </linearGradient>
          <polygon
            points={`${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}`}
            fill={`url(#${gradId})`} pointerEvents="none" />
        </>
      )
    }

    // Warstwy używające <Label> MUSZĄ mieć `z` w deps — Label czyta z z closure, memo trzyma stary fs.
    const orbitsLayer = useMemo(() => (
      <>
        {orbits.map(o => (
          <Orbit key={o.key}
            cx={cx} cy={cy} radius={o.radius}
            color={o.color} label={o.label} />
        ))}
      </>
    ), [orbits, cx, cy, z])

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
                color={branchColorByNid.get(toNid) || COSMOS.fallback}
                op={op}
                sw={hasType ? (op > 0.3 ? 2 : 1.5) : (op > 0.3 ? 1.5 : 1)}
                dashed={contextNids.has(fromNid) || contextNids.has(toNid)}
                arrow={hasType ? { targetR: planetRByNid.get(toNid) || 8 } : undefined}
                label={
                  e.data.type && !!neighborSet && isEdgeFocused(fromNid, toNid)
                    ? { text: String(e.data.type), color: COSMOS.edgeLabel }
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
            <Edge key={`hl-${i}-${j}`} a={a} b={b}
              color={COSMOS.highlight} op={0.55} sw={1.5} />
          )
        }
      }
      return <>{lines}</>
    }, [selectedLexId, highlightedNids, positions])

    const shadowsLayer = useMemo(() => (
      <>
        {nodes.map(n => {
          const nid = String(n.data.nodeId)
          const p = positions.get(nid); if (!p) return null
          return (
            <CastShadow key={n.id}
              id={nid}
              sunX={cx} sunY={cy}
              planetX={p.x} planetY={p.y}
              planetR={planetRadius(slidesByNodeId.get(n.id) || 0)}
            />
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
          const color = branchColorByNid.get(nid) || COSMOS.fallback
          const isSel = selectedNid === nid
          const isHl = highlightedNids.has(nid)
          const state: PlanetState = isSel ? 'selected' : isHl ? 'highlighted' : 'idle'
          const lexs = lexsByNid.get(nid) || []
          const baseR = planetRadius(slidesByNodeId.get(n.id) || 0)
          const moonOrbitR = planetGeom(baseR, state).moonOrbitR
          return (
            <React.Fragment key={n.id}>
              <Planet
                x={p.x} y={p.y}
                color={color}
                baseR={baseR}
                state={state}
                tier={String(n.data.tier ?? '') || undefined}
                zoomFactor={z}
                dimmed={isNodeDimmed(nid)}
                onMouseEnter={() => setHoverIfIdle(nid)}
                onMouseLeave={() => setHoverIfIdle(null)}
                onClick={() => selectByNid(treeId, nid)}
              />
              {lexs.map((lex, i) => {
                const ang = (i / Math.max(lexs.length, 1)) * Math.PI * 2
                return (
                  <Moon key={lex.id}
                    x={p.x + Math.cos(ang) * moonOrbitR}
                    y={p.y + Math.sin(ang) * moonOrbitR}
                    color={catColor(String(lex.data.category || ''))}
                    selected={selectedLexId === lex.id}
                    related={relatedLexIds.has(lex.id)}
                    title={`${String(lex.data.term)} · ${String(lex.data.category || 'inne')}`}
                    onClick={() => selectByLex(lex.id)}
                  />
                )
              })}
            </React.Fragment>
          )
        })}
      </>
      )
    }, [nodes, positions, lexsByNid, slidesByNodeId, selectedNid, selectedLexId, relatedLexIds, highlightedNids, treeId, neighborSet, z, branchColorByNid])

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
            const baseR = planetRadius(slidesByNodeId.get(n.id) || 0)
            return (
              <Label key={n.id}
                x={p.x} y={p.y + baseR + 14}
                text={String(n.data.title)} color={COSMOS.label}
                size={10} opacity={op} weight={500} />
            )
          })}
        </>
      )
    }, [nodes, positions, slidesByNodeId, selectedNid, highlightedNids, hovered, zoomK])

    // Sonar tylko dla zaznaczonej planety. Memo na selectedNid + position (śledzi planetę podczas osiadania sim).
    const sonarLayer = useMemo(() => {
      if (!selectedNid) return null
      const p = positions.get(selectedNid); if (!p) return null
      const baseR = planetRByNid.get(selectedNid) || 8
      const { r } = planetGeom(baseR, 'selected')   // outer r ze stanu selected
      const color = branchColorByNid.get(selectedNid) || COSMOS.fallback
      return <Sonar x={p.x} y={p.y} r={r} color={color} />
    }, [selectedNid, positions, planetRByNid, branchColorByNid])

    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <svg ref={svgRef} viewBox="0 0 600 600" preserveAspectRatio="xMidYMid meet"
          style={{ display: 'block', width: '100%', height: '100%', background: `radial-gradient(ellipse at center, ${COSMOS.bgFrom} 0%, ${COSMOS.bgTo} 100%)`, borderRadius: 8, cursor: panning ? 'grabbing' : 'grab', userSelect: 'none' }}
          onClick={onBackgroundClick}>
          <defs>
            <style>{`@keyframes bq-sonar { 0% { transform: scale(${SONAR.scaleFrom}); opacity: ${SONAR.opacityFrom}; } 100% { transform: scale(${SONAR.scaleTo}); opacity: 0; } }`}</style>
          </defs>
          <g ref={gRef}>
            {orbitsLayer}
            <Star cx={cx} cy={cy} />
            {contextLayer}
            {edgesLayer}
            {highlightLines}
            {shadowsLayer}
            {sonarLayer}
            {planetsLayer}
            {labelsLayer}
          </g>
        </svg>

        {/* HUD: zoom + reset (absolutny overlay nad SVG — nie da się tego zrobić ui.* bez nowej prymityw "FloatingPanel") */}
        <div style={{ position: 'absolute', top: 8, right: 8, background: COSMOS.hudBg, padding: '4px 8px', borderRadius: 6, color: COSMOS.hud }}>
          <ui.Row>
            <ui.Text size="xs">{Math.round(zoomK * 100)}%</ui.Text>
            <ui.Button size="xs" color="ghost" outline onClick={reset}>
              <Maximize2 size={12} /> Reset
            </ui.Button>
          </ui.Row>
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
