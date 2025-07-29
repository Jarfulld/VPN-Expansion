// Ожидаем полной загрузки DOM перед выполнением скрипта
document.addEventListener('DOMContentLoaded', function () {
    // Получаем ссылки на все элементы интерфейса
    const toggleBtn = document.getElementById('toggleBtn'); // Кнопка включения/выключения VPN
    const statusText = document.getElementById('statusText'); // Текст статуса VPN
    const loginBtn = document.getElementById('loginBtn'); // Кнопка входа
    const registerBtn = document.getElementById('registerBtn'); // Кнопка регистрации
    const logoutBtn = document.getElementById('logoutBtn'); // Кнопка выхода
    const authSection = document.getElementById('authSection'); // Секция аутентификации
    const loginForm = document.getElementById('loginForm'); // Форма входа
    const submitLogin = document.getElementById('submitLogin'); // Кнопка отправки формы входа
    const backBtn = document.getElementById('backBtn'); // Кнопка "Назад" в форме входа
    const loadingElement = document.getElementById('loading'); // Элемент загрузки
    const userInfo = document.getElementById('userInfo'); // Секция информации о пользователе
    const userEmail = document.getElementById('userEmail'); // Поле для отображения email пользователя
    const paymentBtn = document.getElementById('paymentBtn'); // Кнопка оплаты

    // Состояние приложения
    let isActive = false; // Статус VPN (включен/выключен)
    let isAuthenticated = false; // Статус аутентификации пользователя
    let email = ""; // Email аутентифицированного пользователя

    // Инициализация пользовательского интерфейса
    initUI();

    // Обработчик клика по кнопке VPN
    toggleBtn.addEventListener('click', function () {
        // Проверяем аутентификацию перед включением VPN
        if (!isAuthenticated) {
            alert('Пожалуйста, войдите в аккаунт перед использованием VPN');
            return;
        }

        // Блокируем кнопку на время обработки запроса
        toggleBtn.disabled = true;
        loadingElement.style.display = 'block';
        loadingElement.textContent = isActive ? 'Отключаем...' : 'Подключаем...';

        // Отправляем сообщение в фоновый скрипт для переключения VPN
        chrome.runtime.sendMessage({ action: "toggle" }, () => {
            // Разблокируем кнопку после завершения операции
            toggleBtn.disabled = false;
            loadingElement.style.display = 'none';
        });
    });

    // Обработчик клика по кнопке входа - показывает форму входа
    loginBtn.addEventListener('click', function () {
        authSection.style.display = 'none';
        loginForm.style.display = 'block';
    });

    // Обработчик клика по кнопке регистрации - открывает страницу регистрации в новой вкладке
    registerBtn.addEventListener('click', function () {
        chrome.tabs.create({ url: 'https://barbarisvpn.online/registration' });
    });

    // Обработчик клика по кнопке оплаты
    paymentBtn.addEventListener('click', function () {
        chrome.tabs.create({ url: 'https://barbarisvpn.online' });
    });

    // Обработчик клика по кнопке выхода
    logoutBtn.addEventListener('click', function () {
        // Блокируем кнопку на время обработки запроса
        toggleBtn.disabled = true;
        loadingElement.style.display = 'block';
        loadingElement.textContent = 'Выход из аккаунта...';

        // Отправляем сообщение в фоновый скрипт для выхода
        chrome.runtime.sendMessage({ action: "logout" }, function (response) {
            if (response.success) {
                // Обновляем состояние и UI после успешного выхода
                isAuthenticated = false;
                email = "";
                isActive = false;
                updateUI(isActive);

                userInfo.style.display = 'none';
                authSection.style.display = 'block';
                loginForm.style.display = 'none';
            }

            // Разблокируем кнопку после завершения операции
            toggleBtn.disabled = false;
            loadingElement.style.display = 'none';
        });
    });

    // Обработчик кнопки "Назад" в форме входа - возвращает к секции аутентификации
    backBtn.addEventListener('click', function () {
        loginForm.style.display = 'none';
        authSection.style.display = 'block';
    });

    // Обработчик отправки формы входа
    submitLogin.addEventListener('click', function () {
        const email = "sergdorn@inbox.ru";
        const password = "1245678Qq";
        /*
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        if (!email || !password) {
            alert('Пожалуйста, заполните все поля');
            return;
        }
        */
        loadingElement.style.display = 'block';
        loadingElement.textContent = 'Входим в аккаунт...';

        // Отправляем данные для аутентификации в фоновый скрипт 
        chrome.runtime.sendMessage({
            action: "authenticate",
            credentials: { email, password }
        }, (response) => {
            loadingElement.style.display = 'none';

            if (response && response.success) {
                // Успешная аутентификация
                isAuthenticated = true;
                userEmail.textContent = response.email || email;
                userInfo.style.display = 'block';
                loginForm.style.display = 'none';
                authSection.style.display = 'none';

                // Обновляем статус VPN после успешной авторизации
                chrome.runtime.sendMessage({ action: "getStatus" }, (statusResponse) => {
                    if (statusResponse) {
                        isActive = statusResponse.status;
                        updateUI(isActive);
                    }
                });
            } else {
                // Ошибка аутентификации
                const errorMessage = response?.error || 'Неизвестная ошибка авторизации';
                alert(`Ошибка авторизации: ${errorMessage}`);
            }
        });
    });

    // Слушаем изменения в хранилище Chrome (для статуса VPN)
    chrome.storage.onChanged.addListener(function (changes) {
        if (changes.vpnStatus) {
            // Обновляем статус VPN при изменении
            isActive = changes.vpnStatus.newValue;
            updateUI(isActive);
        }
        if (changes.authState) {
            // Обновляем состояние аутентификации при изменении
            isAuthenticated = changes.authState.newValue.isAuthenticated;
            email = changes.authState.newValue.email;
            if (isAuthenticated) {
                userEmail.textContent = email;
                userInfo.style.display = 'block';
                authSection.style.display = 'none';
                loginForm.style.display = 'none';
            }
        }
    });

    // Функция инициализации пользовательского интерфейса
    function initUI() {
        // Запрашиваем текущий статус VPN у фонового скрипта
        chrome.runtime.sendMessage({ action: "getStatus" }, function (response) {
            if (chrome.runtime.lastError) {
                // Если ошибка - повторяем запрос через 200 мс
                setTimeout(initUI, 200);
                return;
            }
            isActive = response.status;
            updateUI(isActive);
        });

        // Проверяем статус аутентификации при загрузке
        chrome.runtime.sendMessage({ action: "checkAuth" }, function (response) {
            if (response.authenticated) {
                // Пользователь аутентифицирован - показываем его информацию
                isAuthenticated = true;
                email = response.email;
                userEmail.textContent = email;
                userInfo.style.display = 'block';
                authSection.style.display = 'none';
                loginForm.style.display = 'none';
            } else {
                // Пользователь не аутентифицирован - показываем секцию входа
                isAuthenticated = false;
                userInfo.style.display = 'none';
                authSection.style.display = 'block';
            }
        });
    }

    // Функция обновления интерфейса в зависимости от статуса VPN
    function updateUI(isActive) {
        if (isActive) {
            // VPN включен
            toggleBtn.textContent = 'Отключиться';
            toggleBtn.className = 'toggle-btn on';
            statusText.textContent = 'Статус: Активен';
            statusText.style.color = '#4CAF50'; // Зеленый цвет
        } else {
            // VPN выключен
            toggleBtn.textContent = 'Подключиться';
            toggleBtn.className = 'toggle-btn off';
            statusText.textContent = 'Статус: Отключен';
            statusText.style.color = '#f44336'; // Красный цвет
        }
        loadingElement.style.display = 'none'; // Скрываем индикатор загрузки
    }
});