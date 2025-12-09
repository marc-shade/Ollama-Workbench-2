<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import { MessageSquare, FileText, Upload } from 'lucide-svelte';

	interface Props {
		data: {
			label: string;
			inputType: 'text' | 'file' | 'api';
			placeholder?: string;
		};
		selected?: boolean;
	}

	let { data, selected = false }: Props = $props();

	const typeIcons = {
		text: MessageSquare,
		file: FileText,
		api: Upload
	};

	const InputIcon = typeIcons[data.inputType] || MessageSquare;
</script>

<div
	class="min-w-[160px] rounded-xl border-2 bg-card shadow-lg transition-all {selected
		? 'border-green-500 shadow-green-500/25'
		: 'border-green-500/50'}"
>
	<div class="flex items-center gap-2 px-3 py-2">
		<div class="rounded-lg bg-green-500 p-1.5">
			<InputIcon class="h-4 w-4 text-white" />
		</div>
		<div class="flex-1 min-w-0">
			<h3 class="font-medium text-sm truncate">{data.label}</h3>
			<p class="text-xs text-muted-foreground capitalize">{data.inputType} Input</p>
		</div>
	</div>

	<!-- Output Handle only (no input for input nodes) -->
	<Handle type="source" position={Position.Right} class="!bg-green-500 !w-3 !h-3 !border-2 !border-background" />
</div>
