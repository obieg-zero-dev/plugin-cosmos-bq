import type { PluginFactory, PostRecord } from '@obieg-zero/sdk'

const plugin: PluginFactory = ({ React, ui, store, sdk, icons }) => {
  const { useMemo, useEffect } = React
  const { Plus, Link2, Share2, GitBranch } = icons

  // Używamy typów BQ: 'tree' (root), 'node' (parent: tree), 'edge' (parent: tree).
  // Nie rejestrujemy własnych — plugin BrainQuest robi to pierwszy.

  type Mode = 'browse' | 'add-node' | 'edit-node' | 'add-edge'
  const useNav = sdk.create(() => ({
    treeId: null as string | null,
    selectedNid: null as string | null,  // node.data.nodeId (string)
    mode: 'browse' as Mode,
  }))

  const goBrowse = () => useNav.setState({ mode: 'browse' })

  // Wybór węzła synchronizujemy z sdk.shared.bq — żeby reader/arena widziały to samo
  const selectByNid = (treeId: string, nid: string) => {
    const node = (store.getPosts('node') as PostRecord[])
      .find(n => n.parentId === treeId && String(n.data.nodeId) === nid)
    useNav.setState({ selectedNid: nid, mode: 'browse' })
    if (node) sdk.shared.setState({ bq: { treeId, nodeId: nid, postId: node.id } })
  }

  // ── Lewy panel: wybór drzewa + lista węzłów ───────────────────────
  function LeftPanel() {
    const trees = store.usePosts('tree') as PostRecord[]
    const { treeId, selectedNid, mode } = useNav()
    const nodes = store.useChildren(treeId || '', 'node') as PostRecord[]
    const sharedTreeId = sdk.shared(s => (s as any)?.bq?.treeId) as string | undefined

    // Auto-wybór: shared.bq.treeId → pierwsze drzewo
    useEffect(() => {
      if (treeId) return
      const initial = (sharedTreeId && trees.some(t => t.id === sharedTreeId))
        ? sharedTreeId
        : trees[0]?.id
      if (initial) useNav.setState({ treeId: initial })
    }, [trees.length, sharedTreeId])

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
                  useNav.setState({ treeId: e.target.value, selectedNid: null, mode: 'browse' })}
              />
            </ui.Field>

            <ui.Row>
              <ui.Button size="xs" color="primary" disabled={!treeId}
                onClick={() => useNav.setState({ mode: 'add-node', selectedNid: null })}>
                <Plus size={12} /> Węzeł
              </ui.Button>
              <ui.Button size="xs" color="ghost" disabled={nodes.length < 2}
                onClick={() => useNav.setState({ mode: 'add-edge' })}>
                <Link2 size={12} /> Krawędź
              </ui.Button>
            </ui.Row>

            <ui.Text muted size="xs">{nodes.length} węzłów</ui.Text>

            {nodes.map(n => {
              const nid = String(n.data.nodeId)
              return (
                <ui.ListItem key={n.id}
                  active={selectedNid === nid && mode === 'browse'}
                  label={String(n.data.title)}
                  detail={`#${nid}${n.data.branch ? ' · ' + n.data.branch : ''}`}
                  onClick={() => selectByNid(treeId!, nid)}
                />
              )
            })}
          </ui.Stack>
        }
      />
    )
  }

  // ── Formularz węzła ───────────────────────────────────────────────
  function NodeForm({ node }: { node?: PostRecord }) {
    const { treeId } = useNav()
    const editing = !!node
    const branches = store.useChildren(treeId || '', 'branch') as PostRecord[]
    const branchOpts = [
      { value: '', label: '— bez gałęzi —' },
      ...branches.map(b => ({ value: String(b.data.key), label: String(b.data.label) })),
    ]

    const { bind, submit } = sdk.useForm(
      {
        nodeId: editing ? String(node!.data.nodeId) : '',
        title:  editing ? String(node!.data.title)  : '',
        branch: editing ? String(node!.data.branch || '') : '',
        tier:   editing ? String(node!.data.tier || '')   : '',
      },
      {
        isComplete: (d: any) => !!String(d.nodeId || '').trim() && !!String(d.title || '').trim(),
        onSubmit: (d: any) => {
          const data = {
            nodeId: String(d.nodeId).trim(),
            title:  String(d.title).trim(),
            branch: String(d.branch || '').trim(),
            tier:   String(d.tier || '').trim(),
          }
          if (editing) store.update(node!.id, data)
          else if (treeId) {
            const created = store.add('node', data, { parentId: treeId })
            useNav.setState({ selectedNid: data.nodeId })
            sdk.shared.setState({ bq: { treeId, nodeId: data.nodeId, postId: created.id } })
          }
          sdk.log(editing ? 'Węzeł zaktualizowany' : 'Węzeł dodany', 'ok')
          goBrowse()
        },
      },
    )

    const remove = () => {
      if (!node) return
      store.remove(node.id)
      useNav.setState({ selectedNid: null, mode: 'browse' })
      sdk.log('Węzeł usunięty', 'ok')
    }

    return (
      <ui.Page>
        <ui.Stack>
          <ui.Heading title={editing ? 'Edytuj węzeł' : 'Nowy węzeł'} subtitle="Pola BQ" />
          <ui.Card>
            <ui.Stack gap="md">
              <ui.Field label="ID węzła (klucz w grafie)" required>
                <ui.Input placeholder="np. demokracja_ateny" {...bind('nodeId')} />
              </ui.Field>
              <ui.Field label="Tytuł" required>
                <ui.Input {...bind('title')} />
              </ui.Field>
              <ui.Field label="Gałąź">
                <ui.Select options={branchOpts} {...bind('branch')} />
              </ui.Field>
              <ui.Field label="Poziom (1–3)">
                <ui.Input {...bind('tier')} />
              </ui.Field>
            </ui.Stack>
          </ui.Card>
          <ui.Row justify="between">
            {editing
              ? <ui.Button color="error" outline onClick={remove}>Usuń</ui.Button>
              : <span />}
            <ui.Row>
              <ui.Button color="ghost" outline onClick={goBrowse}>Anuluj</ui.Button>
              <ui.Button color="primary" onClick={submit}>Zapisz</ui.Button>
            </ui.Row>
          </ui.Row>
        </ui.Stack>
      </ui.Page>
    )
  }

  // ── Formularz krawędzi ────────────────────────────────────────────
  function EdgeForm() {
    const { treeId } = useNav()
    const nodes    = store.useChildren(treeId || '', 'node') as PostRecord[]
    const relTypes = store.useChildren(treeId || '', 'relType') as PostRecord[]

    const nodeOpts = [
      { value: '', label: '— wybierz —' },
      ...nodes.map(n => ({ value: String(n.data.nodeId), label: String(n.data.title) })),
    ]
    const typeOpts = [
      { value: '', label: '— bez typu —' },
      ...relTypes.map(r => ({ value: String(r.data.key), label: String(r.data.label) })),
    ]

    const { bind, submit } = sdk.useForm(
      { fromNid: '', toNid: '', type: '' },
      {
        isComplete: (d: any) => !!d.fromNid && !!d.toNid && d.fromNid !== d.toNid,
        onSubmit: (d: any) => {
          if (treeId) store.add('edge', { fromNid: d.fromNid, toNid: d.toNid, type: String(d.type || '') }, { parentId: treeId })
          sdk.log('Krawędź dodana', 'ok')
          goBrowse()
        },
      },
    )

    return (
      <ui.Page>
        <ui.Stack>
          <ui.Heading title="Nowa krawędź" subtitle="Skierowana: Z → Do" />
          <ui.Card>
            <ui.Stack gap="md">
              <ui.Field label="Z" required><ui.Select options={nodeOpts} {...bind('fromNid')} /></ui.Field>
              <ui.Field label="Do" required><ui.Select options={nodeOpts} {...bind('toNid')} /></ui.Field>
              <ui.Field label="Typ relacji"><ui.Select options={typeOpts} {...bind('type')} /></ui.Field>
            </ui.Stack>
          </ui.Card>
          <ui.Row justify="end">
            <ui.Button color="ghost" outline onClick={goBrowse}>Anuluj</ui.Button>
            <ui.Button color="primary" onClick={submit}>Dodaj</ui.Button>
          </ui.Row>
        </ui.Stack>
      </ui.Page>
    )
  }

  // ── Widok GRAFU: kosmiczny model — każda gałąź = własna orbita ────
  const COLOR_MAP: Record<string, string> = {
    primary:  '#4a90e2', secondary: '#9b59b6', accent: '#e91e63',
    info:     '#00bcd4', success:   '#22c55e', warning: '#f59e0b',
    error:    '#ef4444', neutral:   '#94a3b8',
  }
  const PALETTE = ['#4a90e2', '#e91e63', '#22c55e', '#f59e0b', '#9b59b6', '#00bcd4', '#ef4444', '#94a3b8']

  function GraphView() {
    const { treeId, selectedNid } = useNav()
    const nodes    = store.useChildren(treeId || '', 'node') as PostRecord[]
    const edges    = store.useChildren(treeId || '', 'edge') as PostRecord[]
    const branches = store.useChildren(treeId || '', 'branch') as PostRecord[]

    const cx = 300, cy = 300

    const { positions, orbits } = useMemo(() => {
      const rMin = 70, rMax = 270
      const branchByKey = new Map(branches.map(b => [String(b.data.key), b]))

      // Tylko gałęzie faktycznie używane przez węzły (+ ewentualnie '_none')
      const usedKeys: string[] = []
      const seen = new Set<string>()
      for (const b of branches) {
        const k = String(b.data.key)
        if (!seen.has(k) && nodes.some(n => String(n.data.branch || '') === k)) {
          usedKeys.push(k); seen.add(k)
        }
      }
      if (nodes.some(n => !String(n.data.branch || ''))) usedKeys.push('_none')

      const N = Math.max(usedKeys.length, 1)
      const step = N > 1 ? (rMax - rMin) / (N - 1) : 0

      const orbits = usedKeys.map((k, i) => {
        const b = branchByKey.get(k)
        const colorKey = b ? String(b.data.color || '') : ''
        return {
          key: k,
          label: b ? String(b.data.label) : 'bez gałęzi',
          color: COLOR_MAP[colorKey] || PALETTE[i % PALETTE.length],
          radius: N > 1 ? rMin + i * step : (rMin + rMax) / 2,
        }
      })

      const positions = new Map<string, { x: number; y: number; color: string }>()
      for (const orbit of orbits) {
        const onOrbit = nodes.filter(n =>
          (String(n.data.branch || '') || '_none') === orbit.key,
        )
        onOrbit.forEach((n, j) => {
          const a = (j / Math.max(onOrbit.length, 1)) * Math.PI * 2 - Math.PI / 2
          positions.set(String(n.data.nodeId), {
            x: cx + Math.cos(a) * orbit.radius,
            y: cy + Math.sin(a) * orbit.radius,
            color: orbit.color,
          })
        })
      }

      return { positions, orbits }
    }, [nodes, branches])

    if (nodes.length === 0) return <ui.Placeholder text="Drzewo nie ma węzłów" />

    return (
      <svg viewBox="0 0 600 600"
        style={{ width: '100%', height: 600, background: 'radial-gradient(ellipse at center, #1a2440 0%, #0a0e1a 100%)', borderRadius: 8 }}>

        {/* orbity */}
        {orbits.map(o => (
          <circle key={'orbit-' + o.key} cx={cx} cy={cy} r={o.radius}
            fill="none" stroke={o.color} strokeOpacity={0.35} strokeDasharray="3 5" />
        ))}

        {/* etykiety orbit */}
        {orbits.map(o => (
          <text key={'orbit-l-' + o.key} x={cx} y={cy - o.radius - 6}
            textAnchor="middle" fontSize={10} fill={o.color} opacity={0.85}>
            {o.label}
          </text>
        ))}

        {/* słońce */}
        <circle cx={cx} cy={cy} r={6} fill="#fde68a" />
        <circle cx={cx} cy={cy} r={14} fill="#fde68a" opacity={0.2} />

        {/* krawędzie */}
        {edges.map(e => {
          const a = positions.get(String(e.data.fromNid))
          const b = positions.get(String(e.data.toNid))
          if (!a || !b) return null
          return (
            <g key={e.id}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="#fff" strokeOpacity={0.25} strokeWidth={1} />
              {e.data.type && (
                <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4}
                  fontSize={9} fill="#cbd5e1" textAnchor="middle" opacity={0.7}>
                  {String(e.data.type)}
                </text>
              )}
            </g>
          )
        })}

        {/* planety + tytuły */}
        {nodes.map(n => {
          const nid = String(n.data.nodeId)
          const p = positions.get(nid); if (!p) return null
          const isSel = selectedNid === nid
          return (
            <g key={n.id} style={{ cursor: 'pointer' }} onClick={() => selectByNid(treeId, nid)}>
              {isSel && <circle cx={p.x} cy={p.y} r={22} fill={p.color} opacity={0.3} />}
              <circle cx={p.x} cy={p.y} r={isSel ? 14 : 10}
                fill={p.color} stroke={isSel ? '#fff' : 'none'} strokeWidth={2} />
              <text x={p.x} y={p.y + 26} textAnchor="middle"
                fontSize={10} fill="#fff" opacity={isSel ? 1 : 0.85}>
                {String(n.data.title)}
              </text>
            </g>
          )
        })}
      </svg>
    )
  }

  // ── Centrum: formularze LUB widok kosmosu ─────────────────────────
  function CenterPanel() {
    const { treeId, mode, selectedNid } = useNav()
    const nodes = store.useChildren(treeId || '', 'node') as PostRecord[]

    if (mode === 'add-node') return <NodeForm />
    if (mode === 'edit-node' && selectedNid) {
      const node = nodes.find(n => String(n.data.nodeId) === selectedNid)
      if (node) return <NodeForm node={node} />
    }
    if (mode === 'add-edge') return <EdgeForm />

    return <ui.Page><GraphView /></ui.Page>
  }

  // ── Prawy panel: szczegóły wybranego węzła + jego krawędzie ───────
  function RightPanel() {
    const { treeId, selectedNid, mode } = useNav()
    const nodes = store.useChildren(treeId || '', 'node') as PostRecord[]
    const edges = store.useChildren(treeId || '', 'edge') as PostRecord[]
    const node = nodes.find(n => String(n.data.nodeId) === selectedNid)

    if (!node || mode !== 'browse') return <ui.Placeholder text="Wybierz węzeł" />

    const titleOf = (nid: string) =>
      String(nodes.find(n => String(n.data.nodeId) === nid)?.data.title ?? nid)
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

          <ui.Row>
            <ui.Button size="xs" color="primary"
              onClick={() => useNav.setState({ mode: 'edit-node' })}>Edytuj</ui.Button>
          </ui.Row>

          <ui.Divider />

          <ui.Cell label>Wychodzące ({out.length})</ui.Cell>
          {out.length === 0 && <ui.Text muted size="xs">brak</ui.Text>}
          {out.map(e => (
            <ui.ListItem key={e.id}
              label={titleOf(String(e.data.toNid))}
              detail={e.data.type ? String(e.data.type) : undefined}
              action={<ui.RemoveButton onClick={() => store.remove(e.id)} />}
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
              action={<ui.RemoveButton onClick={() => store.remove(e.id)} />}
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
    description: 'Kosmiczny widok grafu BQ — każda gałąź na własnej orbicie',
    icon: Share2 || GitBranch,
    version: '0.3.0',
  }
}

export default plugin
