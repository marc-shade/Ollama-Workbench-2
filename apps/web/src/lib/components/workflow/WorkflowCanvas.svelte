<script lang="ts">
	import { writable } from 'svelte/store';
	import {
		SvelteFlow,
		Controls,
		Background,
		MiniMap,
		type Node,
		type Edge,
		type NodeTypes
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';

	import AgentNode from './AgentNode.svelte';
	import ToolNode from './ToolNode.svelte';
	import InputNode from './InputNode.svelte';
	import OutputNode from './OutputNode.svelte';

	interface Props {
		initialNodes?: Node[];
		initialEdges?: Edge[];
		onNodesChange?: (nodes: Node[]) => void;
		onEdgesChange?: (edges: Edge[]) => void;
	}

	let {
		initialNodes = [],
		initialEdges = [],
		onNodesChange,
		onEdgesChange
	}: Props = $props();

	// Ensure nodes and edges are always arrays (defensive against undefined props)
	const nodes = writable<Node[]>(initialNodes ?? []);
	const edges = writable<Edge[]>(initialEdges ?? []);

	const nodeTypes: NodeTypes = {
		agent: AgentNode,
		tool: ToolNode,
		input: InputNode,
		output: OutputNode
	};

	// Subscribe to changes
	$effect(() => {
		const unsubNodes = nodes.subscribe((n) => onNodesChange?.(n));
		const unsubEdges = edges.subscribe((e) => onEdgesChange?.(e));
		return () => {
			unsubNodes();
			unsubEdges();
		};
	});

	// Add node function (exposed for parent)
	export function addNode(type: string, data: Record<string, unknown>, position?: { x: number; y: number }) {
		const id = `${type}-${Date.now()}`;
		const newNode: Node = {
			id,
			type,
			position: position || { x: Math.random() * 400 + 50, y: Math.random() * 300 + 50 },
			data
		};
		nodes.update((n) => [...n, newNode]);
		return id;
	}

	// Connect nodes function
	export function connectNodes(sourceId: string, targetId: string) {
		const id = `edge-${sourceId}-${targetId}`;
		const newEdge: Edge = {
			id,
			source: sourceId,
			target: targetId,
			animated: true,
			style: 'stroke: hsl(var(--primary)); stroke-width: 2px;'
		};
		edges.update((e) => [...e, newEdge]);
		return id;
	}

	// Clear all
	export function clearCanvas() {
		nodes.set([]);
		edges.set([]);
	}

	// Get current state
	export function getWorkflow() {
		let currentNodes: Node[] = [];
		let currentEdges: Edge[] = [];
		nodes.subscribe((n) => (currentNodes = n))();
		edges.subscribe((e) => (currentEdges = e))();
		return { nodes: currentNodes, edges: currentEdges };
	}
</script>

<div class="h-full w-full rounded-xl overflow-hidden border border-border">
	<SvelteFlow
		{nodes}
		{edges}
		{nodeTypes}
		fitView
		defaultEdgeOptions={{
			animated: true,
			style: 'stroke: hsl(var(--primary)); stroke-width: 2px;'
		}}
		connectionLineStyle="stroke: hsl(var(--primary)); stroke-width: 2px;"
		snapToGrid
		snapGrid={[15, 15]}
	>
		<Controls
			class="!bg-card !border-border !rounded-lg"
		/>
		<Background
			variant="dots"
			gap={15}
			color="hsl(var(--muted-foreground) / 0.2)"
		/>
		<MiniMap
			class="!bg-card !border-border !rounded-lg"
			nodeColor={(node) => {
				switch (node.type) {
					case 'agent':
						return 'hsl(var(--primary))';
					case 'tool':
						return '#a855f7';
					case 'input':
						return '#22c55e';
					case 'output':
						return '#ef4444';
					default:
						return 'hsl(var(--muted))';
				}
			}}
		/>
	</SvelteFlow>
</div>
