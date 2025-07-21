// Конфигурация сервера VPN
const SERVER_CONFIG = {
    name: "Netherlands",
    address: "185.184.122.74",
    port: 1000,
    scheme: 'socks5'
};

// Настройки прокси
const PROXY_SETTINGS = {
    active: {
        mode: 'fixed_servers',
        rules: {
            singleProxy: {
                scheme: SERVER_CONFIG.scheme,
                host: SERVER_CONFIG.address,
                port: SERVER_CONFIG.port
            },
            bypassList: ['localhost']
        }
    },
    inactive: {
        mode: 'direct'
    }
};

// Состояние расширения
let vpnState = {
    isActive: false,
    lastActivation: null
};

// Инициализация расширения
chrome.runtime.onInstalled.addListener(() => {
    console.log('VPN Barbaris инициализирован');
    chrome.storage.sync.set({ vpnStatus: false });
});

// Обработчик сообщений
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case "toggle":
            toggleVPN().then(status => sendResponse({ status }));
            return true;

        case "getStatus":
            sendResponse({ status: vpnState.isActive });
            break;

        case "getServerInfo":
            sendResponse({ server: SERVER_CONFIG });
            break;

        default:
            console.warn('Неизвестное действие:', request.action);
    }
});

// Основные функции VPN
const VPNManager = {
    activate: async function () {
        return new Promise((resolve, reject) => {
            chrome.proxy.settings.set(
                {
                    scope: 'regular',
                    value: PROXY_SETTINGS.active
                },
                () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                        return;
                    }

                    vpnState.isActive = true;
                    vpnState.lastActivation = new Date();
                    this.updateUI();
                    chrome.storage.sync.set({ vpnStatus: true });
                    console.log(`VPN активирован через ${SERVER_CONFIG.scheme.toUpperCase()}. Сервер: ${SERVER_CONFIG.name} (${SERVER_CONFIG.address}:${SERVER_CONFIG.port})`);
                    resolve(true);
                }
            );
        });
    },

    deactivate: async function () {
        return new Promise((resolve, reject) => {
            chrome.proxy.settings.set(
                {
                    scope: 'regular',
                    value: PROXY_SETTINGS.inactive
                },
                () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                        return;
                    }

                    vpnState.isActive = false;
                    this.updateUI();
                    chrome.storage.sync.set({ vpnStatus: false });
                    console.log('VPN деактивирован');
                    resolve(false);
                }
            );
        });
    },

    updateUI: function () {
        const iconPrefix = vpnState.isActive ? 'active' : 'icon';
        chrome.action.setIcon({
            path: {
                "16": `assets/${iconPrefix}16.png`,
                "32": `assets/${iconPrefix}32.png`,
                "48": `assets/${iconPrefix}48.png`
            }
        });
    }
};

// Переключение VPN
async function toggleVPN() {
    try {
        if (vpnState.isActive) {
            await VPNManager.deactivate();
        } else {
            await VPNManager.activate();
        }
        return vpnState.isActive;
    } catch (error) {
        console.error('Ошибка переключения VPN:', error);
        throw error;
    }
}

// Отслеживание изменений состояния
chrome.storage.onChanged.addListener((changes) => {
    if (changes.vpnStatus) {
        vpnState.isActive = changes.vpnStatus.newValue;
        VPNManager.updateUI();
    }
});

// Инициализация состояния
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.sync.get(['vpnStatus'], (result) => {
        vpnState.isActive = result.vpnStatus || false;
        VPNManager.updateUI();
    });
});