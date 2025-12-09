<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { Send, FileOutput, Globe } from 'lucide-svelte';

	interface Props {
		data: {
			label: string;
			outputType: 'response' | 'file' | 'webhook';
			format?: string;
		};
		selected?: boolean;
	}

	let { data, selected = false }: Props = $props();

	const typeIcons = {
		response: Send,
		file: FileOutput,
		webhook: Globe
	};

	const OutputIcon = typeIcons[data.outputType] || Send;
</script>

<div
	class="min-w-[160px] rounded-xl border-2 bg-card shadow-lg transition-all {selected
		? 'border-red-500 shadow-red-500/25'
		: 'border-red-500/50'}"
>
	<div class="flex items-center gap-2 px-3 py-2">
		<div class="rounded-lg bg-red-500 p-1.5">
			<OutputIcon class="h-4 w-4 text-white" />
		</div>
		<div class="flex-1 min-w-0">
			<h3 class="font-medium text-sm truncate">{data.label}</h3>
			<p class="text-xs text-muted-foreground capitalize">{data.outputType} Output</p>
		</div>
	</div>

	<!-- Input Handle only (no output for output nodes) -->
	<Handle type="target" position={Position.Left} class="!bg-red-500 !w-3 !h-3 !border-2 !border-background" />
</div>
