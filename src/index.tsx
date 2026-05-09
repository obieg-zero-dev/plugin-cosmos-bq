import type { PluginFactory, PostRecord } from '@obieg-zero/sdk'
import { CosmosGraph, COSMOS_TOKENS } from '@obieg-zero/cosmos-graph'
import { useBqGraphData } from '@obieg-zero/bq-cosmos'

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

  // Slug stabilny dla nodeId — diakrytyki PL → ascii.
  const slugify = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
     .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || String(Date.now())

  const selectByNid = (treeId: string, nid: string) => {
    const node = (store.getPosts('node') as PostRecord[])
      .find(n => n.parentId === treeId && String(n.data.nodeId) === nid)
    useNav.setState({ selectedNid: nid, selectedLexId: null })
    if (node) sdk.shared.setState({ bq: { treeId, nodeId: nid, postId: node.id } })
  }
  const selectByLex = (lexId: string) =>
    useNav.setState({ selectedLexId: lexId, selectedNid: null })

  const branchOf = (n: PostRecord) => String(n.data.branch || '') || NO_BRANCH

  const Dot = ({ color }: { color: string }) => (
    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: color, marginRight: 6 }} />
  )

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

  // Inline edit z auto-save na blur. Lokalny state żeby nie tracić cursor podczas re-renderu.
  function EditField({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
    const [v, setV] = useState(value)
    useEffect(() => { setV(value) }, [value])
    return (
      <ui.Field label={label}>
        <ui.Input value={v}
          onChange={(e: { target: { value: string } }) => setV(e.target.value)}
          onBlur={() => { if (v !== value) onSave(v) }} />
      </ui.Field>
    )
  }

  function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
    const [v, setV] = useState('')
    const submit = () => { const t = v.trim(); if (!t) return; onAdd(t); setV('') }
    return (
      <ui.Row>
        <ui.Input value={v} placeholder={placeholder}
          onChange={(e: { target: { value: string } }) => setV(e.target.value)}
          onKeyDown={(e: { key: string }) => { if (e.key === 'Enter') submit() }} />
        <ui.Button size="xs" onClick={submit}>Dodaj</ui.Button>
      </ui.Row>
    )
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

    const addNode = (branchKey: string, title: string) => {
      if (!treeId) return
      const nid = slugify(title)
      const tier = nodes.filter(n => branchOf(n) === branchKey).length + 1
      store.add('node',
        { nodeId: nid, title, branch: branchKey === NO_BRANCH ? '' : branchKey, tier, hits: 0 },
        { parentId: treeId })
      selectByNid(treeId, nid)
    }

    if (trees.length === 0) {
      return (
        <ui.Box header={<ui.Cell label>Kosmos BQ</ui.Cell>}
          body={<ui.Placeholder text="Brak drzew. Wczytaj paczkę w pluginie BrainQuest." />} />
      )
    }

    return (
      <ui.Box
        header={<ui.Cell label>Kosmos BQ</ui.Cell>}
        body={
          <ui.Stack>
            <ui.Field label="Drzewo">
              <ui.Select value={treeId || ''}
                options={trees.map(t => ({ value: t.id, label: String(t.data.title) }))}
                onChange={(e: { target: { value: string } }) =>
                  useNav.setState({ treeId: e.target.value, selectedNid: null })} />
            </ui.Field>

            <ui.Text muted size="xs">{nodes.length} węzłów · {groups.length} gałęzi</ui.Text>

            {groups.map(g => (
              <React.Fragment key={g.key}>
                <ui.Cell label><Dot color={g.color} />{g.label}</ui.Cell>
                {g.nodes.map(n => {
                  const nid = String(n.data.nodeId)
                  return (
                    <ui.ListItem key={n.id}
                      active={selectedNid === nid}
                      label={String(n.data.title)}
                      onClick={() => selectByNid(treeId!, nid)}
                      action={<ui.RemoveButton onClick={() => {
                        if (!confirm(`Usunąć węzeł „${n.data.title}"?`)) return
                        store.remove(n.id)
                        if (selectedNid === nid) useNav.setState({ selectedNid: null })
                      }} />} />
                  )
                })}
                <AddRow placeholder={`+ węzeł w „${g.label}"`} onAdd={(t) => addNode(g.key, t)} />
              </React.Fragment>
            ))}
          </ui.Stack>
        }
      />
    )
  }

  function GraphView() {
    const { treeId, selectedNid, selectedLexId } = useNav()
    const data = useBqGraphData(store, treeId, { selectedMoonId: selectedLexId })
    if (data.rawNodes.length === 0) return <ui.Placeholder text="Drzewo nie ma węzłów" />
    return <CosmosGraph
      nodes={data.nodes} moons={data.moons} edges={data.edges}
      branches={data.branches} relTypes={data.relTypes}
      selectedNid={selectedNid} selectedMoonId={selectedLexId}
      highlightedNids={data.highlightedNids} relatedMoonIds={data.relatedMoonIds}
      onSelectNode={(nid) => selectByNid(treeId!, nid)}
      onSelectMoon={selectByLex}
      onDeselect={() => useNav.setState({ selectedNid: null, selectedLexId: null })}
      contextBranchPrefix={CONTEXT_BRANCH_PREFIX}
      placeholder={<ui.Placeholder text="Drzewo nie ma węzłów" />} />
  }

  function CenterPanel() { return <ui.Page><GraphView /></ui.Page> }

  function NodeEditor({ node, treeId }: { node: PostRecord; treeId: string }) {
    const nid = String(node.data.nodeId)
    const branches  = store.useChildren(treeId, 'branch')  as PostRecord[]
    const relTypes  = store.useChildren(treeId, 'relType') as PostRecord[]
    const allNodes  = store.useChildren(treeId, 'node')    as PostRecord[]
    const allLexs   = store.useChildren(treeId, 'lexicon') as PostRecord[]
    const allEdges  = store.useChildren(treeId, 'edge')    as PostRecord[]
    const allLexNodes = store.usePosts('lexNode') as PostRecord[]

    const myLexs = useMemo(() => {
      const lexIds = new Set<string>()
      for (const ln of allLexNodes) if (String(ln.data.nid) === nid) lexIds.add(ln.parentId)
      return allLexs.filter(l => lexIds.has(l.id))
    }, [allLexNodes, allLexs, nid])
    const lexNodeFor = (lexId: string) =>
      allLexNodes.find(ln => ln.parentId === lexId && String(ln.data.nid) === nid)

    const out = allEdges.filter(e => e.data.fromNid === nid)
    const inc = allEdges.filter(e => e.data.toNid   === nid)
    const titleOf = (n: string) =>
      String(allNodes.find(x => String(x.data.nodeId) === n)?.data.title ?? n)

    const branchOpts = [
      { value: '', label: '— bez gałęzi —' },
      ...branches.map(b => ({ value: String(b.data.key), label: String(b.data.label) })),
    ]
    const relOpts = relTypes.map(r => ({ value: String(r.data.key), label: String(r.data.label) }))
    const nodeOpts = allNodes
      .filter(n => String(n.data.nodeId) !== nid)
      .map(n => ({ value: String(n.data.nodeId), label: String(n.data.title) }))

    const [edgeTo, setEdgeTo] = useState('')
    const [edgeType, setEdgeType] = useState('')
    useEffect(() => { if (!edgeType && relOpts[0]) setEdgeType(relOpts[0].value) }, [relOpts.length])

    const addTerm = (term: string) => {
      const lex = store.add('lexicon', { term, definition: '', category: '' }, { parentId: treeId })
      store.add('lexNode', { nid }, { parentId: lex.id })
    }
    const unlinkTerm = (lexId: string) => {
      const ln = lexNodeFor(lexId)
      if (ln) store.remove(ln.id)
    }
    const addEdge = () => {
      if (!edgeTo || !edgeType) return
      store.add('edge', { fromNid: nid, toNid: edgeTo, type: edgeType }, { parentId: treeId })
      setEdgeTo('')
    }

    return (
      <ui.Stack>
        <EditField label="Tytuł" value={String(node.data.title)}
          onSave={(v) => store.update(node.id, { title: v })} />
        <ui.Field label="Gałąź">
          <ui.Select value={String(node.data.branch || '')} options={branchOpts}
            onChange={(e: { target: { value: string } }) =>
              store.update(node.id, { branch: e.target.value })} />
        </ui.Field>
        <EditField label="Tier" value={String(node.data.tier ?? '')}
          onSave={(v) => store.update(node.id, { tier: v })} />
        <ui.Text size="xs" muted>id: {nid}</ui.Text>

        <ui.Divider />

        <ui.Cell label>Terminy ({myLexs.length})</ui.Cell>
        {myLexs.map(l => (
          <ui.ListItem key={l.id}
            label={String(l.data.term)}
            detail={String(l.data.definition || '').slice(0, 60)}
            onClick={() => selectByLex(l.id)}
            action={<ui.RemoveButton onClick={() => unlinkTerm(l.id)} />} />
        ))}
        <AddRow placeholder="+ termin" onAdd={addTerm} />

        <ui.Divider />

        <ui.Cell label>Wychodzące ({out.length})</ui.Cell>
        {out.map(e => (
          <ui.ListItem key={e.id}
            label={titleOf(String(e.data.toNid))}
            detail={String(e.data.type || '')}
            onClick={() => selectByNid(treeId, String(e.data.toNid))}
            action={<ui.RemoveButton onClick={() => store.remove(e.id)} />} />
        ))}
        <ui.Row>
          <ui.Select value={edgeTo} options={[{ value: '', label: '— cel —' }, ...nodeOpts]}
            onChange={(e: { target: { value: string } }) => setEdgeTo(e.target.value)} />
          <ui.Select value={edgeType} options={relOpts}
            onChange={(e: { target: { value: string } }) => setEdgeType(e.target.value)} />
          <ui.Button size="xs" onClick={addEdge}>Dodaj</ui.Button>
        </ui.Row>

        <ui.Divider />

        <ui.Cell label>Przychodzące ({inc.length})</ui.Cell>
        {inc.map(e => (
          <ui.ListItem key={e.id}
            label={titleOf(String(e.data.fromNid))}
            detail={String(e.data.type || '')}
            onClick={() => selectByNid(treeId, String(e.data.fromNid))} />
        ))}
      </ui.Stack>
    )
  }

  function LexEditor({ lex, treeId }: { lex: PostRecord; treeId: string }) {
    const nodes = store.useChildren(treeId, 'node') as PostRecord[]
    const allLexNodes = store.usePosts('lexNode') as PostRecord[]

    const myNidSet = useMemo(() => {
      const s = new Set<string>()
      for (const ln of allLexNodes) if (ln.parentId === lex.id) s.add(String(ln.data.nid))
      return s
    }, [allLexNodes, lex.id])
    const containing = nodes.filter(n => myNidSet.has(String(n.data.nodeId)))
    const lexNodeFor = (nid: string) =>
      allLexNodes.find(ln => ln.parentId === lex.id && String(ln.data.nid) === nid)
    const nodeOpts = nodes
      .filter(n => !myNidSet.has(String(n.data.nodeId)))
      .map(n => ({ value: String(n.data.nodeId), label: String(n.data.title) }))

    const [linkNid, setLinkNid] = useState('')
    const addLink = () => {
      if (!linkNid) return
      store.add('lexNode', { nid: linkNid }, { parentId: lex.id })
      setLinkNid('')
    }
    const removeLink = (nid: string) => {
      const ln = lexNodeFor(nid)
      if (ln) store.remove(ln.id)
    }
    const removeLex = () => {
      if (!confirm(`Usunąć termin „${lex.data.term}"?`)) return
      store.remove(lex.id)
      useNav.setState({ selectedLexId: null })
    }

    return (
      <ui.Stack>
        <EditField label="Termin" value={String(lex.data.term)}
          onSave={(v) => store.update(lex.id, { term: v })} />
        <EditField label="Definicja" value={String(lex.data.definition || '')}
          onSave={(v) => store.update(lex.id, { definition: v })} />
        <EditField label="Kategoria" value={String(lex.data.category || '')}
          onSave={(v) => store.update(lex.id, { category: v })} />
        <ui.Row><ui.Button size="xs" outline onClick={removeLex}>Usuń termin</ui.Button></ui.Row>

        <ui.Divider />

        <ui.Cell label>Występuje w ({containing.length})</ui.Cell>
        {containing.map(n => (
          <ui.ListItem key={n.id}
            label={String(n.data.title)}
            detail={String(n.data.branch || '')}
            onClick={() => selectByNid(treeId, String(n.data.nodeId))}
            action={<ui.RemoveButton onClick={() => removeLink(String(n.data.nodeId))} />} />
        ))}
        <ui.Row>
          <ui.Select value={linkNid} options={[{ value: '', label: '— węzeł —' }, ...nodeOpts]}
            onChange={(e: { target: { value: string } }) => setLinkNid(e.target.value)} />
          <ui.Button size="xs" onClick={addLink}>Powiąż</ui.Button>
        </ui.Row>
      </ui.Stack>
    )
  }

  function RightPanel() {
    const { treeId, selectedNid, selectedLexId } = useNav()
    const nodes    = store.useChildren(treeId || '', 'node')    as PostRecord[]
    const lexicons = store.useChildren(treeId || '', 'lexicon') as PostRecord[]

    if (!treeId) return <ui.Placeholder text="Wybierz drzewo" />

    if (selectedLexId) {
      const lex = lexicons.find(l => l.id === selectedLexId)
      if (!lex) return <ui.Placeholder text="Termin nie istnieje" />
      return <ui.Page><LexEditor lex={lex} treeId={treeId} /></ui.Page>
    }

    const node = selectedNid ? nodes.find(n => String(n.data.nodeId) === selectedNid) : undefined
    if (!node) return <ui.Placeholder text="Wybierz węzeł lub termin" />

    return <ui.Page><NodeEditor node={node} treeId={treeId} /></ui.Page>
  }

  sdk.registerView('cosmos.left',   { slot: 'left',   component: LeftPanel })
  sdk.registerView('cosmos.center', { slot: 'center', component: CenterPanel })
  sdk.registerView('cosmos.right',  { slot: 'right',  component: RightPanel })

  return {
    id: 'cosmos-bq',
    label: 'Kosmos BQ',
    description: 'Edytor grafu BQ — orbity gałęzi + księżyce terminów. Edycja danych w sidebarach (renderer: @obieg-zero/cosmos-graph)',
    icon: Share2 || GitBranch,
    version: '0.7.0',
  }
}

export default plugin
