<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { Bot, Cpu, Settings, Play, Pause, AlertCircle } from 'lucide-svelte';

	interface Props {
		data: {
			label: string;
			model: string;
			systemPrompt?: string;
			status?: 'idle' | 'running' | 'error' | 'success';
			description?: string;
		};
		selected?: boolean;
	}

	let { data, selected = false }: Props = $props();

	const statusColors = {
		idle: 'bg-muted',
		running: 'bg-blue-500 animate-pulse',
		error: 'bg-destructive',
		success: 'bg-green-500'
	};

	const statusIcons = {
		idle: Cpu,
		running: Play,
		error: AlertCircle,
		success: Bot
	};

	const status = data.status || 'idle';
	const StatusIcon = statusIcons[status];
</script>

<div
	class="min-w-[200px] rounded-xl border-2 bg-card shadow-lg transition-all {selected
		? 'border-primary shadow-primary/25'
		: 'border-border'}"
>
	<!-- Header -->
	<div class="flex items-center gap-2 border-b border-border px-3 py-2">
		<div class="rounded-lg {statusColors[status]} p-1.5">
			<StatusIcon class="h-4 w-4 text-white" />
		</div>
		<div class="flex-1 min-w-0">
			<h3 class="font-semibold text-sm truncate">{data.label}</h3>
			<p class="text-xs text-muted-foreground truncate">{data.model}</p>
		</div>
		<button class="rounded p-1 hover:bg-muted transition-colors">
			<Settings class="h-3.5 w-3.5 text-muted-foreground" />
		</button>
	</div>

	<!-- Body -->
	{#if data.description || data.systemPrompt}
		<div class="px-3 py-2">
			<p class="text-xs text-muted-foreground line-clamp-2">
				{data.description || data.systemPrompt}
			</p>
		</div>
	{/if}

	<!-- Input Handle -->
	<Handle type="target" position={Position.Left} class="!bg-primary !w-3 !h-3 !border-2 !border-background" />

	<!-- Output Handle -->
	<Handle type="source" position={Position.Right} class="!bg-primary !w-3 !h-3 !border-2 !border-background" />
</div>
