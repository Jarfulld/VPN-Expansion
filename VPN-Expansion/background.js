// Конфигурация сервера VPN
const SERVER_CONFIG = {
    name: "Netherlands",          // Название сервера
    address: "185.184.122.74",    // IP-адрес сервера
    port: 443,   /*1000*/                 // Порт для подключения
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
    email: "",                    // Email пользователя
    token: ""                     // Токен аутентификации
};

// Инициализация расширения при установке
chrome.runtime.onInstalled.addListener(() => {
    console.log('VPN Barbaris инициализирован');
    // Установка начальных значений в локальное хранилище (сохраняется между сессиями)
    chrome.storage.local.set({
        vpnStatus: false,
        authState: {
            isAuthenticated: false,
            email: "",
            token: ""
        }
    });
});

// Функция для аутентификации пользователя на сервере
async function authenticateWithServer(email, password) {
    const requestBody = JSON.stringify({
        email: email,
        password: password
    });

    try {
        const response = await fetch('http://185.184.122.25:5000/auth_auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: requestBody
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Ошибка HTTP! Статус: ${response.status}`);
        }

        const data = await response.json();

        if (!data.hasOwnProperty('success')) {
            throw new Error('Некорректный формат ответа сервера');
        }

        // Если сервер возвращает токен, сохраняем его
        if (data.token) {
            authState.token = data.token;
        }

        return data;
    } catch (error) {
        console.error('Ошибка при аутентификации:', error);
        throw error;
    }
}

// Функция для аутентификации пользователя на сервере
async function authenticateWithServer(email, password) {
    // Формируем тело запроса в формате JSON
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

        // Проверяем статус ответа
        if (!response.ok) {
            // Если ответ не успешный, пытаемся получить ошибку из тела ответа
            const errorData = await response.json();
            // Генерируем ошибку с сообщением от сервера или стандартным HTTP-сообщением
            throw new Error(errorData.message || `Ошибка HTTP! Статус: ${response.status}`);
        }

        // Парсим успешный ответ сервера в формате JSON
        const data = await response.json();

        // Проверяем наличие обязательного поля 'success' в ответе
        if (!data.hasOwnProperty('success')) {
            throw new Error('Некорректный формат ответа сервера');
        }

        // Если сервер возвращает токен, сохраняем его в глобальном состоянии аутентификации
        if (data.token) {
            authState.token = data.token; // Предполагается, что authState определен где-то в коде
        }

        // Возвращаем данные ответа для дальнейшей обработки
        return data;
    } catch (error) {
        // Логируем ошибку в консоль
        console.error('Ошибка при аутентификации:', error);
        // Пробрасываем ошибку дальше для обработки в вызывающем коде
        throw error;
    }
}

// Обработчик сообщений между компонентами расширения
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Используем switch для обработки разных типов действий (actions)
    switch (request.action) {
        // Действие для включения/выключения VPN
        case "toggle":
            // Вызываем функцию toggleVPN и возвращаем текущий статус
            toggleVPN().then(status => sendResponse({ status }));
            // Возвращаем true для указания, что ответ будет отправлен асинхронно
            return true;

        // Действие для получения текущего статуса VPN
        case "getStatus":
            // Отправляем текущее состояние VPN (включен/выключен)
            sendResponse({ status: vpnState.isActive });
            break;

        // Действие для получения информации о сервере
        case "getServerInfo":
            // Отправляем конфигурацию сервера клиенту
            sendResponse({ server: SERVER_CONFIG });
            break;

        // Действие для аутентификации пользователя
        case "authenticate":
            // Вызываем функцию аутентификации с переданными учетными данными
            authenticateWithServer(request.credentials.email, request.credentials.password)
                .then(data => {
                    if (data.success) {
                        // Если аутентификация успешна, обновляем состояние
                        authState.isAuthenticated = true;
                        authState.email = request.credentials.email;

                        // Сохраняем состояние в локальное хранилище Chrome
                        chrome.storage.local.set({ authState }, () => {
                            // Отправляем успешный ответ с данными пользователя
                            sendResponse({
                                success: true,
                                email: request.credentials.email,
                                token: data.token || null
                            });
                        });
                    } else {
                        // Если аутентификация не удалась, отправляем сообщение об ошибке
                        sendResponse({
                            success: false,
                            error: data.message || 'Ошибка аутентификации'
                        });
                    }
                })
                .catch(error => {
                    // Обрабатываем ошибки при аутентификации
                    console.error('Ошибка аутентификации:', error);
                    sendResponse({
                        success: false,
                        error: error.message || 'Ошибка сети'
                    });
                });
            // Указываем, что ответ будет асинхронным
            return true;

        // Действие для проверки аутентификации пользователя
        case "checkAuth":
            // Проверяем наличие токена в состоянии
            if (authState.token) {
                // Если токен есть, проверяем его валидность
                validateToken(authState.token).then(isValid => {
                    if (!isValid) {
                        // Если токен недействителен, сбрасываем состояние аутентификации
                        authState.isAuthenticated = false;
                        authState.email = "";
                        authState.token = "";
                        chrome.storage.local.set({ authState });
                    }
                    // Отправляем текущее состояние аутентификации
                    sendResponse({
                        authenticated: authState.isAuthenticated && isValid,
                        email: authState.email,
                        token: authState.token
                    });
                });
                // Указываем, что ответ будет асинхронным
                return true;
            } else {
                // Если токена нет, просто отправляем текущее состояние
                sendResponse({
                    authenticated: authState.isAuthenticated,
                    email: authState.email,
                    token: authState.token
                });
            }
            break;

        // Действие для выхода из системы
        case "logout":
            // Сбрасываем состояние аутентификации (но сохраняем email для удобства)
            authState.isAuthenticated = false;
            authState.token = "";
            // Сохраняем обновленное состояние в хранилище
            chrome.storage.local.set({ authState });

            // Если VPN был активен, деактивируем его
            if (vpnState.isActive) {
                VPNManager.deactivate().then(() => {
                    vpnState.isActive = false;
                    // Сохраняем статус VPN
                    chrome.storage.local.set({ vpnStatus: false });
                    sendResponse({ success: true });
                }).catch(error => {
                    console.error('Ошибка при отключении VPN:', error);
                    sendResponse({ success: false, error: error.message });
                });
                return true;
            } else {
                // Если VPN не был активен, просто подтверждаем выход
                sendResponse({ success: true });
            }
            break;

        // Обработка неизвестных действий
        default:
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
                    console.log('Обновление иконки');
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
    chrome.storage.local.get(['vpnStatus', 'authState'], (result) => {
        vpnState.isActive = result.vpnStatus || false;

        // Восстанавливаем состояние аутентификации из локального хранилища
        authState = result.authState || {
            isAuthenticated: false,
            email: "",
            token: ""
        };

        // Если есть токен, проверяем его валидность
        if (authState.token) {
            validateToken(authState.token).then(isValid => {
                if (!isValid) {
                    authState.isAuthenticated = false;
                    authState.token = "";
                    chrome.storage.local.set({ authState });
                } else {
                    authState.isAuthenticated = true;
                }
                VPNManager.updateUI();
            });
        } else {
            VPNManager.updateUI();
        }
    });
});


// Также добавляем обработчик для события chrome.runtime.onStartup
chrome.runtime.onStartup.addListener(() => {
    console.log('Расширение запущено после перезагрузки браузера');
    // Проверяем аутентификацию при старте
    chrome.runtime.sendMessage({ action: "checkAuth" });
});


