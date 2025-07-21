// Конфигурация VPN-сервера (в реальном приложении должно быть несколько серверов)
const SERVER_CONFIG = {
    name: "Netherlands",       // Человекочитаемое название сервера
    address: "185.184.122.74", // IP-адрес сервера
    port: 1000,                // Порт для подключения
    scheme: 'socks5'           // Протокол подключения (SOCKS5)
};

// Настройки прокси для активного и неактивного состояний
const PROXY_SETTINGS = {
    active: {
        mode: 'fixed_servers',  // Режим фиксированного сервера
        rules: {
            singleProxy: {      // Настройки единственного прокси-сервера
                scheme: SERVER_CONFIG.scheme,
                host: SERVER_CONFIG.address,
                port: SERVER_CONFIG.port
            },
            bypassList: ['localhost']  // Сайты, которые не должны идти через прокси
        }
    },
    inactive: {
        mode: 'direct'  // Прямое подключение без прокси
    }
};

// Состояние VPN (активно/неактивно и время последней активации)
let vpnState = {
    isActive: false,
    lastActivation: null
};

// Состояние аутентификации пользователя
let authState = {
    isAuthenticated: false,
    email: ""
};

// Инициализация расширения при установке
chrome.runtime.onInstalled.addListener(() => {
    console.log('VPN Barbaris инициализирован');
    // Установка начальных значений в хранилище
    chrome.storage.sync.set({
        vpnStatus: false,
        authState: {
            isAuthenticated: false,
            email: ""
        }
    });
});

// Обработчик сообщений от других частей расширения (попап, content scripts)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case "toggle":
            // Переключение состояния VPN
            toggleVPN().then(status => sendResponse({ status }));
            return true;  // Необходимо для асинхронного ответа

        case "getStatus":
            // Возврат текущего состояния VPN
            sendResponse({ status: vpnState.isActive });
            break;

        case "getServerInfo":
            // Возврат информации о текущем сервере
            sendResponse({ server: SERVER_CONFIG });
            break;

        case "authenticate":
            // Упрощенная аутентификация (в реальном приложении нужна проверка)
            authState.isAuthenticated = true;
            authState.email = request.credentials.email;
            chrome.storage.sync.set({ authState });
            sendResponse({ success: true });
            break;

        case "checkAuth":
            // Проверка состояния аутентификации
            sendResponse({
                authenticated: authState.isAuthenticated,
                email: authState.email
            });
            break;

        case "logout":
            // Выход из системы
            authState.isAuthenticated = false;
            authState.email = "";
            chrome.storage.sync.set({ authState });
            sendResponse({ success: true });
            break;

        default:
            console.warn('Неизвестное действие:', request.action);
    }
});

// Менеджер VPN - основной функционал расширения
const VPNManager = {
    // Активация VPN
    activate: async function () {
        return new Promise((resolve, reject) => {
            // Установка настроек прокси
            chrome.proxy.settings.set(
                {
                    scope: 'regular',  // Применять для обычного режима
                    value: PROXY_SETTINGS.active
                },
                () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                        return;
                    }

                    // Обновление состояния и интерфейса
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

    // Деактивация VPN
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

    // Обновление иконки расширения в зависимости от состояния
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

// Функция переключения состояния VPN
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

// Отслеживание изменений в хранилище (синхронизация между вкладками)
chrome.storage.onChanged.addListener((changes) => {
    if (changes.vpnStatus) {
        vpnState.isActive = changes.vpnStatus.newValue;
        VPNManager.updateUI();
    }
    if (changes.authState) {
        authState = changes.authState.newValue;
    }
});

// Инициализация состояния при запуске браузера
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.sync.get(['vpnStatus', 'authState'], (result) => {
        vpnState.isActive = result.vpnStatus || false;
        authState = result.authState || { isAuthenticated: false, email: "" };
        VPNManager.updateUI();
    });
});