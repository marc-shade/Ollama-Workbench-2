<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import Sidebar from '$components/common/Sidebar.svelte';
	import Header from '$components/common/Header.svelte';
	import { connectionStore } from '$stores/connection';

	let { children } = $props();

	onMount(() => {
		// Check API connection on mount
		connectionStore.checkConnection();

		// Set up periodic connection check
		const interval = setInterval(() => {
			connectionStore.checkConnection();
		}, 30000);

		return () => clearInterval(interval);
	});
</script>

<div class="flex h-screen overflow-hidden">
	<!-- Sidebar Navigation -->
	<Sidebar />

	<!-- Main Content Area -->
	<div class="flex flex-1 flex-col overflow-hidden">
		<!-- Header -->
		<Header />

		<!-- Page Content -->
		<main class="flex-1 overflow-auto p-6">
			{@render children()}
		</main>
	</div>
</div>
