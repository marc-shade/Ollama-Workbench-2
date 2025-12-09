<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { Wrench, Cog, Zap } from 'lucide-svelte';

	interface Props {
		data: {
			label: string;
			toolType: 'function' | 'mcp' | 'custom';
			description?: string;
			parameters?: Record<string, unknown>;
		};
		selected?: boolean;
	}

	let { data, selected = false }: Props = $props();

	const typeColors = {
		function: 'bg-purple-500',
		mcp: 'bg-blue-500',
		custom: 'bg-orange-500'
	};

	const typeIcons = {
		function: Zap,
		mcp: Cog,
		custom: Wrench
	};

	const ToolIcon = typeIcons[data.toolType] || Wrench;
</script>

<div
	class="min-w-[180px] rounded-xl border-2 bg-card shadow-lg transition-all {selected
		? 'border-primary shadow-primary/25'
		: 'border-border'}"
>
	<!-- Header -->
	<div class="flex items-center gap-2 px-3 py-2">
		<div class="rounded-lg {typeColors[data.toolType]} p-1.5">
			<ToolIcon class="h-4 w-4 text-white" />
		</div>
		<div class="flex-1 min-w-0">
			<h3 class="font-medium text-sm truncate">{data.label}</h3>
			<p class="text-xs text-muted-foreground capitalize">{data.toolType} Tool</p>
		</div>
	</div>

	{#if data.description}
		<div class="border-t border-border px-3 py-2">
			<p class="text-xs text-muted-foreground line-clamp-2">{data.description}</p>
		</div>
	{/if}

	<!-- Input Handle -->
	<Handle type="target" position={Position.Left} class="!bg-purple-500 !w-3 !h-3 !border-2 !border-background" />

	<!-- Output Handle -->
	<Handle type="source" position={Position.Right} class="!bg-purple-500 !w-3 !h-3 !border-2 !border-background" />
</div>
