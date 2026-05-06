import type { PluginFactory, PostRecord } from '@obieg-zero/sdk'
import { CosmosGraph, COSMOS_TOKENS } from '@obieg-zero/cosmos-graph'
import { useBqGraphData, catColor } from '@obieg-zero/bq-cosmos'

const plugin: PluginFactory = ({ React, ui, store, sdk, icons }) => {
  const { useMemo, useEffect, useState } = React
  const { Share2, GitBranch } = icons

  const NO_BRANCH = '_none'
  const CONTEXT_BRANCH_PREFIX = 'kontekst'
  const { tok, PALETTE } = COSMOS_TOKENS

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

  const Dot = ({ color }: { color: string }) => (
    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: color, marginRight: 6 }} />
  )

  const branchOf = (n: PostRecord) => String(n.data.branch || '') || NO_BRANCH

  // Lista gałęzi widocznych w drzewie + ich kolory (do listy w LeftPanel).
  const usedBranchInfos = (nodes: PostRecord[], branches: PostRecord[]) => {
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
      }
    })
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

  // GraphView — używa wspólnego adapter'a @obieg-zero/bq-cosmos. Bez gating (reader mode: wszystko widoczne).
  function GraphView() {
    const { treeId, selectedNid, selectedLexId } = useNav()
    const data = useBqGraphData(store, treeId, { selectedMoonId: selectedLexId })

    if (data.rawNodes.length === 0) return <ui.Placeholder text="Drzewo nie ma węzłów" />

    return <CosmosGraph
      nodes={data.nodes}
      moons={data.moons}
      edges={data.edges}
      contextEdges={data.contextEdges}
      branches={data.branches}
      relTypes={data.relTypes}
      selectedNid={selectedNid}
      selectedMoonId={selectedLexId}
      highlightedNids={data.highlightedNids}
      relatedMoonIds={data.relatedMoonIds}
      onSelectNode={(nid) => selectByNid(treeId!, nid)}
      onSelectMoon={selectByLex}
      onDeselect={() => useNav.setState({ selectedNid: null, selectedLexId: null })}
      contextBranchPrefix={CONTEXT_BRANCH_PREFIX}
      placeholder={<ui.Placeholder text="Drzewo nie ma węzłów" />}
      quiet
    />
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
    description: 'Kosmiczny widok grafu BQ — orbity gałęzi + księżyce terminów (renderer: @obieg-zero/cosmos-graph)',
    icon: Share2 || GitBranch,
    version: '0.6.0',
  }
}

export default plugin
