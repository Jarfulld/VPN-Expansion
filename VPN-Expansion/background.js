// Конфигурация сервера VPN
const SERVER_CONFIG = {
    name: "Netherlands",          // Название сервера
    address: "185.184.122.74",    // IP-адрес сервера
    port: 1000,                   // Порт для подключения
    scheme: 'socks5'              // Протокол подключения (SOCKS5)
};

// Настройки прокси
const PROXY_SETTINGS = {
    active: {                     // Настройки активного прокси
        mode: 'fixed_servers',    // Режим работы: фиксированные серверы

        rules: {
            singleProxy: {       // Конфигурация единственного прокси
                scheme: SERVER_CONFIG.scheme,  // Протокол из SERVER_CONFIG
                host: SERVER_CONFIG.address,   // IP-адрес из SERVER_CONFIG
                port: SERVER_CONFIG.port       // Порт из SERVER_CONFIG
            },
            bypassList: ['localhost']  // Список исключений (не использовать прокси для localhost)
        }
    },
    inactive: {                   // Настройки неактивного прокси
        mode: 'direct'            // Режим работы: прямое подключение (без прокси)
    }
};

// Состояние расширения
let vpnState = {                  // Объект для хранения состояния VPN
    isActive: false,              // Флаг активности VPN
    lastActivation: null          // Время последней активации
};

let authState = {                 // Объект для хранения состояния аутентификации
    isAuthenticated: false,       // Флаг аутентификации пользователя
    email: ""                     // Email пользователя
};

// Инициализация расширения при установке
chrome.runtime.onInstalled.addListener(() => {
    console.log('VPN Barbaris инициализирован');
    // Установка начальных значений в хранилище
    chrome.storage.sync.set({
        vpnStatus: false,         // Статус VPN по умолчанию: выключен
        authState: {              // Начальное состояние аутентификации
            isAuthenticated: false,
            email: ""
        }
    });
});

// Обработчик сообщений между компонентами расширения
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {     // Обработка различных действий
        case "toggle":            // Переключение состояния VPN
            toggleVPN().then(status => sendResponse({ status }));
            return true;          // Возврат true для асинхронного ответа

        case "getStatus":         // Получение текущего статуса VPN
            sendResponse({ status: vpnState.isActive });
            break;

        case "getServerInfo":    // Получение информации о сервере
            sendResponse({ server: SERVER_CONFIG });
            break;

        case "authenticate":      // Аутентификация пользователя
            authState.isAuthenticated = true;
            authState.email = request.credentials.email;
            chrome.storage.sync.set({ authState });  // Сохранение состояния в хранилище
            sendResponse({ success: true });
            break;

        case "checkAuth":         // Проверка состояния аутентификации
            sendResponse({
                authenticated: authState.isAuthenticated,
                email: authState.email
            });
            break;

        case "logout":            // Выход из системы
            authState.isAuthenticated = false;
            authState.email = "";
            chrome.storage.sync.set({ authState });  // Обновление хранилища

            // Всегда пытаемся отключить VPN при выходе
            if (vpnState.isActive) {
                VPNManager.deactivate().then(() => {
                    vpnState.isActive = false;
                    chrome.storage.sync.set({ vpnStatus: false });
                    sendResponse({ success: true });
                }).catch(error => {
                    console.error('Ошибка при отключении VPN:', error);
                    sendResponse({ success: false, error: error.message });
                });
                return true; // Для асинхронного ответа
            } else {
                sendResponse({ success: true });
            }
            break;

        default:                  // Обработка неизвестных действий
            console.warn('Неизвестное действие:', request.action);
    }
});

// Основные функции управления VPN
const VPNManager = {
    // Активация VPN
    activate: async function () {
        return new Promise((resolve, reject) => {
            chrome.proxy.settings.set(  // Установка настроек прокси
                {
                    scope: 'regular',  // Область применения: обычные профили
                    value: PROXY_SETTINGS.active  // Активные настройки прокси
                },
                () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);  // Обработка ошибки
                        return;
                    }

                    vpnState.isActive = true;
                    vpnState.lastActivation = new Date();  // Запись времени активации
                    this.updateUI();                       // Обновление иконки
                    chrome.storage.sync.set({ vpnStatus: true });  // Сохранение статуса
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
                    value: PROXY_SETTINGS.inactive  // Настройки прямого подключения
                },
                () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                        return;
                    }

                    vpnState.isActive = false;
                    this.updateUI();                       // Обновление иконки
                    chrome.storage.sync.set({ vpnStatus: false });  // Сохранение статуса
                    console.log('VPN деактивирован');
                    resolve(false);
                }
            );
        });
    },

    // Обновление иконки расширения
    updateUI: function () {
        chrome.action.setIcon({
            path: {
                "16": `assets/icon16.png`,  // Иконка 16x16
                "32": `assets/icon32.png`,  // Иконка 32x32
                "48": `assets/icon48.png`   // Иконка 48x48
            }
        });
    }
};

// Функция переключения состояния VPN
async function toggleVPN() {
    try {
        if (vpnState.isActive) {
            await VPNManager.deactivate();  // Деактивация, если активно
        } else {
            await VPNManager.activate();     // Активация, если неактивно
        }
        return vpnState.isActive;           // Возврат текущего состояния
    } catch (error) {
        console.error('Ошибка переключения VPN:', error);
        throw error;
    }
}

// Отслеживание изменений в хранилище
chrome.storage.onChanged.addListener((changes) => {
    if (changes.vpnStatus) {                // Если изменился статус VPN
        vpnState.isActive = changes.vpnStatus.newValue;
        VPNManager.updateUI();               // Обновление иконки
    }
    if (changes.authState) {                // Если изменилось состояние аутентификации
        authState = changes.authState.newValue;
    }
});

// Инициализация состояния при запуске браузера
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.sync.get(['vpnStatus', 'authState'], (result) => {
        vpnState.isActive = result.vpnStatus || false;  // Восстановление статуса VPN
        authState = result.authState || { isAuthenticated: false, email: "" };  // Восстановление состояния аутентификации
        VPNManager.updateUI();               // Обновление иконки
    });
});