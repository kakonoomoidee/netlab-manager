/**
 * Global state management for NetLab Manager.
 * Handles background polling of server telemetry and health.
 */
(function() {
    window.NetLabStore = {
        servers: [],
        isPolling: false,
        intervalId: null
    };

    // Attempt to hydrate from cache immediately on script initialization
    try {
        const cached = sessionStorage.getItem('netlab_servers_cache');
        if (cached) {
            window.NetLabStore.servers = JSON.parse(cached);
            dispatchUpdate();
        }
    } catch (e) {
        console.warn('Corrupted sessionStorage cache for NetLabStore, clearing...', e);
        sessionStorage.removeItem('netlab_servers_cache');
    }

    /**
     * Start the global polling loop.
     */
    async function startPolling() {
        if (window.NetLabStore.isPolling) return;
        window.NetLabStore.isPolling = true;
        
        try {
            await fetchInitialData();
            // Poll every 5 seconds
            window.NetLabStore.intervalId = setInterval(pollTelemetry, 5000);
        } catch (e) {
            console.error('Failed to start global polling', e);
            window.NetLabStore.isPolling = false;
        }
    }

    /**
     * Stop the polling loop.
     */
    function stopPolling() {
        if (window.NetLabStore.intervalId) {
            clearInterval(window.NetLabStore.intervalId);
            window.NetLabStore.intervalId = null;
        }
        window.NetLabStore.isPolling = false;
    }

    /**
     * Fetches the initial list of servers.
     */
    async function fetchInitialData() {
        const res = await fetch('/servers/data');
        if (res.ok) {
            const data = await res.json();
            window.NetLabStore.servers = data.servers.map(server => {
                const existing = window.NetLabStore.servers.find(s => s.id === server.id);
                return {
                    ...server,
                    status: existing ? existing.status : 'Checking...',
                    stats: existing && existing.stats ? existing.stats : { cpu: '-', ram: '-', disk: '-', temp: '-' }
                };
            });
            dispatchUpdate();
            
            // Do an immediate ping for all servers to get initial status
            pollTelemetry();
        } else if (res.status === 401 || res.status === 403) {
            // Not authenticated, stop polling
            stopPolling();
        }
    }

    /**
     * Polls the ping and stats endpoints for each server.
     */
    async function pollTelemetry() {
        if (!window.NetLabStore.servers || window.NetLabStore.servers.length === 0) return;
        
        const promises = window.NetLabStore.servers.map(async (server, index) => {
            try {
                // Ping first
                const pingRes = await fetch('/servers/' + server.id + '/ping');
                if (!pingRes.ok) throw new Error('Ping failed');
                const pingData = await pingRes.json();
                
                const statusStr = pingData.status ? pingData.status.toLowerCase() : '';
                const isOnline = statusStr === 'online';
                
                window.NetLabStore.servers[index].status = isOnline ? 'Online' : 'Offline';
                
                // If online, fetch stats
                if (isOnline) {
                    const statsRes = await fetch('/servers/' + server.id + '/stats');
                    if (statsRes.ok) {
                        const statsData = await statsRes.json();
                        if (statsData.stats) {
                            window.NetLabStore.servers[index].stats = statsData.stats;
                        }
                    }
                } else {
                    window.NetLabStore.servers[index].stats = { cpu: '-', ram: '-', disk: '-', temp: '-' };
                }
            } catch (e) {
                window.NetLabStore.servers[index].status = 'Offline';
                window.NetLabStore.servers[index].stats = { cpu: '-', ram: '-', disk: '-', temp: '-' };
            }
        });
        
        await Promise.all(promises);
        dispatchUpdate();
    }

    /**
     * Dispatches a custom event to notify components of a state update.
     */
    function dispatchUpdate() {
        try {
            sessionStorage.setItem('netlab_servers_cache', JSON.stringify(window.NetLabStore.servers));
        } catch (e) {
            console.warn('Failed to write to sessionStorage cache', e);
        }

        const event = new CustomEvent('netlab-state-updated', {
            detail: { servers: window.NetLabStore.servers }
        });
        document.dispatchEvent(event);
    }
    
    // Auto-start polling on DOM load
    document.addEventListener('DOMContentLoaded', () => {
        // Only start if not on login page
        if (!window.location.pathname.startsWith('/login')) {
            startPolling();
        }
    });

    // Expose methods to global scope
    window.NetLabStore.startPolling = startPolling;
    window.NetLabStore.stopPolling = stopPolling;
    window.NetLabStore.fetchInitialData = fetchInitialData;
})();
