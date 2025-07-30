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
    chrome.storage.local.set({    // Используем local вместо sync для более надежного хранения
        vpnStatus: false,         // Статус VPN по умолчанию: выключен
        authState: {              // Начальное состояние аутентификации
            isAuthenticated: false,
            email: ""
        }
    });
});

// Функция для аутентификации пользователя на сервере
async function authenticateWithServer(email, password) {
    // Формируем тело запроса в формате JSON, как указано в требованиях
    const requestBody = JSON.stringify({
        email: email,
        password: password
    });

    try {
        // Отправляем POST-запрос на сервер аутентификации
        const response = await fetch('http://185.184.122.25:5000/auth_auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json', // Указываем, что отправляем JSON
            },
            body: requestBody // Передаем сформированное тело запроса
        });

        // Проверяем статус ответа сервера
        if (!response.ok) {
            // Если сервер вернул ошибку, пытаемся получить сообщение об ошибке из ответа
            const errorData = await response.json();
            throw new Error(errorData.message || `Ошибка HTTP! Статус: ${response.status}`);
        }

        // Парсим JSON ответ сервера
        const data = await response.json();

        // Проверяем наличие обязательного поля 'success' в ответе
        if (!data.hasOwnProperty('success')) {
            throw new Error('Некорректный формат ответа сервера');
        }

        // Возвращаем данные для обработки в вызывающем коде
        return data;
    } catch (error) {
        console.error('Ошибка при аутентификации:', error);
        throw error; // Пробрасываем ошибку дальше для обработки в вызывающем коде
    }
}

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

        case "authenticate":
            // Обработка запроса на аутентификацию
            authenticateWithServer(request.credentials.email, request.credentials.password)
                .then(data => {
                    if (data.success) {
                        // Если аутентификация успешна:
                        // Обновляем состояние аутентификации
                        authState.isAuthenticated = true;
                        authState.email = request.credentials.email;

                        // Сохраняем состояние в хранилище Chrome (используем local для надежности)
                        chrome.storage.local.set({ authState });

                        // Отправляем успешный ответ
                        sendResponse({
                            success: true,
                            email: request.credentials.email
                        });
                    } else {
                        // Если сервер вернул success: false
                        sendResponse({
                            success: false,
                            error: data.message || 'Ошибка аутентификации'
                        });
                    }
                })
                .catch(error => {
                    // Обработка ошибок сети или парсинга
                    console.error('Ошибка аутентификации:', error);
                    sendResponse({
                        success: false,
                        error: error.message || 'Ошибка сети'
                    });
                });
            return true; // Указываем, что ответ будет асинхронным

        case "checkAuth":         // Проверка состояния аутентификации
            sendResponse({
                authenticated: authState.isAuthenticated,
                email: authState.email
            });
            break;

        case "logout":            // Выход из системы
            authState.isAuthenticated = false;
            authState.email = "";
            // Сохраняем состояние в хранилище
            chrome.storage.local.set({ authState });

            // Всегда пытаемся отключить VPN при выходе
            if (vpnState.isActive) {
                VPNManager.deactivate().then(() => {
                    vpnState.isActive = false;
                    chrome.storage.local.set({ vpnStatus: false });
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
                    chrome.storage.local.set({ vpnStatus: true });  // Сохранение статуса
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
                    chrome.storage.local.set({ vpnStatus: false });  // Сохранение статуса
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
                "16": `assets/Icon16Off.png`,  // Иконка 16x16
                "32": `assets/Icon32Off.png`,  // Иконка 32x32
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
    // Восстанавливаем состояние из хранилища (используем local для надежности)
    chrome.storage.local.get(['vpnStatus', 'authState'], (result) => {
        vpnState.isActive = result.vpnStatus || false;  // Восстановление статуса VPN
        authState = result.authState || { isAuthenticated: false, email: "" };  // Восстановление состояния аутентификации
        VPNManager.updateUI();               // Обновление иконки
    });
});

// Инициализация состояния при загрузке расширения
chrome.runtime.onStartup.addListener(initializeState);
chrome.runtime.onInstalled.addListener(initializeState);

function initializeState() {
    chrome.storage.local.get(['vpnStatus', 'authState'], (result) => {
        vpnState.isActive = result.vpnStatus || false;
        authState = result.authState || { isAuthenticated: false, email: "" };
        VPNManager.updateUI();
    });
}