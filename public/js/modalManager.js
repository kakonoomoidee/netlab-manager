/**
 * Global Modal Manager
 * Handles the display and event lifecycle of global modals.
 */
(function() {
    let currentEditSaveHandler = null;
    let currentConfirmHandler = null;

    window.ModalManager = {
        /**
         * Shows the Edit Modal populated with data.
         * @param {Object} data The server data to populate.
         * @param {Function} onSave Callback when form is submitted. Passed (formData, showErrorFn).
         */
        showEditModal: function(data, onSave) {
            const modal = document.getElementById('globalEditModal');
            if (!modal) return;
            
            document.getElementById('globalEditErrorContainer').classList.add('hidden');
            
            // Populate form
            document.getElementById('global_edit_id').value = data.id || '';
            document.getElementById('global_edit_hostname').value = data.hostname || '';
            document.getElementById('global_edit_ip').value = data.ip || '';
            document.getElementById('global_edit_ssh_port').value = data.ssh_port || 22;
            document.getElementById('global_edit_username').value = data.username || 'pi';
            document.getElementById('global_edit_role').value = data.role || 'node';
            
            const form = document.getElementById('globalEditForm');
            
            // Clean up old listener to prevent memory leaks / multiple submissions
            if (currentEditSaveHandler) {
                form.removeEventListener('submit', currentEditSaveHandler);
            }
            
            currentEditSaveHandler = async function(e) {
                e.preventDefault();
                const formData = new FormData(form);
                const resultData = Object.fromEntries(formData.entries());
                
                try {
                    // Call the provided onSave handler, passing the form data and a function to show errors
                    await onSave(resultData, function(errorMsg) {
                        const errDiv = document.getElementById('globalEditErrorContainer');
                        errDiv.textContent = errorMsg;
                        errDiv.classList.remove('hidden');
                    });
                } catch (err) {
                    console.error('Modal onSave error:', err);
                }
            };
            
            form.addEventListener('submit', currentEditSaveHandler);
            
            modal.classList.remove('hidden');
        },

        /**
         * Hides the Edit Modal.
         */
        hideEditModal: function() {
            const modal = document.getElementById('globalEditModal');
            if (modal) modal.classList.add('hidden');
            const err = document.getElementById('globalEditErrorContainer');
            if (err) err.classList.add('hidden');
        },

        /**
         * Shows the Confirm Modal.
         * @param {string} message The confirmation message.
         * @param {Function} onConfirm Callback when user confirms.
         */
        showConfirmModal: function(message, onConfirm) {
            const modal = document.getElementById('globalConfirmModal');
            if (!modal) return;
            
            document.getElementById('globalConfirmMessage').textContent = message;
            
            const submitBtn = document.getElementById('globalConfirmSubmitBtn');
            
            // Clean up old listener
            if (currentConfirmHandler) {
                submitBtn.removeEventListener('click', currentConfirmHandler);
            }
            
            currentConfirmHandler = async function() {
                try {
                    await onConfirm();
                } catch (err) {
                    console.error('Modal onConfirm error:', err);
                } finally {
                    window.ModalManager.hideConfirmModal();
                }
            };
            
            submitBtn.addEventListener('click', currentConfirmHandler);
            
            modal.classList.remove('hidden');
        },

        /**
         * Hides the Confirm Modal.
         */
        hideConfirmModal: function() {
            const modal = document.getElementById('globalConfirmModal');
            if (modal) modal.classList.add('hidden');
        },
        
        /**
         * Tracks the server ID of the currently open stats modal
         */
        currentStatsServerId: null,

        /**
         * Shows the Stats Modal and populates it with data.
         * @param {Object} server The server data containing stats.
         */
        showStatsModal: function(server) {
            const modal = document.getElementById('globalStatsModal');
            if (!modal) return;
            
            this.currentStatsServerId = server.id;
            this.updateStatsModalIfOpen(server);
            
            modal.classList.remove('hidden');
        },

        /**
         * Updates the stats modal if it is currently open for the given server.
         * @param {Object} server The server data.
         */
        updateStatsModalIfOpen: function(server) {
            if (this.currentStatsServerId !== server.id) return;
            
            const hostname = document.getElementById('globalStatsHostname');
            if (hostname) hostname.textContent = server.hostname;
            
            if (server.stats) {
                const cpuVal = Math.min(parseFloat(server.stats.cpu) || 0, 100);
                const cpuLabel = document.getElementById('globalStatsCpuVal');
                const cpuBar = document.getElementById('globalStatsCpuBar');
                if (cpuLabel) cpuLabel.textContent = server.stats.cpu || '-';
                if (cpuBar) cpuBar.style.width = cpuVal + '%';

                let ramVal = 0;
                if (server.stats.ram && server.stats.ram.includes('/')) {
                    const ramParts = server.stats.ram.replace(/[^\d.\/]/g, '').split('/');
                    if (ramParts.length === 2) {
                        const used = parseFloat(ramParts[0]);
                        const total = parseFloat(ramParts[1]);
                        if (total > 0) {
                            ramVal = (used / total) * 100;
                        }
                    }
                }
                ramVal = Math.min(ramVal, 100);
                
                const ramLabel = document.getElementById('globalStatsRamVal');
                const ramBar = document.getElementById('globalStatsRamBar');
                if (ramLabel) ramLabel.textContent = server.stats.ram || '-';
                if (ramBar) ramBar.style.width = ramVal + '%';

                let diskVal = 0;
                if (server.stats.disk) {
                    const diskMatch = server.stats.disk.match(/\((\d+)%\)/);
                    if (diskMatch && diskMatch[1]) {
                        diskVal = parseFloat(diskMatch[1]);
                    } else {
                        diskVal = parseFloat(server.stats.disk) || 0;
                    }
                }
                diskVal = Math.min(diskVal, 100);
                
                const diskLabel = document.getElementById('globalStatsDiskVal');
                const diskBar = document.getElementById('globalStatsDiskBar');
                if (diskLabel) diskLabel.textContent = server.stats.disk || '-';
                if (diskBar) diskBar.style.width = diskVal + '%';

                const tempVal = parseFloat(server.stats.temp) || 0;
                const tempLabel = document.getElementById('globalStatsTempVal');
                if (tempLabel) {
                    tempLabel.textContent = server.stats.temp || '-';
                    tempLabel.className = 'text-lg font-bold';
                    if (tempVal > 80) {
                        tempLabel.classList.add('text-red-600');
                    } else if (tempVal > 70) {
                        tempLabel.classList.add('text-yellow-600');
                    } else {
                        tempLabel.classList.add('text-gray-700');
                    }
                }
            } else {
                ['Cpu', 'Ram', 'Disk', 'Temp'].forEach(stat => {
                    const label = document.getElementById(`globalStats${stat}Val`);
                    const bar = document.getElementById(`globalStats${stat}Bar`);
                    if (label) label.textContent = '-';
                    if (bar) bar.style.width = '0%';
                });
            }
        },

        /**
         * Hides the Stats Modal.
         */
        hideStatsModal: function() {
            const modal = document.getElementById('globalStatsModal');
            if (modal) modal.classList.add('hidden');
            this.currentStatsServerId = null;
        },
        
        currentTerminal: null,
        
        /**
         * Shows the Terminal Modal and initializes xterm.js.
         * @param {Object} server The server data.
         */
        showTerminalModal: function(server) {
            const modal = document.getElementById('globalTerminalModal');
            if (!modal) return;
            
            document.getElementById('globalTerminalHostname').textContent = `${server.username}@${server.ip}:${server.ssh_port}`;
            modal.classList.remove('hidden');
            
            const container = document.getElementById('globalTerminalContainer');
            container.innerHTML = ''; // Clear previous terminal
            
            const term = new window.Terminal({
                cursorBlink: true,
                theme: {
                    background: '#111827', // Tailwind gray-900
                    foreground: '#F3F4F6', // Tailwind gray-100
                    cursor: '#10B981', // Tailwind emerald-500
                    cursorAccent: '#111827',
                    selectionBackground: 'rgba(255, 255, 255, 0.3)'
                },
                fontFamily: '"Fira Code", "JetBrains Mono", monospace',
                fontSize: 14,
                lineHeight: 1.2
            });
            
            const fitAddon = new window.FitAddon.FitAddon();
            term.loadAddon(fitAddon);
            if (window.WebLinksAddon) {
                term.loadAddon(new window.WebLinksAddon.WebLinksAddon());
            }
            
            term.open(container);
            
            // Need a small timeout to let the modal finish rendering before fitting
            setTimeout(() => {
                fitAddon.fit();
            }, 100);
            
            this._terminalResizeHandler = () => fitAddon.fit();
            window.addEventListener('resize', this._terminalResizeHandler);
            
            term.writeln(`\x1b[1;36mInitializing connection to ${server.hostname}...\x1b[0m`);
            
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${window.location.host}/terminal-ws/${server.id}`;
            const socket = new WebSocket(wsUrl);
            
            this.currentSocket = socket;

            const statusEl = document.getElementById('globalTerminalConnectionStatus');

            socket.onopen = () => {
                if (statusEl) {
                    statusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-green-500 mr-2"></span> Connected';
                    statusEl.className = 'text-xs font-mono text-green-500 flex items-center';
                }
            };

            socket.onmessage = (event) => {
                term.write(event.data);
            };

            socket.onclose = () => {
                if (statusEl) {
                    statusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-500 mr-2"></span> Disconnected';
                    statusEl.className = 'text-xs font-mono text-red-500 flex items-center';
                }
                term.write('\r\n\x1b[31mConnection closed.\x1b[0m\r\n');
            };

            socket.onerror = (error) => {
                term.write('\r\n\x1b[31mWebSocket Error.\x1b[0m\r\n');
            };

            term.onData(data => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(data);
                }
            });
            
            this.currentTerminal = term;
        },
        
        /**
         * Hides the Terminal Modal and cleans up resources.
         */
        hideTerminalModal: function() {
            const modal = document.getElementById('globalTerminalModal');
            if (modal) modal.classList.add('hidden');
            
            if (this.currentTerminal) {
                this.currentTerminal.dispose();
                this.currentTerminal = null;
            }
            if (this.currentSocket) {
                this.currentSocket.close();
                this.currentSocket = null;
            }
            if (this._terminalResizeHandler) {
                window.removeEventListener('resize', this._terminalResizeHandler);
                this._terminalResizeHandler = null;
            }
        }
    };

    // Attach static cancellation event listeners on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
        const editCancelBtn = document.getElementById('globalEditCancelBtn');
        const editCancelTopBtn = document.getElementById('globalEditCancelTopBtn');
        const confirmCancelBtn = document.getElementById('globalConfirmCancelBtn');
        
        if (editCancelBtn) {
            editCancelBtn.addEventListener('click', () => {
                window.ModalManager.hideEditModal();
            });
        }
        if (editCancelTopBtn) {
            editCancelTopBtn.addEventListener('click', () => {
                window.ModalManager.hideEditModal();
            });
        }
        
        if (confirmCancelBtn) {
            confirmCancelBtn.addEventListener('click', () => {
                window.ModalManager.hideConfirmModal();
            });
        }
        
        const statsCancelTopBtn = document.getElementById('globalStatsCancelTopBtn');
        const statsCloseBtn = document.getElementById('globalStatsCloseBtn');
        
        if (statsCancelTopBtn) {
            statsCancelTopBtn.addEventListener('click', () => {
                window.ModalManager.hideStatsModal();
            });
        }
        if (statsCloseBtn) {
            statsCloseBtn.addEventListener('click', () => {
                window.ModalManager.hideStatsModal();
            });
        }
        
        const terminalCloseDotBtn = document.getElementById('globalTerminalCloseDotBtn');
        if (terminalCloseDotBtn) {
            terminalCloseDotBtn.addEventListener('click', () => {
                window.ModalManager.hideTerminalModal();
            });
        }
        
        // Close modals on Escape key press
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                window.ModalManager.hideEditModal();
                window.ModalManager.hideConfirmModal();
                window.ModalManager.hideStatsModal();
                window.ModalManager.hideTerminalModal();
                
                // Support for the add server modal if it exists
                const addServerModal = document.getElementById('addServerModal');
                if (addServerModal && !addServerModal.classList.contains('hidden')) {
                    addServerModal.classList.add('hidden');
                }
            }
        });
        
        // Close modals on outside click (clicking the background overlay)
        document.addEventListener('click', (e) => {
            if (e.target.id === 'globalEditModal') {
                window.ModalManager.hideEditModal();
            } else if (e.target.id === 'globalConfirmModal') {
                window.ModalManager.hideConfirmModal();
            } else if (e.target.id === 'globalStatsModal') {
                window.ModalManager.hideStatsModal();
            } else if (e.target.id === 'globalTerminalModal') {
                window.ModalManager.hideTerminalModal();
            } else if (e.target.id === 'addServerModal') {
                e.target.classList.add('hidden');
            }
        });
    });

})();
