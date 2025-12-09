<script lang="ts">
	import {
		SvelteFlow,
		Controls,
		Background,
		MiniMap,
		type Node,
		type Edge,
		type NodeTypes,
		BackgroundVariant
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
		onNodesChange: onNodesChangeCallback,
		onEdgesChange: onEdgesChangeCallback
	}: Props = $props();

	// Use Svelte 5 $state for reactive arrays
	// These will be two-way bound to SvelteFlow
	let nodes = $state<Node[]>(Array.isArray(initialNodes) ? [...initialNodes] : []);
	let edges = $state<Edge[]>(Array.isArray(initialEdges) ? [...initialEdges] : []);

	const nodeTypes: NodeTypes = {
		agent: AgentNode,
		tool: ToolNode,
		input: InputNode,
		output: OutputNode
	};

	// Track previous values to detect changes
	let prevNodesLength = $state(nodes.length);
	let prevEdgesLength = $state(edges.length);

	// Notify parent of changes via $effect
	$effect(() => {
		// Check if nodes actually changed (compare by length and reference)
		if (nodes.length !== prevNodesLength || nodes !== nodes) {
			prevNodesLength = nodes.length;
			onNodesChangeCallback?.(nodes);
		}
	});

	$effect(() => {
		// Check if edges actually changed
		if (edges.length !== prevEdgesLength || edges !== edges) {
			prevEdgesLength = edges.length;
			onEdgesChangeCallback?.(edges);
		}
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
		nodes = [...nodes, newNode];
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
		edges = [...edges, newEdge];
		return id;
	}

	// Clear all
	export function clearCanvas() {
		nodes = [];
		edges = [];
	}

	// Get current state
	export function getWorkflow() {
		return { nodes: [...nodes], edges: [...edges] };
	}
</script>

<div class="h-full w-full rounded-xl overflow-hidden border border-border">
	<SvelteFlow
		bind:nodes
		bind:edges
		{nodeTypes}
		fitView
		defaultEdgeOptions={{
			animated: true,
			style: 'stroke: hsl(var(--primary)); stroke-width: 2px;'
		}}
		connectionLineStyle="stroke: hsl(var(--primary)); stroke-width: 2px;"
		snapGrid={[15, 15]}
	>
		<Controls
			class="!bg-card !border-border !rounded-lg"
		/>
		<Background
			variant={BackgroundVariant.Dots}
			gap={15}
			patternColor="hsl(var(--muted-foreground) / 0.2)"
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
