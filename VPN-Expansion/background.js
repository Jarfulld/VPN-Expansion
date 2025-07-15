// Конфигурация сервера VPN
const SERVER = {
    name: "Netherlands",
    address: "nl.barbaris.vpn",
    port: 3128
};

// Состояние расширения
let isActive = false;
let isAuthenticated = false;

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
            sendResponse({ status: isActive });
            break;

        case "authenticate":
            authenticate(request.credentials)
                .then(result => sendResponse(result))
                .catch(error => sendResponse({ error }));
            return true;

        default:
            console.warn('Неизвестное действие:', request.action);
    }
});

// Переключение VPN
async function toggleVPN() {
    try {
        if (isActive) {
            await deactivateVPN();
        } else {
            await activateVPN();
        }
        return isActive;
    } catch (error) {
        console.error('Ошибка переключения VPN:', error);
        throw error;
    }
}

// Активация VPN
async function activateVPN() {
    return new Promise((resolve, reject) => {
        chrome.proxy.settings.set(
            {
                scope: 'regular',
                value: {
                    mode: 'fixed_servers',
                    rules: {
                        singleProxy: {
                            scheme: 'http',
                            host: SERVER.address,
                            port: SERVER.port
                        },
                        bypassList: ['localhost']
                    }
                }
            },
            () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                    return;
                }

                isActive = true;
                updateExtensionIcon();
                chrome.storage.sync.set({ vpnStatus: true });
                console.log(`VPN активирован. Сервер: ${SERVER.name}`);
                resolve(true);
            }
        );
    });
}

// Деактивация VPN
async function deactivateVPN() {
    return new Promise((resolve, reject) => {
        chrome.proxy.settings.set(
            {
                scope: 'regular',
                value: {
                    mode: 'direct'
                }
            },
            () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                    return;
                }

                isActive = false;
                updateExtensionIcon();
                chrome.storage.sync.set({ vpnStatus: false });
                console.log('VPN деактивирован');
                resolve(false);
            }
        );
    });
}

// Аутентификация (заглушка)
async function authenticate(credentials) {
    try {
        const response = await mockAuthApiCall(credentials);
        isAuthenticated = true;
        return { success: true, user: response.user };
    } catch (error) {
        isAuthenticated = false;
        return { success: false, error: error.message };
    }
}

// Мок API аутентификации
function mockAuthApiCall(credentials) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (credentials.email && credentials.password.length >= 6) {
                resolve({
                    user: {
                        email: credentials.email,
                        name: 'Тестовый Пользователь'
                    }
                });
            } else {
                reject(new Error('Неверные учетные данные'));
            }
        }, 1000);
    });
}

// Обновление иконки
function updateExtensionIcon() {
    const iconPrefix = isActive ? 'active' : 'icon';
    const iconPath = `assets/${iconPrefix}`;

    chrome.action.setIcon({
        path: {
            "16": `${iconPath}16.png`,
            "32": `${iconPath}32.png`,
            "48": `${iconPath}48.png`
        }
    });
}

// Отслеживание изменений состояния
chrome.storage.onChanged.addListener((changes) => {
    if (changes.vpnStatus) {
        isActive = changes.vpnStatus.newValue;
        updateExtensionIcon();
    }
});